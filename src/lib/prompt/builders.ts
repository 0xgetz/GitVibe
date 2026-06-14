import type {
  AnalysisResult,
  ContextMode,
  GeneratedPrompt,
  PromptVariant,
  RepoInsights,
} from "@/lib/types";
import { estimateTokens } from "@/lib/analyze/tokenEstimator";

// ─── Context section shared by every variant ─────────────────────────────────

function fileTree(paths: string[], limit: number): string {
  return paths.slice(0, limit).join("\n");
}

function insightsBlock(i: RepoInsights): string {
  const lines: string[] = [];
  if (i.languages.length)
    lines.push(`- **Languages**: ${i.languages.map((l) => `${l.name} (${l.share}%)`).join(", ")}`);
  if (i.frameworks.length) lines.push(`- **Frameworks**: ${i.frameworks.join(", ")}`);
  if (i.databases.length) lines.push(`- **Data layer**: ${i.databases.join(", ")}`);
  if (i.testing.length) lines.push(`- **Testing**: ${i.testing.join(", ")}`);
  if (i.cicd.length) lines.push(`- **CI/CD**: ${i.cicd.join(", ")}`);
  if (i.infra.length) lines.push(`- **Infra**: ${i.infra.join(", ")}`);
  if (i.packageManagers.length) lines.push(`- **Package manager**: ${i.packageManagers.join(", ")}`);
  if (i.architecture.length) lines.push(`- **Architecture**: ${i.architecture.join(", ")}`);
  if (i.monorepo.isMonorepo)
    lines.push(
      `- **Monorepo**: yes${i.monorepo.tool ? ` (${i.monorepo.tool})` : ""}${
        i.monorepo.packages.length ? ` — ${i.monorepo.packages.join(", ")}` : ""
      }`,
    );
  if (i.entryPoints.length) lines.push(`- **Entry points**: ${i.entryPoints.join(", ")}`);
  lines.push(`- **Source files analysed**: ${i.fileCount}`);
  return lines.join("\n");
}

function contextSection(a: AnalysisResult, mode: ContextMode, llmSummary?: string): string {
  const { meta, insights, tree, readme, importantFiles } = a;
  const treeLimit = mode === "quick" ? 120 : mode === "standard" ? 300 : 800;
  const parts: string[] = [];

  parts.push(`## Repository\n`);
  parts.push(`**${meta.fullName}** — ${meta.description ?? "no description"}`);
  parts.push(
    `\`${meta.url}\` · ${meta.stars}★ · default branch \`${meta.defaultBranch}\`${
      meta.license ? ` · ${meta.license}` : ""
    }`,
  );

  parts.push(`\n## Detected stack & architecture\n${insightsBlock(insights)}`);

  if (llmSummary) parts.push(`\n## Architecture summary\n${llmSummary}`);

  if (readme && mode !== "ultra") {
    const cap = mode === "quick" ? 2500 : 6000;
    parts.push(`\n## README (excerpt)\n${readme.slice(0, cap)}`);
  } else if (readme) {
    parts.push(`\n## README\n${readme}`);
  }

  parts.push(`\n## File tree (${Math.min(tree.length, treeLimit)} of ${tree.length})\n\`\`\`\n${fileTree(
    tree.map((t) => t.path),
    treeLimit,
  )}\n\`\`\``);

  if ((mode === "deep" || mode === "ultra") && importantFiles.length) {
    const budget = mode === "ultra" ? importantFiles.length : Math.min(importantFiles.length, 12);
    parts.push(`\n## Key file contents`);
    for (const f of importantFiles.slice(0, budget)) {
      if (!f.content) continue;
      const cap = mode === "ultra" ? 8000 : 3000;
      parts.push(`\n### \`${f.path}\`\n\`\`\`\n${f.content.slice(0, cap)}\n\`\`\``);
    }
  }

  return parts.join("\n");
}

// ─── Variant templates ───────────────────────────────────────────────────────

