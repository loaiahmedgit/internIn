// Idempotent applier for 0028_no_free_labor_safeguards.sql.
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
      where table_schema = 'public'
        and table_name = 'challenge_versions'
        and column_name = 'safeguard_policy_version'
    ) as has_column
  `;
  if (has_column) {
    console.log("R3 safeguard columns already present — skipping.");
  } else {
    await applyStatements("../src/db/migrations/0028_no_free_labor_safeguards.sql");
    console.log("Applied 0028 (assessment basis, version-bound confirmation, AI risk metadata, duration exception).");
  }
  console.log("Done. Existing rows remain honest pre-R3 records; no attestation was backfilled.");
} finally {
  await sql.end({ timeout: 1 });
}
