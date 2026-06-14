import type { ContextMode, RepoFile, FileContent } from "@/lib/types";

/**
 * Heuristic token estimate without pulling a full tokenizer dependency.
 * Code averages ~3.6 chars/token across GPT/Claude tokenizers; we use 3.7
 * with a small floor. Good enough for budgeting, not billing.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const chars = text.length;
  const words = text.split(/\s+/).filter(Boolean).length;
  // Blend char- and word-based estimates for stability on code vs prose.
  const byChars = chars / 3.7;
  const byWords = words * 1.3;
  return Math.max(1, Math.round((byChars + byWords) / 2));
}

export function estimateForMode(
  mode: ContextMode,
  tree: RepoFile[],
  readme: string | null,
  importantFiles: FileContent[],
): number {
  const treeText = tree.map((f) => f.path).join("\n");
  const treeTokens = estimateTokens(treeText);
  const readmeTokens = estimateTokens(readme ?? "");
  const fileTokens = importantFiles.reduce((sum, f) => sum + estimateTokens(f.content), 0);
  const overhead = 800; // instructions + headers in the generated prompt

  switch (mode) {
    case "quick":
      return overhead + readmeTokens + Math.min(treeTokens, 1500);
    case "standard":
      return overhead + readmeTokens + treeTokens + Math.round(fileTokens * 0.25);
    case "deep":
      return overhead + readmeTokens + treeTokens + Math.round(fileTokens * 0.7);
    case "ultra":
      return overhead + readmeTokens + treeTokens + fileTokens;
  }
}
