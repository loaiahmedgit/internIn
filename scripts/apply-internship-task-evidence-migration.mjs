// Idempotent applier for 0025_internship_task_evidence.sql — see
// apply-student-profile-migration.mjs's own comment for why this DB
// applies migrations by exact filename rather than drizzle-kit migrate.
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
      where table_schema = 'public' and table_name = 'internship_tasks' and column_name = 'blocker_note'
    ) as has_column
  `;
  if (has_column) {
    console.log("internship_tasks evidence columns already present — skipping.");
  } else {
    await applyStatements("../src/db/migrations/0025_internship_task_evidence.sql");
    console.log("Applied 0025 (internship_task_status 'blocked' + blocker_note/evidence_note/evidence_url + student-edit guard trigger).");
  }
  console.log("Done. Existing records preserved.");
} finally {
  await sql.end({ timeout: 1 });
}
