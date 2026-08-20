<div align="center">

<img src="public/logo.png" alt="GitVibe logo" width="160" />

# ⚡ GitVibe

**把任意 Git 仓库变成最优的 AI 编码提示词。**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](Dockerfile)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/0xgetz/GitVibe/pulls)
[![GitHub Stars](https://img.shields.io/github/stars/0xgetz/GitVibe?style=social)](https://github.com/0xgetz/GitVibe)
[![GitHub Issues](https://img.shields.io/github/issues/0xgetz/GitVibe)](https://github.com/0xgetz/GitVibe/issues)
[![GitHub Forks](https://img.shields.io/github/forks/0xgetz/GitVibe?style=social)](https://github.com/0xgetz/GitVibe)
[![Self-hosted](https://img.shields.io/badge/self--hosted-✓-0f9d58)](DEPLOY.md)
[![No tracking](https://img.shields.io/badge/tracking-none-red)](README.md#隐私)

粘贴 GitHub / GitLab / Bitbucket / 自托管 Git URL → 获得久经考验的提示词，
让 Claude、Cursor、Grok 等 *重建、扩展或 fork* 项目。

100% 开源 · 可自托管 · 零追踪 · MIT

**🌐 语言:** [English](README.md) · [Bahasa Indonesia](README.id.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [Deutsch](README.de.md)

</div>

---

## 为什么选择 GitVibe

[GitReverse](https://www.gitreverse.com) 只做一件事：把仓库变成"氛围编程"提示词。
GitVibe 做得更多，运行在你自己的机器上，从不"电话回家"：

| | GitReverse | **GitVibe** |
|---|:---:|:---:|
| GitHub | ✅ | ✅ |
| GitLab / Bitbucket / Gitea（自托管） | ❌ | ✅ |
| 子文件夹 / monorepo 路径逆向 | ❌ | ✅ |
| 分层上下文（Quick → Ultra） | ❌ | ✅ |
| 多种提示词变体 | ❌ | ✅（4 种） |
| 技术栈与架构检测 | 基础 | ✅ 深度 |
| Token 估算器 | ❌ | ✅ |
| 自带 LLM（Ollama/Groq/OpenRouter/Anthropic/OpenAI） | ❌ | ✅ |
| 提示词库 | ❌ | ✅ |
| 导出（MD/JSON/TXT/CLAUDE.md/.cursorrules） | ❌ | ✅ |
| 可自托管 / 开源 | ❌ | ✅ |
| 追踪 / 遥测 | 有一些 | **完全没有** |

## 功能

- **多平台** — GitHub、GitLab、Bitbucket，以及任何自托管 Gitea/GitLab（host + token）。
- **上下文智能** — 自动检测语言、框架、架构（MVC / Clean / monorepo / Next.js App vs Pages Router）、数据层、测试、CI/CD、基础设施。优先处理高价值文件（`README`、`package.json`、`tsconfig`、Dockerfile、迁移、入口点）并按排名读取。
- **分层上下文模式** — `Quick`（README + 树 + 元数据）、`Standard`、`Deep`（关键文件内容 + 架构摘要）、`Ultra`（完整模块化拆解）。
- **4 种提示词变体** — Vibe Coding · System Prompt + Agent Instructions · Step-by-step Rebuild · Fork & Improve。
- **Token 估算器** — 每种模式的预算，绝不会撑爆上下文窗口。
- **子文件夹逆向** — 只分析巨型 monorepo 中的 `apps/web`。
- **自带 LLM** — Deep/Ultra 可用 Ollama（本地 & 免费）、Groq、OpenRouter、Anthropic 或 OpenAI 生成真实架构摘要。Quick/Standard **完全不需要** LLM。
- **提示词库** — 保存、复制、删除逆向出的提示词（本地 SQLite）。
- **导出** — Markdown、JSON、纯文本、`CLAUDE.md`、`.cursorrules`。
- **现代 UI** — Next.js 15、Tailwind、shadcn 风格组件、深色模式、完全响应式。
- **安全加固** — 自托管 host 的 SSRF 防护、缓存投毒防护、限流、请求体大小限制、零追踪。

## 快速开始（Docker）

```bash
git clone https://github.com/0xgetz/GitVibe.git gitvibe && cd gitvibe
cp .env.example .env          # 可选：添加 token / LLM 密钥
docker compose up --build     # → http://localhost:3000
```

想要附带本地 LLM？

```bash
docker compose --profile ollama up --build
docker exec -it gitvibe-ollama ollama pull qwen2.5-coder:7b
```

## 快速开始（本地开发）

```bash
npm install
cp .env.example .env
npm run dev                   # → http://localhost:3000
```

需要 **Node.js 20 或 22（LTS）** — better-sqlite3 需要编译原生绑定，且必须安装
构建工具链。较新的 Node 版本（如 26）**暂不支持**。

## 配置

一切都是可选的 — 应用零配置即可启动。完整列表见 [`.env.example`](./.env.example)。重点：

- `GITHUB_TOKEN` / `GITLAB_TOKEN` / `BITBUCKET_TOKEN` — 提高限流上限并读取私有仓库。（也可以在 UI 中按请求粘贴 token；绝不存储。）
- `OLLAMA_BASE_URL`、`GROQ_API_KEY`、`OPENROUTER_API_KEY`、`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` — 启用 AI 架构摘要。只有配置过的 provider 会显示在 UI 中。
- `RATE_LIMIT_MAX`、`RATE_LIMIT_WINDOW_MS` — 内置每 IP 限流。
- `MAX_DEEP_FILES` — Deep/Ultra 模式读取文件数的上限。
- `TRUST_PROXY` — **仅**在能剥离客户端 `X-Forwarded-For` 的反向代理后设置为 `1`。
- `MAX_BODY_BYTES` — JSON 请求体大小上限（默认 1 MB）。

## 工作原理

```
URL ─▶ providers.ts ─▶ orchestrator ─▶ analyzer（栈/架构/排名）
                                     └▶ token 估算器
                                     └▶ 提示词构建器 ─▶ [+ LLM 摘要] ─▶ 4 种变体
```

1. `parseRepoUrl` 将任何 URL（含 `/tree/<branch>/<subpath>`）规范化为 `RepoRef`。
2. 匹配的 provider 客户端获取元数据、完整文件树和 README。
3. 分析器检测栈/架构并按有用程度给文件排名；Deep/Ultra 读取前 N 个。
4. 提示词构建器组装上下文块，并套上每种变体的指令。Deep/Ultra 可选前置 LLM 生成的架构摘要。

## API

所有路由都是 `/api` 下的纯 JSON：

- `POST /api/analyze` — `{ url, mode, provider?, host?, token?, ref?, subpath? }` → 分析结果
- `POST /api/generate` — `{ analysis, mode, variants?, useLlm?, llmProvider? }` → 提示词
- `GET/POST/DELETE /api/library` — 提示词库 CRUD
- `POST /api/export` — `{ format, repoFullName, prompts }` → 文件下载

## 隐私

没有分析、没有遥测、没有第三方调用——除了 Git 主机和*你选择*的 LLM provider。按请求使用的 token 只在内存中，绝不写入磁盘。匿名公共仓库分析结果在内存中缓存 10 分钟；其他任何数据都不会离开你的服务器。

## 部署

Docker、裸机、Vercel 和反向代理说明见 [`DEPLOY.md`](./DEPLOY.md)。

## 许可证

[MIT](./LICENSE)。随你使用。欢迎贡献。
