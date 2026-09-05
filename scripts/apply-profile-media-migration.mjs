// Idempotent applier for 0021_profile_media_columns.sql — see
// apply-student-profile-migration.mjs's own comment for why this DB applies
// migrations by exact filename rather than drizzle-kit migrate.
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
      where table_schema = 'public' and table_name = 'student_profiles' and column_name = 'avatar_url'
    ) as has_column
  `;
  if (has_column) {
    console.log("Profile media columns already present — skipping.");
  } else {
    await applyStatements("../src/db/migrations/0021_profile_media_columns.sql");
    console.log("Applied 0021 (student_profiles.avatar_url/banner_url, student_portfolio_items.attachment_url).");
  }
  console.log("Done. Existing records preserved.");
} finally {
  await sql.end({ timeout: 1 });
}
