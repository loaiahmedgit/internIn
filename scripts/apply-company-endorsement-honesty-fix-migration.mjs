// Idempotent applier for 0026_company_endorsement_honesty_fix.sql.
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
      where table_schema = 'public' and table_name = 'challenge_credentials' and column_name = 'company_endorsed_by_user_id'
    ) as has_column
  `;
  if (has_column) {
    console.log("R1 honesty-fix columns/table already present — skipping.");
  } else {
    await applyStatements("../src/db/migrations/0026_company_endorsement_honesty_fix.sql");
    console.log("Applied 0026 (opportunity_responsibility_assignments + challenge_credentials grant/withdrawal columns).");
  }
  console.log("Done. Existing records preserved.");
} finally {
  await sql.end({ timeout: 1 });
}
