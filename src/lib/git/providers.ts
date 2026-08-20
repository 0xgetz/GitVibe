import type { Provider, RepoRef, RepoMeta, RepoFile, FileContent } from "@/lib/types";
import { URL } from "node:url";
import { lookup as dnsLookup } from "node:dns";
import { promisify } from "node:util";

const lookupAsync = promisify(dnsLookup);

// ─── SSRF guard ─────────────────────────────────────────────────────────────

const PRIVATE_BLOCKS = [
  "127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
  "169.254.0.0/16", "::1/128", "fc00::/7", "fe80::/10",
];

function ipToInt(ip: string): number {
  const parts = ip.split(".");
  if (parts.length !== 4) return NaN;
  return parts.reduce((a, b) => (a << 8) + parseInt(b, 10), 0) >>> 0;
}

function isPrivateIP(ip: string): boolean {
  const n = ipToInt(ip);
  if (isNaN(n)) return false;
  for (const block of PRIVATE_BLOCKS) {
    const [base, bits] = block.split("/");
    const mask = ~(2 ** (32 - parseInt(bits)) - 1);
    if ((n & mask) >>> 0 === (ipToInt(base) & mask) >>> 0) return true;
  }
  return false;
}

/**
 * Validate a self-hosted host URL: must be http/https, not a private IP,
 * not a loopback, and not a link-local / metadata service address.
 */
export async function validateHost(host: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(host);
  } catch {
    throw new Error(`Invalid host URL: "${host}"`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Host URL must use http or https: "${host}"`);
  }
  // Resolve hostname to check for private IPs.
  try {
    const addresses = await lookupAsync(url.hostname, { all: true });
    for (const addr of addresses) {
      if (addr.family === 4 && isPrivateIP(addr.address)) {
        throw new Error(`Self-hosted host resolves to a private IP (${addr.address}) — not allowed`);
      }
    }
  } catch (e: any) {
    // A caught Error here is either our private-IP rejection or a DNS failure;
    // only rethrow our own guard, swallow genuine DNS errors (string check below still runs).
    if (e instanceof Error && e.message.includes("private IP")) throw e;
  }
  // Also check the string form (for IP literals in the URL).
  const hostname = url.hostname;
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) && isPrivateIP(hostname)) {
    throw new Error(`Self-hosted host points to a private IP (${hostname}) — not allowed`);
  }
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "0.0.0.0") {
    throw new Error(`Self-hosted host points to loopback — not allowed`);
  }
  return host;
}

// ─── URL parsing ──────────────────────────────────────────────────────────

const HOSTS: Record<string, Provider> = {
  "github.com": "github",
  "gitlab.com": "gitlab",
  "bitbucket.org": "bitbucket",
};

/**
 * Parse any repo URL (or "owner/repo") into a RepoRef.
 * Supports subpaths via the `/tree/<ref>/<subpath>` GitHub convention and
 * lets callers pass a self-hosted host + provider explicitly.
 */
export async function parseRepoUrl(
  input: string,
  opts: { provider?: Provider; host?: string; token?: string; ref?: string; subpath?: string } = {},
): Promise<RepoRef> {
  const raw = input.trim();

  // bare "owner/repo"
  if (!raw.includes("://") && raw.split("/").length === 2) {
    const [owner, repo] = raw.split("/");
    return {
      provider: opts.provider ?? "github",
      owner,
      repo: repo.replace(/\.git$/, ""),
      ref: opts.ref,
      subpath: opts.subpath,
      host: opts.host,
      token: opts.token,
    };
  }

  // Gitea (self-hosted) — host is user-supplied; block SSRF targets.
  if (opts.host) await validateHost(opts.host);

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Could not parse repository reference: "${input}"`);
  }

  // Known public hosts are fine; unknown hostnames get treated as gitea — validate them too.
  const provider = opts.provider ?? HOSTS[url.hostname] ?? "gitea";
  const host =
    opts.host ?? (HOSTS[url.hostname] ? undefined : `${url.protocol}//${url.host}`);
  if (host && !HOSTS[url.hostname]) await validateHost(host);

  const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
  const owner = parts[0];
  const repo = (parts[1] ?? "").replace(/\.git$/, "");
  if (!owner || !repo) throw new Error(`URL is missing owner/repo: "${input}"`);

  // /tree/<ref>/<subpath...>  or  /-/tree/<ref>/<subpath...> (GitLab)
  let ref = opts.ref;
  let subpath = opts.subpath;
  const treeIdx = parts.findIndex((p) => p === "tree" || p === "src");
  if (treeIdx >= 0 && parts[treeIdx + 1]) {
    ref = ref ?? parts[treeIdx + 1];
    const rest = parts.slice(treeIdx + 2).join("/");
    if (rest) subpath = subpath ?? rest;
  }

  return { provider, owner, repo, ref, subpath, host, token: opts.token };
}

