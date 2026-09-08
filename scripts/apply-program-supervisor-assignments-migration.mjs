// Idempotent applier for 0024_program_supervisor_assignments.sql — see
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
  const [{ relation }] = await sql`select to_regclass('public.program_supervisor_assignments')::text as relation`;
  if (relation) {
    console.log("program_supervisor_assignments already present — skipping.");
  } else {
    await applyStatements("../src/db/migrations/0024_program_supervisor_assignments.sql");
    console.log("Applied 0024 (program_supervisor_assignments table + RLS).");
  }
  console.log("Done. Existing records preserved.");
} finally {
  await sql.end({ timeout: 1 });
}
