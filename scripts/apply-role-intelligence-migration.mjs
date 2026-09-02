// The deployed database predates Drizzle's migration ledger. Apply only this
// additive role-intelligence migration instead of replaying older migrations.
import { readFile } from "node:fs/promises";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const sql = postgres(databaseUrl, { prepare: false, max: 1, connect_timeout: 10 });
try {
  const [{ relation }] = await sql`select to_regclass('public.role_profiles')::text as relation`;
  if (relation) {
    console.log("Role intelligence schema is already present.");
  } else {
    const migrationUrl = new URL("../src/db/migrations/0016_role_intelligence_foundation.sql", import.meta.url);
    const statements = (await readFile(migrationUrl, "utf8"))
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    await sql.begin(async (tx) => {
      for (const statement of statements) await tx.unsafe(statement);
    });
    console.log("Role intelligence schema applied. Existing records preserved.");
  }
} finally {
  await sql.end({ timeout: 1 });
}