// ─── Provider clients ───────────────────────────────────────────────────────

export interface GitClient {
  getMeta(ref: RepoRef): Promise<RepoMeta>;
  getTree(ref: RepoRef): Promise<RepoFile[]>;
  getFile(ref: RepoRef, path: string): Promise<FileContent | null>;
}

function authHeaders(ref: RepoRef): Record<string, string> {
  const token =
    ref.token ??
    (ref.provider === "github"
      ? process.env.GITHUB_TOKEN
      : ref.provider === "gitlab"
      ? process.env.GITLAB_TOKEN
      : ref.provider === "bitbucket"
      ? process.env.BITBUCKET_TOKEN
      : undefined);
  if (!token) return {};
  switch (ref.provider) {
    case "github":
    case "gitea":
      return { Authorization: `Bearer ${token}` };
    case "gitlab":
      return { "PRIVATE-TOKEN": token };
    case "bitbucket":
      // App password style "user:token" or raw bearer
      return token.includes(":")
        ? { Authorization: `Basic ${Buffer.from(token).toString("base64")}` }
        : { Authorization: `Bearer ${token}` };
  }
}

async function getJson(url: string, headers: Record<string, string>) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "GitVibe", ...headers },
    cache: "no-store",
  });
  if (!res.ok) {
    // Surface only status + endpoint, not the upstream body (may contain
    // internal data from a misconfigured host).
    throw new Error(`Upstream ${res.status} for ${redactUrl(url)}`);
  }
  return res.json();
}

/** Strip any query string (tokens/keys can end up in URLs). */
function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    return u.toString();
  } catch {
    return url.split("?")[0];
  }
}

const MAX_FILE_BYTES = 200_000;

// ─── GitHub ──────────────────────────────────────────────────────────────────

const github: GitClient = {
  async getMeta(ref) {
    const api = ref.host ? `${ref.host}/api/v3` : "https://api.github.com";
    const d = await getJson(`${api}/repos/${ref.owner}/${ref.repo}`, authHeaders(ref));
    return {
      fullName: d.full_name,
      description: d.description,
      defaultBranch: d.default_branch,
      stars: d.stargazers_count ?? 0,
      forks: d.forks_count ?? 0,
      language: d.language ?? null,
      topics: d.topics ?? [],
      license: d.license?.spdx_id ?? null,
      url: d.html_url,
      pushedAt: d.pushed_at ?? null,
    };
  },
  async getTree(ref) {
    const api = ref.host ? `${ref.host}/api/v3` : "https://api.github.com";
    const branch = ref.ref ?? (await this.getMeta(ref)).defaultBranch;
    const d = await getJson(
      `${api}/repos/${ref.owner}/${ref.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      authHeaders(ref),
    );
    return (d.tree ?? []).map((t: any) => ({
      path: t.path,
      size: t.size ?? 0,
      type: t.type === "tree" ? "tree" : "blob",
    }));
  },
  async getFile(ref, path) {
    const api = ref.host ? `${ref.host}/api/v3` : "https://api.github.com";
    const branch = ref.ref ?? "";
    const q = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    try {
      const d = await getJson(
        `${api}/repos/${ref.owner}/${ref.repo}/contents/${encodeURI(path)}${q}`,
        authHeaders(ref),
      );
      if (d.size > MAX_FILE_BYTES || d.encoding !== "base64") {
        return { path, content: "", truncated: true };
      }
      return {
        path,
        content: Buffer.from(d.content, "base64").toString("utf-8"),
        truncated: false,
      };
    } catch {
      return null;
    }
  },
};

// ─── GitLab ────────────────────────────────────────────────────────────────

const gitlab: GitClient = {
  async getMeta(ref) {
    const api = `${ref.host ?? "https://gitlab.com"}/api/v4`;
    const id = encodeURIComponent(`${ref.owner}/${ref.repo}`);
    const d = await getJson(`${api}/projects/${id}`, authHeaders(ref));
    return {
      fullName: d.path_with_namespace,
      description: d.description,
      defaultBranch: d.default_branch,
      stars: d.star_count ?? 0,
      forks: d.forks_count ?? 0,
      language: null,
      topics: d.topics ?? [],
      license: d.license?.nickname ?? null,
      url: d.web_url,
      pushedAt: d.last_activity_at ?? null,
    };
  },
  async getTree(ref) {
    const api = `${ref.host ?? "https://gitlab.com"}/api/v4`;
    const id = encodeURIComponent(`${ref.owner}/${ref.repo}`);
    const out: RepoFile[] = [];
    let page = 1;
    for (;;) {
      const branch = ref.ref ? `&ref=${encodeURIComponent(ref.ref)}` : "";
      const d = await getJson(
        `${api}/projects/${id}/repository/tree?recursive=true&per_page=100&page=${page}${branch}`,
        authHeaders(ref),
      );
      if (!Array.isArray(d) || d.length === 0) break;
      for (const t of d) out.push({ path: t.path, size: 0, type: t.type === "tree" ? "tree" : "blob" });
      if (d.length < 100) break;
      page++;
      if (page > 30) break;
    }
    return out;
  },
  async getFile(ref, path) {
    const api = `${ref.host ?? "https://gitlab.com"}/api/v4`;
    const id = encodeURIComponent(`${ref.owner}/${ref.repo}`);
    const branch = ref.ref ?? "HEAD";
    try {
      const d = await getJson(
        `${api}/projects/${id}/repository/files/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
        authHeaders(ref),
      );
      if ((d.size ?? 0) > MAX_FILE_BYTES) return { path, content: "", truncated: true };
      return { path, content: Buffer.from(d.content, "base64").toString("utf-8"), truncated: false };
    } catch {
      return null;
    }
  },
};

