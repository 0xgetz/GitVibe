import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET() {
  const rows = await db
    .select()
    .from(schema.prompts)
    .orderBy(desc(schema.prompts.createdAt))
    .limit(200);
  return NextResponse.json({ prompts: rows });
}

export async function POST(req: Request) {
  if (!rateLimit(`lib:${clientIp(req)}`).ok) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const required = ["repoFullName", "repoUrl", "provider", "mode", "variant", "title", "content"];
  for (const k of required) {
    if (!body?.[k]) return NextResponse.json({ error: `Missing field: ${k}` }, { status: 400 });
  }

  const row: schema.NewPrompt = {
    id: randomUUID(),
    repoFullName: body.repoFullName,
    repoUrl: body.repoUrl,
    provider: body.provider,
    mode: body.mode,
    variant: body.variant,
    title: body.title,
    content: body.content,
    tokens: Number(body.tokens ?? 0),
    insights: body.insights ? JSON.stringify(body.insights) : null,
    tags: Array.isArray(body.tags) ? body.tags.join(",") : (body.tags ?? null),
  };
  await db.insert(schema.prompts).values(row);
  return NextResponse.json({ ok: true, id: row.id });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await db.delete(schema.prompts).where(eq(schema.prompts.id, id));
  return NextResponse.json({ ok: true });
}
