<div align="center">

<img src="public/logo.png" alt="GitVibe logo" width="160" />

# ⚡ GitVibe

**Turn any Git repository into an optimal AI coding prompt.**

Paste a GitHub / GitLab / Bitbucket / self-hosted Git URL → get battle-tested prompts
that let Claude, Cursor, Grok and friends *rebuild, extend, or fork* the project.

100% open-source · self-hostable · zero tracking · MIT

</div>

---

## Why GitVibe

[GitReverse](https://www.gitreverse.com) does one thing: a repo into a "vibe coding" prompt.
GitVibe does more, runs on your own machine, and never phones home:

| | GitReverse | **GitVibe** |
|---|:---:|:---:|
| GitHub | ✅ | ✅ |
| GitLab / Bitbucket / Gitea (self-hosted) | ❌ | ✅ |
| Subfolder / monorepo path reverse | ❌ | ✅ |
| Tiered context (Quick → Ultra) | ❌ | ✅ |
| Multiple prompt variants | ❌ | ✅ (4) |
| Tech-stack & architecture detection | basic | ✅ deep |
| Token estimator | ❌ | ✅ |
| Bring-your-own LLM (Ollama/Groq/OpenRouter/Anthropic/OpenAI) | ❌ | ✅ |
| Prompt library | ❌ | ✅ |
| Export (MD/JSON/TXT/CLAUDE.md/.cursorrules) | ❌ | ✅ |
| Self-hostable / open-source | ❌ | ✅ |
| Tracking / telemetry | some | **none** |

## Features

- **Multi-platform** — GitHub, GitLab, Bitbucket, and any self-hosted Gitea/GitLab via host + token.
- **Context intelligence** — auto-detects languages, frameworks, architecture (MVC / Clean / monorepo / Next.js App vs Pages Router), data layer, testing, CI/CD, infra. Prioritises high-value files (`README`, `package.json`, `tsconfig`, Dockerfiles, migrations, entry points) and reads them in ranked order.
- **Tiered context modes** — `Quick` (README + tree + metadata), `Standard`, `Deep` (critical file contents + architecture summary), `Ultra` (full modular breakdown).
- **4 prompt variants** — Vibe Coding · System Prompt + Agent Instructions · Step-by-step Rebuild · Fork & Improve.
- **Token estimator** — per-mode budget so you never blow your context window.
- **Subfolder reverse** — analyse just `apps/web` of a giant monorepo.
- **Bring your own LLM** — Deep/Ultra can enrich with a real architecture summary from Ollama (local & free), Groq, OpenRouter, Anthropic, or OpenAI. Quick/Standard need **no** LLM at all.
- **Prompt library** — save, copy, delete reverse-engineered prompts (local SQLite).
- **Export** — Markdown, JSON, plain text, `CLAUDE.md`, `.cursorrules`.
- **Modern UI** — Next.js 15, Tailwind, shadcn-style components, dark mode, fully responsive.

## Quick start (Docker)

```bash
git clone <your-fork-url> gitvibe && cd gitvibe
cp .env.example .env          # optional: add tokens / LLM keys
docker compose up --build     # → http://localhost:3000
```

Want a bundled local LLM too?

```bash
docker compose --profile ollama up --build
docker exec -it gitvibe-ollama ollama pull qwen2.5-coder:7b
```

## Quick start (local dev)

```bash
npm install
cp .env.example .env
npm run dev                   # → http://localhost:3000
```

Requires Node.js 20+ (better-sqlite3 compiles a native binding, so build tools must be present).

## Configuration

Everything is optional — the app boots with zero config. See [`.env.example`](./.env.example) for the full list. Highlights:

- `GITHUB_TOKEN` / `GITLAB_TOKEN` / `BITBUCKET_TOKEN` — raise rate limits & read private repos. (You can also paste a token per-request in the UI; it's never stored.)
- `OLLAMA_BASE_URL`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` — enable AI architecture summaries. Only the providers you configure show up in the UI.
- `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` — built-in per-IP rate limit.
- `MAX_DEEP_FILES` — cap on files read for Deep/Ultra.

## How it works

```
URL ─▶ providers.ts ─▶ orchestrator ─▶ analyzer (stack/arch/ranking)
                                     └▶ token estimator
                                     └▶ prompt builders ─▶ [+ LLM summary] ─▶ 4 variants
```

1. `parseRepoUrl` normalises any URL (incl. `/tree/<branch>/<subpath>`) into a `RepoRef`.
2. The matching provider client fetches metadata, the full file tree, and README.
3. The analyzer detects the stack/architecture and ranks files by usefulness; Deep/Ultra read the top N.
4. Prompt builders assemble a context block and wrap it in each variant's instructions. Deep/Ultra optionally prepend an LLM-generated architecture summary.

## API

All routes are plain JSON under `/api`:

- `POST /api/analyze` — `{ url, mode, provider?, host?, token?, ref?, subpath? }` → analysis
- `POST /api/generate` — `{ analysis, mode, variants?, useLlm?, llmProvider? }` → prompts
- `GET/POST/DELETE /api/library` — prompt library CRUD
- `POST /api/export` — `{ format, repoFullName, prompts }` → file download

## Privacy

No analytics, no telemetry, no third-party calls except the Git host and the LLM provider *you* choose. Per-request tokens are used in-memory and never written to disk. Anonymous public-repo analyses are cached in memory for 10 minutes; nothing else leaves your server.

## Deployment

See [`DEPLOY.md`](./DEPLOY.md) for Docker, bare-metal, Vercel, and reverse-proxy notes.

## License

[MIT](./LICENSE). Do whatever you want. Contributions welcome.
