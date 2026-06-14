import { NextResponse } from "next/server";
import { parseRepoUrl } from "@/lib/git/providers";
import { runAnalysis } from "@/lib/analyze/orchestrator";
import { rateLimit, clientIp, cacheGet, cacheSet } from "@/lib/utils";
import type { ContextMode, Provider } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`analyze:${ip}`);
  if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded. Slow down." }, { status: 429 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, mode = "standard", provider, host, token, ref, subpath } = body ?? {};
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing `url`" }, { status: 400 });
  }
  const validModes: ContextMode[] = ["quick", "standard", "deep", "ultra"];
  if (!validModes.includes(mode)) {
    return NextResponse.json({ error: `Invalid mode. Use one of ${validModes.join(", ")}` }, { status: 400 });
  }

  try {
    const repoRef = parseRepoUrl(url, {
      provider: provider as Provider | undefined,
      host,
      token,
      ref,
      subpath,
    });

    // Only cache anonymous (token-less) public analyses.
    const cacheKey = !token ? `an:${repoRef.provider}:${repoRef.owner}/${repoRef.repo}:${repoRef.ref ?? ""}:${repoRef.subpath ?? ""}:${mode}` : null;
    if (cacheKey) {
      const cached = cacheGet<any>(cacheKey);
      if (cached) return NextResponse.json({ ...cached, cached: true });
    }

    const result = await runAnalysis(repoRef, mode);
    const payload = { ref: { ...repoRef, token: undefined }, analysis: result };
    if (cacheKey) cacheSet(cacheKey, payload);
    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Analysis failed" }, { status: 502 });
  }
}
