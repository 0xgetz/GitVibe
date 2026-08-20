import { createHash } from "node:crypto";

/** Deterministic short hash for cache keys (never for security decisions). */
export function shortHash(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 12);
}
