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
  const [{ relation }] = await sql`select to_regclass('public.challenge_resources')::text as relation`;
  if (relation) {
    console.log("challenge_resources/submission_artifacts tables already present — skipping schema migration.");
  } else {
    await applyStatements("../src/db/migrations/0017_icy_texas_twister.sql");
    console.log("Applied 0017 (challenge_resources, submission_artifacts, challenge_versions.submission_requirements).");
  }

  const [{ has_policy }] = await sql`
    select exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'challenge_resources' and policyname = 'challenge_resources_select'
    ) as has_policy
  `;
  if (has_policy) {
    console.log("challenge_resources RLS already present — skipping.");
  } else {
    await applyStatements("../src/db/migrations/0018_challenge_resources_rls.sql");
    console.log("Applied 0018 (RLS for challenge_resources/submission_artifacts + storage.objects policies).");
  }

  console.log("Done. Existing records preserved.");
} finally {
  await sql.end({ timeout: 1 });
}
