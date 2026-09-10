import { readFile } from "node:fs/promises";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 10 });
try {
  const duplicates = await sql`select application_id from public.submissions group by application_id having count(*) > 1`;
  if (duplicates.length) throw new Error("Existing duplicate submissions require review; no records were changed.");
  const migrations = await Promise.all(["0029_application_evidence_and_attempts.sql", "0030_universal_challenge_architect.sql"].map((name) => readFile(new URL(`../src/db/migrations/${name}`, import.meta.url), "utf8")));
  await sql.begin(async (tx) => {
    await tx`set local lock_timeout = '5s'`;
    for (const migration of migrations) for (const statement of migration.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await tx.unsafe(statement);
  });
  console.log("Applied 0029 and 0030 idempotently. No historical evidence or challenge assignments backfilled.");
} finally { await sql.end({ timeout: 1 }); }
