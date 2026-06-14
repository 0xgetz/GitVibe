// ─── Shared domain types ────────────────────────────────────────────────────

export type Provider = "github" | "gitlab" | "bitbucket" | "gitea";

export type ContextMode = "quick" | "standard" | "deep" | "ultra";

export type PromptVariant =
  | "vibe"
  | "system"
  | "rebuild"
  | "fork";

export type LLMProvider =
  | "ollama"
  | "groq"
  | "openrouter"
  | "anthropic"
  | "openai";

export interface RepoRef {
  provider: Provider;
  owner: string;
  repo: string;
  /** Branch / tag / commit. Defaults to the repo default branch. */
  ref?: string;
  /** Limit analysis to a subfolder, e.g. "apps/web". */
  subpath?: string;
  /** For self-hosted Gitea / GitLab. e.g. "https://git.mycorp.dev". */
  host?: string;
  /** Per-request token for private repos (never persisted). */
  token?: string;
}

export interface RepoMeta {
  fullName: string;
  description: string | null;
  defaultBranch: string;
  stars: number;
  forks: number;
  language: string | null;
  topics: string[];
  license: string | null;
  url: string;
  pushedAt: string | null;
}

export interface RepoFile {
  path: string;
  /** Blob size in bytes (from the tree API; may be 0 for trees). */
  size: number;
  type: "blob" | "tree";
}

export interface FileContent {
  path: string;
  content: string;
  truncated: boolean;
}

export interface AnalysisResult {
  meta: RepoMeta;
  tree: RepoFile[];
  readme: string | null;
  /** Key files we read content for (Deep / Ultra). */
  importantFiles: FileContent[];
  insights: RepoInsights;
  tokenEstimate: TokenEstimate;
  fetchedAt: string;
}

export interface RepoInsights {
  languages: { name: string; share: number }[];
  techStack: string[];
  frameworks: string[];
  packageManagers: string[];
  databases: string[];
  testing: string[];
  cicd: string[];
  infra: string[];
  architecture: string[];
  monorepo: { isMonorepo: boolean; tool: string | null; packages: string[] };
  entryPoints: string[];
  notableConfigs: string[];
  fileCount: number;
}

export interface TokenEstimate {
  characters: number;
  tokens: number;
  byMode: Record<ContextMode, number>;
}

export interface GeneratedPrompt {
  variant: PromptVariant;
  title: string;
  content: string;
  tokens: number;
}
