<div align="center">

<img src="public/logo.png" alt="GitVibe logo" width="160" />

# ⚡ GitVibe

**Ubah repositori Git apa pun menjadi prompt coding AI yang optimal.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](Dockerfile)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/0xgetz/GitVibe/pulls)
[![GitHub Stars](https://img.shields.io/github/stars/0xgetz/GitVibe?style=social)](https://github.com/0xgetz/GitVibe)
[![GitHub Issues](https://img.shields.io/github/issues/0xgetz/GitVibe)](https://github.com/0xgetz/GitVibe/issues)
[![GitHub Forks](https://img.shields.io/github/forks/0xgetz/GitVibe?style=social)](https://github.com/0xgetz/GitVibe)
[![Self-hosted](https://img.shields.io/badge/self--hosted-✓-0f9d58)](DEPLOY.md)
[![No tracking](https://img.shields.io/badge/tracking-none-red)](README.md#privasi)

Tempel URL GitHub / GitLab / Bitbucket / Git self-hosted → dapatkan prompt teruji
yang membuat Claude, Cursor, Grok dan kawan-kawan *membangun ulang, mengembangkan, atau fork* proyek.

100% open-source · self-hostable · zero tracking · MIT

**🌐 Bahasa:** [English](README.md) · [Bahasa Indonesia](README.id.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [Deutsch](README.de.md)

</div>

---

## Kenapa GitVibe

[GitReverse](https://www.gitreverse.com) hanya bisa satu hal: repo menjadi prompt "vibe coding".
GitVibe bisa lebih, berjalan di mesin lo sendiri, dan tidak pernah "telepon rumah":

| | GitReverse | **GitVibe** |
|---|:---:|:---:|
| GitHub | ✅ | ✅ |
| GitLab / Bitbucket / Gitea (self-hosted) | ❌ | ✅ |
| Reverse path subfolder / monorepo | ❌ | ✅ |
| Konteks bertingkat (Quick → Ultra) | ❌ | ✅ |
| Banyak varian prompt | ❌ | ✅ (4) |
| Deteksi tech-stack & arsitektur | basic | ✅ dalam |
| Estimator token | ❌ | ✅ |
| Bawa LLM sendiri (Ollama/Groq/OpenRouter/Anthropic/OpenAI) | ❌ | ✅ |
| Prompt library | ❌ | ✅ |
| Export (MD/JSON/TXT/CLAUDE.md/.cursorrules) | ❌ | ✅ |
| Self-hostable / open-source | ❌ | ✅ |
| Tracking / telemetri | ada | **tidak ada** |

## Fitur

- **Multi-platform** — GitHub, GitLab, Bitbucket, dan Gitea/GitLab self-hosted apa pun via host + token.
- **Context intelligence** — mendeteksi bahasa, framework, arsitektur (MVC / Clean / monorepo / Next.js App vs Pages Router), data layer, testing, CI/CD, infra. Memprioritaskan file bernilai tinggi (`README`, `package.json`, `tsconfig`, Dockerfiles, migrations, entry points) dan membacanya dalam urutan ranking.
- **Mode konteks bertingkat** — `Quick` (README + tree + metadata), `Standard`, `Deep` (isi file kritis + ringkasan arsitektur), `Ultra` (breakdown modular lengkap).
- **4 varian prompt** — Vibe Coding · System Prompt + Agent Instructions · Step-by-step Rebuild · Fork & Improve.
- **Estimator token** — budget per mode supaya tidak pernah meledakkan context window.
- **Reverse subfolder** — analisis hanya `apps/web` dari monorepo raksasa.
- **Bawa LLM sendiri** — Deep/Ultra bisa diperkaya dengan ringkasan arsitektur asli dari Ollama (lokal & gratis), Groq, OpenRouter, Anthropic, atau OpenAI. Quick/Standard **tanpa** LLM sama sekali.
- **Prompt library** — simpan, salin, hapus prompt hasil reverse-engineering (SQLite lokal).
- **Export** — Markdown, JSON, teks biasa, `CLAUDE.md`, `.cursorrules`.
- **UI modern** — Next.js 15, Tailwind, komponen ala shadcn, dark mode, responsif penuh.
- **Keamanan diperkuat** — guard SSRF di host self-hosted, proteksi cache-poisoning, rate limiting, batas ukuran body, tanpa tracking.

## Quick start (Docker)

```bash
git clone https://github.com/0xgetz/GitVibe.git gitvibe && cd gitvibe
cp .env.example .env          # opsional: tambah token / key LLM
docker compose up --build     # → http://localhost:3000
```

Mau LLM lokal sekalian?

```bash
docker compose --profile ollama up --build
docker exec -it gitvibe-ollama ollama pull qwen2.5-coder:7b
```

## Quick start (dev lokal)

```bash
npm install
cp .env.example .env
npm run dev                   # → http://localhost:3000
```

Butuh **Node.js 20 atau 22 (LTS)** — better-sqlite3 mengompilasi native binding dan
toolchain (build tools) harus tersedia. Node versi baru (mis. 26) **belum** didukung.

## Konfigurasi

Semuanya opsional — aplikasi boot dengan zero config. Lihat [`.env.example`](./.env.example) untuk daftar lengkap. Sorotan:

- `GITHUB_TOKEN` / `GITLAB_TOKEN` / `BITBUCKET_TOKEN` — naikkan rate limit & baca repo privat. (Bisa juga tempel token per-request di UI; tidak pernah disimpan.)
- `OLLAMA_BASE_URL`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` — aktifkan ringkasan arsitektur AI. Hanya provider yang dikonfigurasi yang muncul di UI.
- `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` — rate limit per-IP bawaan.
- `MAX_DEEP_FILES` — batas file yang dibaca untuk Deep/Ultra.
- `TRUST_PROXY` — set `1` **hanya** di belakang reverse proxy yang menghapus `X-Forwarded-For` dari klien.
- `MAX_BODY_BYTES` — batas ukuran body JSON (default 1 MB).

## Cara kerja

```
URL ─▶ providers.ts ─▶ orchestrator ─▶ analyzer (stack/arch/ranking)
                                     └▶ token estimator
                                     └▶ prompt builders ─▶ [+ LLM summary] ─▶ 4 varian
```

1. `parseRepoUrl` menormalisasi URL apa pun (termasuk `/tree/<branch>/<subpath>`) menjadi `RepoRef`.
2. Klien provider yang cocok mengambil metadata, seluruh file tree, dan README.
3. Analyzer mendeteksi stack/arsitektur dan memberi ranking file berdasarkan kegunaan; Deep/Ultra membaca N teratas.
4. Prompt builders merakit blok konteks dan membungkusnya dengan instruksi tiap varian. Deep/Ultra opsional menambahkan ringkasan arsitektur buatan LLM.

## API

Semua route JSON polos di bawah `/api`:

- `POST /api/analyze` — `{ url, mode, provider?, host?, token?, ref?, subpath? }` → analisis
- `POST /api/generate` — `{ analysis, mode, variants?, useLlm?, llmProvider? }` → prompts
- `GET/POST/DELETE /api/library` — CRUD prompt library
- `POST /api/export` — `{ format, repoFullName, prompts }` → unduh file

## Privasi

Tanpa analitik, tanpa telemetri, tanpa panggilan pihak ketiga kecuali host Git dan provider LLM *yang lo pilih*. Token per-request dipakai di memori dan tidak pernah ditulis ke disk. Analisis repo publik anonim di-cache di memori selama 10 menit; tidak ada yang keluar dari server lo.

## Deployment

Lihat [`DEPLOY.md`](./DEPLOY.md) untuk catatan Docker, bare-metal, Vercel, dan reverse-proxy.

## Lisensi

[MIT](./LICENSE). Bebas pakai apa saja. Kontribusi diterima.
