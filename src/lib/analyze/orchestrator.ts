import type { AnalysisResult, ContextMode, RepoRef, RepoFile, FileContent } from "@/lib/types";
import { getClient } from "@/lib/git/providers";
import { analyzeRepo, rankFiles } from "@/lib/analyze/analyzer";
import { estimateForMode, estimateTokens } from "@/lib/analyze/tokenEstimator";

const README_NAMES = ["README.md", "readme.md", "README.MD", "Readme.md", "README"];

function filterSubpath(tree: RepoFile[], subpath?: string): RepoFile[] {
  if (!subpath) return tree;
  const prefix = subpath.replace(/^\/+|\/+$/g, "") + "/";
  return tree.filter((f) => f.path.startsWith(prefix));
}

function fileBudget(mode: ContextMode): number {
  const max = Number(process.env.MAX_DEEP_FILES ?? 40);
  switch (mode) {
    case "quick":
      return 0;
    case "standard":
      return Math.min(6, max);
    case "deep":
      return Math.min(20, max);
    case "ultra":
      return max;
  }
}

export async function runAnalysis(ref: RepoRef, mode: ContextMode): Promise<AnalysisResult> {
  const client = getClient(ref.provider);
  const meta = await client.getMeta(ref);
  const effRef: RepoRef = { ...ref, ref: ref.ref ?? meta.defaultBranch };

  const fullTree = await client.getTree(effRef);
  const tree = filterSubpath(fullTree, ref.subpath);

  // README always fetched (cheap, high value)
  let readme: string | null = null;
  for (const name of README_NAMES) {
    const hit = tree.find((f) => f.path === name) ?? fullTree.find((f) => f.path === name);
    if (hit) {
      const fc = await client.getFile(effRef, hit.path);
      if (fc?.content) {
        readme = fc.content;
        break;
      }
    }
  }

  // Read content for the top-ranked files (skip in quick mode)
  const budget = fileBudget(mode);
  const targets = budget > 0 ? rankFiles(tree, budget) : [];
  const importantFiles: FileContent[] = [];
  await Promise.all(
    targets.map(async (f) => {
      const fc = await client.getFile(effRef, f.path);
      if (fc) importantFiles.push(fc);
    }),
  );
  // keep ranking order
  const order = new Map(targets.map((t, i) => [t.path, i]));
  importantFiles.sort((a, b) => (order.get(a.path) ?? 99) - (order.get(b.path) ?? 99));

  const insights = analyzeRepo(tree, importantFiles, meta.language);

  const allText =
    (readme ?? "") +
    tree.map((t) => t.path).join("\n") +
    importantFiles.map((f) => f.content).join("\n");

  const tokenEstimate = {
    characters: allText.length,
    tokens: estimateTokens(allText),
    byMode: {
      quick: estimateForMode("quick", tree, readme, importantFiles),
      standard: estimateForMode("standard", tree, readme, importantFiles),
      deep: estimateForMode("deep", tree, readme, importantFiles),
      ultra: estimateForMode("ultra", tree, readme, importantFiles),
    },
  };

  return {
    meta,
    tree,
    readme,
    importantFiles,
    insights,
    tokenEstimate,
    fetchedAt: new Date().toISOString(),
  };
}
