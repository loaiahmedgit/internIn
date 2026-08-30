// The deployed database predates Drizzle's migration ledger. Apply only the
// additive Hiring Workspace columns; do not replay or baseline older migrations.
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 10 });
try {
  await sql.begin(async (tx) => {
    await tx`ALTER TABLE companies ADD COLUMN IF NOT EXISTS office_locations text`;
    await tx`ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_email text`;
    await tx`ALTER TABLE companies ADD COLUMN IF NOT EXISTS evidence_ai_enabled boolean NOT NULL DEFAULT true`;
    await tx`ALTER TABLE company_members ADD COLUMN IF NOT EXISTS permissions jsonb`;
    await tx`ALTER TABLE company_members ADD COLUMN IF NOT EXISTS submission_notifications boolean NOT NULL DEFAULT true`;
    await tx`ALTER TABLE company_members ADD COLUMN IF NOT EXISTS offer_notifications boolean NOT NULL DEFAULT true`;
    await tx`ALTER TABLE candidate_evidence ADD COLUMN IF NOT EXISTS evidence_summary jsonb`;
  });
  console.log("Hiring Workspace additive columns are ready. Existing records preserved.");
} finally { await sql.end({ timeout: 1 }); }
