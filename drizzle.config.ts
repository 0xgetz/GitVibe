import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: (process.env.DATABASE_URL ?? "file:./data/gitvibe.db").replace(/^file:/, ""),
  },
} satisfies Config;