// ─── Bitbucket ───────────────────────────────────────────────────────────────

const bitbucket: GitClient = {
  async getMeta(ref) {
    const api = "https://api.bitbucket.org/2.0";
    const d = await getJson(`${api}/repositories/${ref.owner}/${ref.repo}`, authHeaders(ref));
    return {
      fullName: d.full_name,
      description: d.description ?? null,
      defaultBranch: d.mainbranch?.name ?? "main",
      stars: 0,
      forks: 0,
      language: d.language ?? null,
      topics: [],
      license: null,
      url: d.links?.html?.href ?? "",
      pushedAt: d.updated_on ?? null,
    };
  },
  async getTree(ref) {
    const api = "https://api.bitbucket.org/2.0";
    const branch = ref.ref ?? (await this.getMeta(ref)).defaultBranch;
    const out: RepoFile[] = [];
    let url = `${api}/repositories/${ref.owner}/${ref.repo}/src/${encodeURIComponent(branch)}/?max_depth=10&pagelen=100`;
    for (let i = 0; i < 30 && url; i++) {
      const d: any = await getJson(url, authHeaders(ref));
      for (const t of d.values ?? []) {
        out.push({ path: t.path, size: t.size ?? 0, type: t.type === "commit_directory" ? "tree" : "blob" });
      }
      url = d.next ?? "";
    }
    return out;
  },
  async getFile(ref, path) {
    const api = "https://api.bitbucket.org/2.0";
    const branch = ref.ref ?? (await this.getMeta(ref)).defaultBranch;
    const res = await fetch(
      `${api}/repositories/${ref.owner}/${ref.repo}/src/${encodeURIComponent(branch)}/${encodeURI(path)}`,
      { headers: { "User-Agent": "GitVibe", ...authHeaders(ref) }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const content = await res.text();
    return { path, content: content.slice(0, MAX_FILE_BYTES), truncated: content.length > MAX_FILE_BYTES };
  },
};

// ─── Gitea (self-hosted) ─────────────────────────────────────────────────────

const gitea: GitClient = {
  async getMeta(ref) {
    if (!ref.host) throw new Error("Gitea requires a host URL");
    const api = `${ref.host}/api/v1`;
    const d = await getJson(`${api}/repos/${ref.owner}/${ref.repo}`, authHeaders(ref));
    return {
      fullName: d.full_name,
      description: d.description ?? null,
      defaultBranch: d.default_branch,
      stars: d.stars_count ?? 0,
      forks: d.forks_count ?? 0,
      language: d.language ?? null,
      topics: [],
      license: null,
      url: d.html_url,
      pushedAt: d.updated_at ?? null,
    };
  },
  async getTree(ref) {
    const api = `${ref.host}/api/v1`;
    const branch = ref.ref ?? (await this.getMeta(ref)).defaultBranch;
    const d = await getJson(
      `${api}/repos/${ref.owner}/${ref.repo}/git/trees/${encodeURIComponent(branch)}?recursive=true&per_page=1000`,
      authHeaders(ref),
    );
    return (d.tree ?? []).map((t: any) => ({
      path: t.path,
      size: t.size ?? 0,
      type: t.type === "tree" ? "tree" : "blob",
    }));
  },
  async getFile(ref, path) {
    const api = `${ref.host}/api/v1`;
    const branch = ref.ref ?? "";
    const q = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    try {
      const d = await getJson(
        `${api}/repos/${ref.owner}/${ref.repo}/contents/${encodeURI(path)}${q}`,
        authHeaders(ref),
      );
      if (!d.content || d.encoding !== "base64") return { path, content: "", truncated: true };
      return { path, content: Buffer.from(d.content, "base64").toString("utf-8"), truncated: false };
    } catch {
      return null;
    }
  },
};

const CLIENTS: Record<Provider, GitClient> = { github, gitlab, bitbucket, gitea };

export function getClient(provider: Provider): GitClient {
  return CLIENTS[provider];
}
