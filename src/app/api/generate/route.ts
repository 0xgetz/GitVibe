import { NextResponse } from "next/server";
import { buildAll, buildSummaryRequest } from "@/lib/prompt/builders";
import { chat, availableProviders } from "@/lib/llm/client";
import { rateLimit, clientIp, readJson } from "@/lib/utils";
import type { AnalysisResult, ContextMode, LLMProvider, PromptVariant } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const ALL_VARIANTS: PromptVariant[] = ["vibe", "system", "rebuild", "fork"];
const VALID_MODES: ContextMode[] = ["quick", "standard", "deep", "ultra"];

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`gen:${ip}`).ok) {
    return NextResponse.json({ error: "Rate limit exceeded. Slow down." }, { status: 429 });
  }

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return NextResponse.json({ error: bodyRes.error }, { status: 400 });
  const body = bodyRes.value ?? {};

  const analysis = body.analysis as AnalysisResult | undefined;
  const mode = (body.mode ?? "standard") as ContextMode;
  const variants = (Array.isArray(body.variants) && body.variants.length ? body.variants : ALL_VARIANTS) as PromptVariant[];
  const useLlm = Boolean(body.useLlm);
  const llmProvider = body.llmProvider as LLMProvider | undefined;
  const llmModel = typeof body.llmModel === "string" ? body.llmModel : undefined;
  const llmApiKey = typeof body.llmApiKey === "string" ? body.llmApiKey : undefined;
  const llmBaseUrl = typeof body.llmBaseUrl === "string" ? body.llmBaseUrl : undefined;

  if (!analysis?.meta) {
    return NextResponse.json({ error: "Missing `analysis` (run /api/analyze first)" }, { status: 400 });
  }
  if (!VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: `Invalid mode. Use one of ${VALID_MODES.join(", ")}` }, { status: 400 });
  }
  if (!variants.every((v) => ["vibe", "system", "rebuild", "fork"].includes(v))) {
    return NextResponse.json({ error: "Invalid prompt variant" }, { status: 400 });
  }

  let llmSummary: string | undefined;
  let llmError: string | undefined;
  if (useLlm && (mode === "deep" || mode === "ultra")) {
    const provider = llmProvider ?? (process.env.DEFAULT_LLM_PROVIDER as LLMProvider) ?? "ollama";
    try {
      const { system, user } = buildSummaryRequest(analysis);
      llmSummary = await chat({ provider, model: llmModel, apiKey: llmApiKey, baseUrl: llmBaseUrl }, [
        { role: "system", content: system },
        { role: "user", content: user },
      ]);
    } catch (e: any) {
      llmError = e?.message ?? "LLM summary failed";
    }
  }

  const prompts = buildAll(analysis, mode, variants, llmSummary);
  return NextResponse.json({
    prompts,
    llmUsed: Boolean(llmSummary),
    llmError,
    availableProviders: availableProviders(),
  });
}

export async function GET() {
  return NextResponse.json({ availableProviders: availableProviders() });
}
