// Idempotent applier for 0023_challenge_credentials.sql — see
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
  const [{ relation }] = await sql`select to_regclass('public.challenge_credentials')::text as relation`;
  if (relation) {
    console.log("challenge_credentials already present — skipping.");
  } else {
    await applyStatements("../src/db/migrations/0023_challenge_credentials.sql");
    console.log(
      "Applied 0023 (credential_policy/credential_status enums, companies/challenges credential-policy columns, " +
        "challenge_credentials table + RLS). Existing challenges backfilled to credential_policy='off'; new " +
        "challenges default to 'internin_verified'. No credentials issued by this migration.",
    );
  }

  const [{ existing_off_count }] = await sql`
    select count(*)::int as existing_off_count from public.challenges where credential_policy = 'off'
  `;
  const [{ total_challenges }] = await sql`select count(*)::int as total_challenges from public.challenges`;
  const [{ total_companies }] = await sql`select count(*)::int as total_companies from public.companies`;
  console.log(`Challenges: ${total_challenges} total, ${existing_off_count} with credential_policy='off'.`);
  console.log(`Companies: ${total_companies} total.`);
  console.log("Done. Existing records preserved. No historical credential backfill/auto-issuance performed.");
} finally {
  await sql.end({ timeout: 1 });
}