const VARIANT_META: Record<PromptVariant, { title: string; intro: (a: AnalysisResult) => string; outro: string }> = {
  vibe: {
    title: "Vibe Coding Prompt",
    intro: (a) =>
      `I want to rebuild a project similar to **${a.meta.fullName}** from scratch using an AI coding assistant. Below is everything you need to understand it. Help me recreate it step by step, asking me clarifying questions only when something is genuinely ambiguous. Match the same tech choices unless you can justify a better one.`,
    outro: `### How to work with me
- Start by confirming the stack and scaffolding the project structure.
- Build feature by feature; show me runnable code at each step.
- Keep the same conventions and folder layout shown above.
- Flag anything in the original that looks like a bug or anti-pattern, and propose the improved version.`,
  },
  system: {
    title: "System Prompt + Agent Instructions",
    intro: () =>
      `You are an expert full-stack engineer embedded in this codebase. Use the context below as the source of truth for conventions, stack, and architecture. Follow existing patterns exactly; do not introduce new libraries without explicit reason.`,
    outro: `### Operating rules
- Mirror the established folder structure, naming, and import style.
- Respect the detected architecture and state-management approach.
- Write tests in the project's existing framework for every change.
- Never invent APIs or env vars that aren't shown; ask if unsure.
- Prefer minimal, surgical diffs over rewrites.

Paste this as a Cursor "Rules for AI", a Claude Project instruction, or a system prompt.`,
  },
  rebuild: {
    title: "Step-by-step Rebuild Prompt",
    intro: (a) =>
      `Act as a senior engineer guiding me through rebuilding **${a.meta.fullName}** from zero. Produce a concrete, ordered build plan, then implement each phase on request.`,
    outro: `### Required output
1. **Phase 0 — Scaffold**: exact commands to bootstrap the project, dependencies, and config files.
2. **Phase 1 — Data & types**: schema/models, migrations, core types.
3. **Phase 2 — Core logic**: the central modules and services.
4. **Phase 3 — Interface**: API routes and/or UI.
5. **Phase 4 — Tests & CI**: testing setup and pipeline.
6. **Phase 5 — Deploy**: containerisation / hosting matching the detected infra.

For each phase: list files to create, then give full code. Wait for my "next" before moving on.`,
  },
  fork: {
    title: "Fork & Improve Prompt",
    intro: (a) =>
      `I'm forking **${a.meta.fullName}** to improve and extend it. Use the context below to understand the current implementation, then propose and implement concrete improvements.`,
    outro: `### What I want from you
1. A short audit: strengths, weaknesses, risky patterns, missing tests, security gaps.
2. A prioritised improvement backlog (impact vs effort).
3. For the top items, implement the changes with full code and migration notes.
4. Keep backwards compatibility unless you call out a breaking change explicitly.

Suggested focus areas to evaluate: performance, type safety, error handling, security (authn/z, input validation), DX, and test coverage.`,
  },
};

export function buildPrompt(
  variant: PromptVariant,
  a: AnalysisResult,
  mode: ContextMode,
  llmSummary?: string,
): GeneratedPrompt {
  const meta = VARIANT_META[variant];
  const content = [
    `# ${meta.title} — ${a.meta.fullName}`,
    ``,
    meta.intro(a),
    ``,
    `---`,
    ``,
    contextSection(a, mode, llmSummary),
    ``,
    `---`,
    ``,
    meta.outro,
  ].join("\n");

  return { variant, title: meta.title, content, tokens: estimateTokens(content) };
}

export function buildAll(
  a: AnalysisResult,
  mode: ContextMode,
  variants: PromptVariant[],
  llmSummary?: string,
): GeneratedPrompt[] {
  return variants.map((v) => buildPrompt(v, a, mode, llmSummary));
}

/** Prompt we send to the LLM (Deep/Ultra) to produce an architecture summary. */
export function buildSummaryRequest(a: AnalysisResult): { system: string; user: string } {
  const files = a.importantFiles
    .filter((f) => f.content)
    .slice(0, 25)
    .map((f) => `### ${f.path}\n${f.content.slice(0, 4000)}`)
    .join("\n\n");
  return {
    system:
      "You are a principal engineer. Given a repository's key files, write a precise, dense architecture summary: purpose, how the pieces fit, data flow, key abstractions, notable patterns, and anything a developer must know to rebuild or extend it. No fluff. Markdown with short sections.",
    user: `Repo: ${a.meta.fullName}\nDescription: ${a.meta.description ?? "n/a"}\nDetected: ${a.insights.techStack.join(
      ", ",
    )}\n\nKey files:\n\n${files}`,
  };
}
