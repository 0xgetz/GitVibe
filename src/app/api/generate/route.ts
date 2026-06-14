import { NextResponse } from "next/server";
import { buildAll, buildSummaryRequest } from "@/lib/prompt/builders";
import { chat, availableProviders } from "@/lib/llm/client";
import { rateLimit, clientIp } from "@/lib/utils";
import type { AnalysisResult, ContextMode, LLMProvider, PromptVariant } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const ALL_VARIANTS: PromptVariant[] = ["vibe", "system", "rebuild", "fork"];

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`gen:${ip}`).ok) {
    return NextResponse.json({ error: "Rate limit exceeded. Slow down." }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const analysis = body?.analysis as AnalysisResult | undefined;
  const mode = (body?.mode ?? "standard") as ContextMode;
  const variants = (Array.isArray(body?.variants) && body.variants.length ? body.variants : ALL_VARIANTS) as PromptVariant[];
  const useLlm = Boolean(body?.useLlm);
  const llmProvider = body?.llmProvider as LLMProvider | undefined;
  const llmModel = body?.llmModel as string | undefined;
  const llmApiKey = body?.llmApiKey as string | undefined;

  if (!analysis?.meta) {
    return NextResponse.json({ error: "Missing `analysis` (run /api/analyze first)" }, { status: 400 });
  }

  let llmSummary: string | undefined;
  let llmError: string | undefined;
  if (useLlm && (mode === "deep" || mode === "ultra")) {
    const provider = llmProvider ?? (process.env.DEFAULT_LLM_PROVIDER as LLMProvider) ?? "ollama";
    try {
      const { system, user } = buildSummaryRequest(analysis);
      llmSummary = await chat({ provider, model: llmModel, apiKey: llmApiKey }, [
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
