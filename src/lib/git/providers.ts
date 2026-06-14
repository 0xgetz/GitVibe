import type { Provider, RepoRef, RepoMeta, RepoFile, FileContent } from "@/lib/types";

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
export function parseRepoUrl(
  input: string,
  opts: { provider?: Provider; host?: string; token?: string; ref?: string; subpath?: string } = {},
): RepoRef {
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

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Could not parse repository reference: "${input}"`);
  }

  const provider = opts.provider ?? HOSTS[url.hostname] ?? "gitea";
  const host =
    opts.host ?? (HOSTS[url.hostname] ? undefined : `${url.protocol}//${url.host}`);

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
    const body = await res.text().catch(() => "");
    throw new Error(`Upstream ${res.status} for ${url}: ${body.slice(0, 200)}`);
  }
  return res.json();
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
