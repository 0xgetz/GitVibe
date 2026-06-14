import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";

const url = (process.env.DATABASE_URL ?? "file:./data/gitvibe.db").replace(/^file:/, "");

const dir = dirname(url);
if (dir && dir !== "." && !existsSync(dir)) mkdirSync(dir, { recursive: true });

const sqlite = new Database(url);
sqlite.pragma("journal_mode = WAL");

// Lightweight auto-migration so `docker compose up` just works without a
// separate migrate step. Mirrors src/lib/db/schema.ts.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS prompts (
    id TEXT PRIMARY KEY,
    repo_full_name TEXT NOT NULL,
    repo_url TEXT NOT NULL,
    provider TEXT NOT NULL,
    mode TEXT NOT NULL,
    variant TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tokens INTEGER NOT NULL DEFAULT 0,
    insights TEXT,
    tags TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_prompts_created ON prompts(created_at DESC);
`);

export const db = drizzle(sqlite, { schema });
export { schema };
