import { eq } from "drizzle-orm";
import { getDb, schema } from "../src/db";

/**
 * Second explicit ask for named channel sources (LinkedIn, University
 * Portal, Job Boards, ...) on the Analytics "Source performance" table —
 * this is seed-only labeling for a fictional demo company (Skyline
 * Logistics is not a real business, none of these applications are real
 * traffic), not a claim that the live product tracks these channels. The
 * real classifyApplicationSource() used for actual applications is
 * untouched and still only ever assigns the 3 real, derivable buckets
 * (direct/referral/company_website).
 *
 * Reassigns every Skyline application's `source` (a free-text column) to a
 * weighted rotation across 5 realistic channel names, roughly matching the
 * reference's descending distribution (LinkedIn largest, Job Boards
 * smallest). Deterministic by row order — safe to re-run.
 */
const WEIGHTED_SOURCES = [
  "linkedin", "linkedin", "linkedin", "linkedin",
  "company_website", "company_website", "company_website",
  "employee_referral", "employee_referral",
  "university_portal", "university_portal",
  "job_boards",
];

async function main() {
  const db = getDb();
  const [company] = await db.select().from(schema.companies).where(eq(schema.companies.slug, "skyline-logistics"));
  if (!company) throw new Error("Skyline Logistics not found.");

  const apps = await db
    .select({ id: schema.applications.id })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .where(eq(schema.opportunities.companyId, company.id));

  for (let i = 0; i < apps.length; i++) {
    await db
      .update(schema.applications)
      .set({ source: WEIGHTED_SOURCES[i % WEIGHTED_SOURCES.length] })
      .where(eq(schema.applications.id, apps[i].id));
  }
  console.log(`Reassigned source on ${apps.length} applications across 5 named channels.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
