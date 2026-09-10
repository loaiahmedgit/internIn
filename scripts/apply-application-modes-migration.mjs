// Idempotent applier for 0027_application_modes.sql.
import { readFile } from "node:fs/promises";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const sql = postgres(databaseUrl, { prepare: false, max: 1, connect_timeout: 10 });

async function applyStatements(path) {
  const migrationUrl = new URL(path, import.meta.url);
  const statements = (await readFile(migrationUrl, "utf8"))
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  await sql.begin(async (tx) => {
    for (const statement of statements) await tx.unsafe(statement);
  });
}

try {
  const [{ has_column }] = await sql`
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'opportunities' and column_name = 'application_mode'
    ) as has_column
  `;
  if (has_column) {
    console.log("R2 application_mode column already present — skipping.");
  } else {
    await applyStatements("../src/db/migrations/0027_application_modes.sql");
    console.log("Applied 0027 (application_mode enum + opportunities.application_mode + conservative backfill).");
  }
  console.log("Done. Existing records preserved.");
} finally {
  await sql.end({ timeout: 1 });
}
