import type { RepoFile, FileContent, RepoInsights } from "@/lib/types";

// ─── File prioritisation ─────────────────────────────────────────────────────

const HIGH_VALUE = [
  "readme.md",
  "package.json",
  "tsconfig.json",
  "pyproject.toml",
  "requirements.txt",
  "go.mod",
  "cargo.toml",
  "pom.xml",
  "build.gradle",
  "gemfile",
  "composer.json",
  "dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "next.config.js",
  "next.config.ts",
  "next.config.mjs",
  "vite.config.ts",
  "vite.config.js",
  "nuxt.config.ts",
  "svelte.config.js",
  "tailwind.config.ts",
  "tailwind.config.js",
  "drizzle.config.ts",
  "prisma/schema.prisma",
  "schema.prisma",
  "turbo.json",
  "nx.json",
  "pnpm-workspace.yaml",
  "lerna.json",
  "makefile",
  ".env.example",
  "openapi.yaml",
  "openapi.json",
];

const ENTRY_HINTS = [
  "src/main",
  "src/index",
  "src/app",
  "main.go",
  "main.py",
  "app.py",
  "manage.py",
  "src/app/layout",
  "src/app/page",
  "app/layout",
  "app/page",
  "cmd/",
  "server.ts",
  "server.js",
  "index.ts",
  "index.js",
];

const SKIP_DIRS = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  ".next/",
  "vendor/",
  "__pycache__/",
  ".venv/",
  "target/",
  "coverage/",
  ".turbo/",
];

const LOCKFILES = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "cargo.lock"];

function base(path: string): string {
  return path.split("/").pop()!.toLowerCase();
}

function isSkippable(path: string): boolean {
  const p = path.toLowerCase();
  if (SKIP_DIRS.some((d) => p.includes(d))) return true;
  if (LOCKFILES.includes(base(path))) return true;
  if (/\.(png|jpe?g|gif|svg|ico|webp|mp4|woff2?|ttf|eot|pdf|lock|min\.js|map)$/.test(p)) return true;
  return false;
}

