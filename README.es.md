<div align="center">

<img src="public/logo.png" alt="GitVibe logo" width="160" />

# ⚡ GitVibe

**Convierte cualquier repositorio Git en un prompt de codificación AI óptimo.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](Dockerfile)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/0xgetz/GitVibe/pulls)
[![GitHub Stars](https://img.shields.io/github/stars/0xgetz/GitVibe?style=social)](https://github.com/0xgetz/GitVibe)
[![GitHub Issues](https://img.shields.io/github/issues/0xgetz/GitVibe)](https://github.com/0xgetz/GitVibe/issues)
[![GitHub Forks](https://img.shields.io/github/forks/0xgetz/GitVibe?style=social)](https://github.com/0xgetz/GitVibe)
[![Self-hosted](https://img.shields.io/badge/self--hosted-✓-0f9d58)](DEPLOY.md)
[![No tracking](https://img.shields.io/badge/tracking-none-red)](README.md#privacidad)

Pega una URL de GitHub / GitLab / Bitbucket / Git auto-alojado → obtén prompts probados
que permiten a Claude, Cursor, Grok y amigos *reconstruir, extender o forkear* el proyecto.

100% open-source · auto-alojable · cero tracking · MIT

**🌐 Idiomas:** [English](README.md) · [Bahasa Indonesia](README.id.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [Deutsch](README.de.md)

</div>

---

## Por qué GitVibe

[GitReverse](https://www.gitreverse.com) hace una sola cosa: convertir un repo en un prompt de "vibe coding".
GitVibe hace más, corre en tu propia máquina y nunca "llama a casa":

| | GitReverse | **GitVibe** |
|---|:---:|:---:|
| GitHub | ✅ | ✅ |
| GitLab / Bitbucket / Gitea (auto-alojado) | ❌ | ✅ |
| Reverse de subcarpeta / ruta de monorepo | ❌ | ✅ |
| Contexto por niveles (Quick → Ultra) | ❌ | ✅ |
| Múltiples variantes de prompt | ❌ | ✅ (4) |
| Detección de stack y arquitectura | básica | ✅ profunda |
| Estimador de tokens | ❌ | ✅ |
| Trae tu propio LLM (Ollama/Groq/OpenRouter/Anthropic/OpenAI) | ❌ | ✅ |
| Biblioteca de prompts | ❌ | ✅ |
| Exportar (MD/JSON/TXT/CLAUDE.md/.cursorrules) | ❌ | ✅ |
| Auto-alojable / open-source | ❌ | ✅ |
| Tracking / telemetría | algo | **nada** |

## Características

- **Multiplataforma** — GitHub, GitLab, Bitbucket y cualquier Gitea/GitLab auto-alojado vía host + token.
- **Inteligencia de contexto** — detecta lenguajes, frameworks, arquitectura (MVC / Clean / monorepo / Next.js App vs Pages Router), capa de datos, testing, CI/CD, infra. Prioriza archivos de alto valor (`README`, `package.json`, `tsconfig`, Dockerfiles, migraciones, puntos de entrada) y los lee en orden de ranking.
- **Modos de contexto por niveles** — `Quick` (README + árbol + metadatos), `Standard`, `Deep` (contenido de archivos críticos + resumen de arquitectura), `Ultra` (desglose modular completo).
- **4 variantes de prompt** — Vibe Coding · System Prompt + Agent Instructions · Step-by-step Rebuild · Fork & Improve.
- **Estimador de tokens** — presupuesto por modo para nunca reventar la ventana de contexto.
- **Reverse de subcarpeta** — analiza solo `apps/web` de un monorepo gigante.
- **Trae tu propio LLM** — Deep/Ultra pueden enriquecerse con un resumen real de arquitectura desde Ollama (local y gratis), Groq, OpenRouter, Anthropic u OpenAI. Quick/Standard **no necesitan** ningún LLM.
- **Biblioteca de prompts** — guarda, copia, borra prompts generados (SQLite local).
- **Exportar** — Markdown, JSON, texto plano, `CLAUDE.md`, `.cursorrules`.
- **UI moderna** — Next.js 15, Tailwind, componentes estilo shadcn, modo oscuro, totalmente responsive.
- **Endurecido en seguridad** — guard SSRF en hosts auto-alojados, protección contra cache poisoning, rate limiting, límites de tamaño de body, cero tracking.

## Inicio rápido (Docker)

```bash
git clone https://github.com/0xgetz/GitVibe.git gitvibe && cd gitvibe
cp .env.example .env          # opcional: añade tokens / claves LLM
docker compose up --build     # → http://localhost:3000
```

¿Quieres un LLM local incluido?

```bash
docker compose --profile ollama up --build
docker exec -it gitvibe-ollama ollama pull qwen2.5-coder:7b
```

## Inicio rápido (desarrollo local)

```bash
npm install
cp .env.example .env
npm run dev                   # → http://localhost:3000
```

Requiere **Node.js 20 o 22 (LTS)** — better-sqlite3 compila un binding nativo y el
toolchain (build tools) debe estar presente. Las versiones más nuevas de Node (p. ej. 26) **aún no** están soportadas.

## Configuración

Todo es opcional — la app arranca con cero configuración. Ver [`.env.example`](./.env.example) para la lista completa. Lo más destacado:

- `GITHUB_TOKEN` / `GITLAB_TOKEN` / `BITBUCKET_TOKEN` — sube los límites de rate y lee repos privados. (También puedes pegar un token por petición en la UI; nunca se guarda.)
- `OLLAMA_BASE_URL`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` — activan los resúmenes de arquitectura IA. Solo los providers configurados aparecen en la UI.
- `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` — rate limit por IP incorporado.
- `MAX_DEEP_FILES` — tope de archivos leídos para Deep/Ultra.
- `TRUST_PROXY` — pon `1` **solo** detrás de un reverse proxy que elimine el `X-Forwarded-For` del cliente.
- `MAX_BODY_BYTES` — tamaño máximo del body JSON (por defecto 1 MB).

## Cómo funciona

```
URL ─▶ providers.ts ─▶ orchestrator ─▶ analyzer (stack/arch/ranking)
                                     └▶ token estimator
                                     └▶ prompt builders ─▶ [+ resumen LLM] ─▶ 4 variantes
```

1. `parseRepoUrl` normaliza cualquier URL (incl. `/tree/<branch>/<subpath>`) en un `RepoRef`.
2. El cliente del provider correspondiente obtiene metadatos, el árbol completo de archivos y el README.
3. El analizador detecta el stack/arquitectura y rankea los archivos por utilidad; Deep/Ultra leen los top N.
4. Los prompt builders ensamblan el bloque de contexto y lo envuelven en las instrucciones de cada variante. Deep/Ultra opcionalmente anteponen un resumen de arquitectura generado por LLM.

## API

Todas las rutas son JSON plano bajo `/api`:

- `POST /api/analyze` — `{ url, mode, provider?, host?, token?, ref?, subpath? }` → análisis
- `POST /api/generate` — `{ analysis, mode, variants?, useLlm?, llmProvider? }` → prompts
- `GET/POST/DELETE /api/library` — CRUD de la biblioteca de prompts
- `POST /api/export` — `{ format, repoFullName, prompts }` → descarga de archivo

## Privacidad

Sin analíticas, sin telemetría, sin llamadas a terceros salvo el host Git y el proveedor LLM *que tú elijas*. Los tokens por petición se usan en memoria y nunca se escriben en disco. Los análisis anónimos de repos públicos se cachean en memoria durante 10 minutos; nada más sale de tu servidor.

## Despliegue

Ver [`DEPLOY.md`](./DEPLOY.md) para notas sobre Docker, bare-metal, Vercel y reverse proxy.

## Licencia

[MIT](./LICENSE). Haz lo que quieras. Contribuciones bienvenidas.
