import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── tiny in-memory rate limiter + analysis cache (no external deps) ─────────

const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string): { ok: boolean; remaining: number } {
  const max = Number(process.env.RATE_LIMIT_MAX ?? 30);
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
  const now = Date.now();
  const cur = hits.get(key);
  if (!cur || now > cur.reset) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: max - 1 };
  }
  cur.count++;
  return { ok: cur.count <= max, remaining: Math.max(0, max - cur.count) };
}

const cache = new Map<string, { value: unknown; expires: number }>();
const TTL = 10 * 60 * 1000;

export function cacheGet<T>(key: string): T | null {
  const e = cache.get(key);
  if (!e || Date.now() > e.expires) {
    cache.delete(key);
    return null;
  }
  return e.value as T;
}

export function cacheSet(key: string, value: unknown): void {
  if (cache.size > 200) cache.clear();
  cache.set(key, { value, expires: Date.now() + TTL });
}

export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "local"
  );
}
