import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/** Saved prompts — the personal Prompt Library. */
export const prompts = sqliteTable("prompts", {
  id: text("id").primaryKey(),
  repoFullName: text("repo_full_name").notNull(),
  repoUrl: text("repo_url").notNull(),
  provider: text("provider").notNull(),
  mode: text("mode").notNull(),
  variant: text("variant").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  tokens: integer("tokens").notNull().default(0),
  /** JSON blob of RepoInsights for quick display without re-analysis. */
  insights: text("insights"),
  tags: text("tags"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Prompt = typeof prompts.$inferSelect;
export type NewPrompt = typeof prompts.$inferInsert;
