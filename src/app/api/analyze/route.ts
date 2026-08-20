import { NextResponse } from "next/server";
import { parseRepoUrl } from "@/lib/git/providers";
import { runAnalysis } from "@/lib/analyze/orchestrator";
import { rateLimit, clientIp, cacheGet, cacheSet, readJson } from "@/lib/utils";
import { shortHash } from "@/lib/server-hash";
import type { ContextMode, Provider } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`analyze:${ip}`);
  if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded. Slow down." }, { status: 429 });

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return NextResponse.json({ error: bodyRes.error }, { status: 400 });
  const body = bodyRes.value ?? {};

  const { url, mode = "standard", provider, host, token, ref, subpath } = body as {
    url?: unknown; mode?: unknown; provider?: unknown; host?: unknown;
    token?: unknown; ref?: unknown; subpath?: unknown;
  };
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing `url`" }, { status: 400 });
  }
  const validModes: ContextMode[] = ["quick", "standard", "deep", "ultra"];
  if (typeof mode !== "string" || !validModes.includes(mode as ContextMode)) {
    return NextResponse.json({ error: `Invalid mode. Use one of ${validModes.join(", ")}` }, { status: 400 });
  }

  try {
    const repoRef = await parseRepoUrl(url, {
      provider: (provider as Provider | undefined),
      host: (host as string | undefined),
      token: (token as string | undefined),
      ref: (ref as string | undefined),
      subpath: (subpath as string | undefined),
    });

    // Only cache anonymous (token-less) public analyses. When a token IS present,
    // include its hash in the key so private-repo results can't collide with
    // (or leak into) the anonymous cache.
    const cacheKey = !token
      ? `an:${repoRef.provider}:${repoRef.owner}/${repoRef.repo}:${repoRef.ref ?? ""}:${repoRef.subpath ?? ""}:${mode}`
      : `tok:${shortHash(String(token))}:${repoRef.provider}:${repoRef.owner}/${repoRef.repo}:${repoRef.ref ?? ""}:${repoRef.subpath ?? ""}:${mode}`;
    const cached = cacheGet<any>(cacheKey);
    if (cached) return NextResponse.json({ ...cached, cached: true });

    const result = await runAnalysis(repoRef, mode as ContextMode);
    const payload = { ref: { ...repoRef, token: undefined }, analysis: result };
    if (cacheKey) cacheSet(cacheKey, payload);
    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Analysis failed" }, { status: 502 });
  }
}
