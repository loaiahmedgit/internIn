// This DB predates Drizzle's migration ledger (see
// apply-role-intelligence-migration.mjs) — apply these two additive
// migrations directly instead of replaying the full history. Idempotent:
// skips whatever part is already present so it's safe to re-run.
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
  const [{ relation }] = await sql`select to_regclass('public.student_experience')::text as relation`;
  if (relation) {
    console.log("Student profile section tables already present — skipping schema migration.");
  } else {
    await applyStatements("../src/db/migrations/0018_clean_synch.sql");
    console.log("Applied 0018 (student_experience, student_education, student_portfolio_items, student_certifications, student_profile_links).");
  }

  const [{ has_policy }] = await sql`
    select exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'student_experience' and policyname = 'student_experience_select'
    ) as has_policy
  `;
  if (has_policy) {
    console.log("Student profile section RLS already present — skipping.");
  } else {
    await applyStatements("../src/db/migrations/0019_student_profile_sections_rls.sql");
    console.log("Applied 0019 (RLS + indexes for the 5 new student profile section tables).");
  }

  console.log("Done. Existing records preserved.");
} finally {
  await sql.end({ timeout: 1 });
}