/** Score a file for how useful its content is to an AI rebuilding the repo. */
export function scoreFile(file: RepoFile): number {
  if (file.type !== "blob" || isSkippable(file.path)) return -1;
  const b = base(file.path);
  const p = file.path.toLowerCase();
  let score = 0;

  if (HIGH_VALUE.includes(b) || HIGH_VALUE.some((h) => p.endsWith(h))) score += 100;
  if (ENTRY_HINTS.some((e) => p.includes(e))) score += 40;
  if (/migrations?\//.test(p) || /\.sql$/.test(p)) score += 35;
  if (/(^|\/)(schema|models?|entities|types|api|routes?|controllers?)\b/.test(p)) score += 25;
  if (/\.(ts|tsx)$/.test(p)) score += 12;
  if (/\.(js|jsx|py|go|rs|java|rb|php|vue|svelte)$/.test(p)) score += 10;
  if (/(^|\/)(lib|core|services?|hooks|utils)\//.test(p)) score += 8;
  if (/test|spec|\.stories\./.test(p)) score -= 15;
  if (/(^|\/)(docs?|examples?|fixtures?)\//.test(p)) score -= 8;

  // Shallow files outrank deeply-nested ones at equal score.
  score -= file.path.split("/").length;
  return score;
}

export function rankFiles(tree: RepoFile[], limit: number): RepoFile[] {
  return tree
    .map((f) => ({ f, s: scoreFile(f) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.f);
}

// ─── Tech / architecture detection ──────────────────────────────────────────

function has(tree: RepoFile[], pred: (p: string) => boolean): boolean {
  return tree.some((f) => pred(f.path.toLowerCase()));
}

export function analyzeRepo(
  tree: RepoFile[],
  files: FileContent[],
  primaryLanguage: string | null,
): RepoInsights {
  const blobs = tree.filter((f) => f.type === "blob" && !isSkippable(f.path));
  const byPath = new Map(files.map((f) => [f.path.toLowerCase(), f.content]));
  const pkgRaw =
    byPath.get("package.json") ??
    files.find((f) => base(f.path) === "package.json")?.content ??
    "";
  let pkg: any = {};
  try {
    pkg = pkgRaw ? JSON.parse(pkgRaw) : {};
  } catch {
    /* ignore malformed */
  }
  const deps: Record<string, string> = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const dep = (name: string) => name in deps;

  // languages by extension share
  const extCount: Record<string, number> = {};
  for (const f of blobs) {
    const m = f.path.toLowerCase().match(/\.([a-z0-9]+)$/);
    if (!m) continue;
    extCount[m[1]] = (extCount[m[1]] ?? 0) + 1;
  }
  const EXT_LANG: Record<string, string> = {
    ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript",
    py: "Python", go: "Go", rs: "Rust", java: "Java", kt: "Kotlin", rb: "Ruby",
    php: "PHP", cs: "C#", cpp: "C++", c: "C", swift: "Swift", vue: "Vue", svelte: "Svelte",
    css: "CSS", scss: "CSS", sql: "SQL", sh: "Shell",
  };
  const langTotals: Record<string, number> = {};
  for (const [ext, n] of Object.entries(extCount)) {
    const lang = EXT_LANG[ext];
    if (lang) langTotals[lang] = (langTotals[lang] ?? 0) + n;
  }
  const totalLang = Object.values(langTotals).reduce((a, b) => a + b, 0) || 1;
  const languages = Object.entries(langTotals)
    .map(([name, n]) => ({ name, share: Math.round((n / totalLang) * 100) }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 6);

  const frameworks: string[] = [];
  if (dep("next")) frameworks.push("Next.js");
  if (dep("react") && !dep("next")) frameworks.push("React");
  if (dep("vue") || dep("nuxt")) frameworks.push(dep("nuxt") ? "Nuxt" : "Vue");
  if (dep("svelte") || dep("@sveltejs/kit")) frameworks.push("SvelteKit");
  if (dep("@angular/core")) frameworks.push("Angular");
  if (dep("express")) frameworks.push("Express");
  if (dep("fastify")) frameworks.push("Fastify");
  if (dep("@nestjs/core")) frameworks.push("NestJS");
  if (has(tree, (p) => p.endsWith("manage.py"))) frameworks.push("Django");
  if (has(tree, (p) => p.includes("requirements.txt")) && byPath.size) {
    /* python detected elsewhere */
  }
  if (dep("flask") || has(tree, (p) => p.endsWith("app.py"))) frameworks.push("Flask");
  if (dep("fastapi")) frameworks.push("FastAPI");

  const databases: string[] = [];
  if (dep("@prisma/client") || dep("prisma") || has(tree, (p) => p.endsWith("schema.prisma")))
    databases.push("Prisma ORM");
  if (dep("drizzle-orm")) databases.push("Drizzle ORM");
  if (dep("pg") || dep("postgres") || dep("postgresql")) databases.push("PostgreSQL");
  if (dep("mysql") || dep("mysql2")) databases.push("MySQL");
  if (dep("better-sqlite3") || dep("sqlite3")) databases.push("SQLite");
  if (dep("mongodb") || dep("mongoose")) databases.push("MongoDB");
  if (dep("redis") || dep("ioredis")) databases.push("Redis");
  if (dep("typeorm")) databases.push("TypeORM");

  const testing: string[] = [];
  if (dep("vitest")) testing.push("Vitest");
  if (dep("jest")) testing.push("Jest");
  if (dep("@playwright/test") || dep("playwright")) testing.push("Playwright");
  if (dep("cypress")) testing.push("Cypress");
  if (dep("mocha")) testing.push("Mocha");
  if (dep("pytest") || has(tree, (p) => /test_.*\.py$/.test(p))) testing.push("pytest");

  const cicd: string[] = [];
  if (has(tree, (p) => p.includes(".github/workflows/"))) cicd.push("GitHub Actions");
  if (has(tree, (p) => p.endsWith(".gitlab-ci.yml"))) cicd.push("GitLab CI");
  if (has(tree, (p) => p.includes(".circleci/"))) cicd.push("CircleCI");

  const infra: string[] = [];
  if (has(tree, (p) => base(p) === "dockerfile")) infra.push("Docker");
  if (has(tree, (p) => p.includes("docker-compose"))) infra.push("Docker Compose");
  if (has(tree, (p) => p.endsWith(".tf"))) infra.push("Terraform");
  if (has(tree, (p) => p.includes("k8s/") || p.includes("kubernetes/") || /deployment\.ya?ml$/.test(p)))
    infra.push("Kubernetes");
  if (has(tree, (p) => p.includes("vercel.json"))) infra.push("Vercel");

  const packageManagers: string[] = [];
  if (has(tree, (p) => base(p) === "pnpm-lock.yaml")) packageManagers.push("pnpm");
  if (has(tree, (p) => base(p) === "yarn.lock")) packageManagers.push("yarn");
  if (has(tree, (p) => base(p) === "package-lock.json")) packageManagers.push("npm");
  if (has(tree, (p) => base(p) === "poetry.lock")) packageManagers.push("Poetry");
  if (has(tree, (p) => base(p) === "cargo.lock")) packageManagers.push("Cargo");

  // monorepo
  const workspaceTools: string[] = [];
  if (has(tree, (p) => base(p) === "turbo.json")) workspaceTools.push("Turborepo");
  if (has(tree, (p) => base(p) === "nx.json")) workspaceTools.push("Nx");
  if (has(tree, (p) => base(p) === "pnpm-workspace.yaml")) workspaceTools.push("pnpm workspaces");
  if (has(tree, (p) => base(p) === "lerna.json")) workspaceTools.push("Lerna");
  const wsDirs = new Set<string>();
  for (const f of blobs) {
    const m = f.path.match(/^(apps|packages|services)\/([^/]+)\//);
    if (m) wsDirs.add(`${m[1]}/${m[2]}`);
  }
  const isMonorepo = workspaceTools.length > 0 || wsDirs.size > 1 || Array.isArray(pkg.workspaces);

  // architecture heuristics
  const architecture: string[] = [];
  if (isMonorepo) architecture.push("Monorepo");
  if (has(tree, (p) => p.includes("apps/") && (p.includes("api") || p.includes("service"))))
    architecture.push("Microservices / multi-service");
  if (dep("next")) {
    architecture.push(
      has(tree, (p) => p.includes("/app/") && /page\.(t|j)sx?$/.test(p))
        ? "Next.js App Router"
        : "Next.js Pages Router",
    );
  }
  if (has(tree, (p) => /(controllers?|services?|repositories?|models?)\//.test(p)))
    architecture.push("Layered / MVC-style separation");
  if (has(tree, (p) => /(domain|usecases?|entities|infrastructure)\//.test(p)))
    architecture.push("Clean / Hexagonal architecture");
  if (testing.length && has(tree, (p) => /test|spec/.test(p))) architecture.push("Test-covered");

  const entryPoints = blobs
    .filter((f) => ENTRY_HINTS.some((e) => f.path.toLowerCase().includes(e)))
    .map((f) => f.path)
    .slice(0, 10);

  const notableConfigs = blobs
    .filter((f) => HIGH_VALUE.includes(base(f.path)))
    .map((f) => f.path)
    .slice(0, 20);

  const techStack = Array.from(
    new Set([
      ...(primaryLanguage ? [primaryLanguage] : []),
      ...languages.slice(0, 3).map((l) => l.name),
      ...frameworks,
      ...databases,
    ]),
  );

  return {
    languages,
    techStack,
    frameworks,
    packageManagers,
    databases,
    testing,
    cicd,
    infra,
    architecture: Array.from(new Set(architecture)),
    monorepo: { isMonorepo, tool: workspaceTools[0] ?? null, packages: Array.from(wsDirs).slice(0, 30) },
    entryPoints,
    notableConfigs,
    fileCount: blobs.length,
  };
}
