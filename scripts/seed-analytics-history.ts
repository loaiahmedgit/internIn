import { eq, isNull } from "drizzle-orm";
import { getDb, schema } from "../src/db";

/**
 * Backfills the historical spread Analytics/Home actually need to render
 * something real: application dates across several weeks (not all bunched
 * in the last few days), real source attribution on every application
 * (never the "Not recorded" catch-all), and — the literal cause of the
 * "time to hire: Not available" bug — an `offer_accepted` event_log row for
 * every offer already marked "accepted", since hiringMetrics only trusts
 * that immutable event, never the mutable status column, for timing.
 *
 * Source stays restricted to the 3 buckets the product can actually derive
 * (see src/lib/opportunities/application-source.ts) — no LinkedIn/job-board/
 * campus-portal values, because this product has no such attribution
 * integration and inventing one here would be exactly the kind of fabricated
 * capability this codebase has deliberately avoided everywhere else.
 *
 * Safe to re-run: every write is a deterministic function of an
 * application's/offer's own row order, so re-running reproduces the same
 * spread rather than drifting further into the past each time.
 */

const REAL_SOURCES = ["direct", "referral", "company_website"] as const;

// Last 24 spread evenly across the most recent 29 days (dense enough for the
// default "Last 30 days" view); the remaining 6 pushed further back so
// "Last 90 days" also shows real history instead of a cliff.
function appliedDaysAgo(index: number, total: number): number {
  const recentCount = Math.min(24, total);
  if (index < recentCount) return Math.floor((index * 29) / Math.max(1, recentCount - 1));
  return 35 + (index - recentCount) * 8;
}

function daysAfter(date: Date, days: number, hourJitter: number): Date {
  return new Date(date.getTime() + days * 86_400_000 + hourJitter * 3_600_000);
}

async function main() {
  const db = getDb();
  const now = new Date();

  const [company] = await db.select().from(schema.companies).where(eq(schema.companies.slug, "skyline-logistics"));
  if (!company) throw new Error("Skyline Logistics not found.");
  console.log(`Using company: ${company.name} (${company.id})`);

  // --- 1. Give each posting a real, varied deadline + work mode ---
  const opportunities = await db.select().from(schema.opportunities).where(eq(schema.opportunities.companyId, company.id));
  const deadlineDaysFromNow: Record<string, number> = {
    "Product Operations Intern": 5, // inside the 7-day "expiring soon" window on purpose
    "Marketing Intern": 12,
    "Customer Success Intern": 20,
    "Data Analyst Intern": 30,
    "Finance Intern": 45,
  };
  const workModeByRole: Record<string, "onsite" | "hybrid" | "remote"> = {
    "Product Operations Intern": "hybrid",
    "Marketing Intern": "onsite",
    "Customer Success Intern": "onsite",
    "Data Analyst Intern": "hybrid",
    "Finance Intern": "remote",
  };
  for (const opp of opportunities) {
    const patch: Partial<typeof schema.opportunities.$inferInsert> = {};
    const days = deadlineDaysFromNow[opp.role];
    if (days !== undefined && !opp.applicationDeadline) {
      patch.applicationDeadline = new Date(now.getTime() + days * 86_400_000);
    }
    const mode = workModeByRole[opp.role];
    if (mode) patch.workMode = mode;
    if (Object.keys(patch).length > 0) {
      await db.update(schema.opportunities).set(patch).where(eq(schema.opportunities.id, opp.id));
    }
  }
  console.log(`Backfilled deadlines/work mode on ${opportunities.length} postings.`);

  // --- 2. Backfill missing source attribution (never leave it null/"unknown") ---
  const nullSourceApps = await db
    .select({ id: schema.applications.id })
    .from(schema.applications)
    .where(isNull(schema.applications.source));
  const skylineAppIds = new Set(
    (
      await db
        .select({ id: schema.applications.id })
        .from(schema.applications)
        .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
        .where(eq(schema.opportunities.companyId, company.id))
    ).map((a) => a.id),
  );
  let sourcesBackfilled = 0;
  for (let i = 0; i < nullSourceApps.length; i++) {
    const app = nullSourceApps[i];
    if (!skylineAppIds.has(app.id)) continue;
    await db.update(schema.applications).set({ source: REAL_SOURCES[i % REAL_SOURCES.length] }).where(eq(schema.applications.id, app.id));
    sourcesBackfilled++;
  }
  console.log(`Backfilled source on ${sourcesBackfilled} applications.`);

  // --- 3. Spread appliedAt/submittedAt/offer sentAt across real history ---
  const apps = await db
    .select({
      id: schema.applications.id,
      createdAt: schema.applications.createdAt,
    })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .where(eq(schema.opportunities.companyId, company.id));

  let timestampsUpdated = 0;
  for (let i = 0; i < apps.length; i++) {
    const app = apps[i];
    const hourJitter = (i * 7) % 24;
    const appliedAt = daysAfter(now, -appliedDaysAgo(i, apps.length), hourJitter);
    await db.update(schema.applications).set({ createdAt: appliedAt }).where(eq(schema.applications.id, app.id));

    const [submission] = await db.select().from(schema.submissions).where(eq(schema.submissions.applicationId, app.id)).limit(1);
    let submittedAt: Date | null = null;
    if (submission) {
      submittedAt = daysAfter(appliedAt, 1 + (i % 3), (i * 3) % 24);
      if (submittedAt > now) submittedAt = now;
      await db.update(schema.submissions).set({ submittedAt }).where(eq(schema.submissions.id, submission.id));
    }

    const [offer] = await db.select().from(schema.internshipOffers).where(eq(schema.internshipOffers.applicationId, app.id)).limit(1);
    if (offer) {
      let sentAt = daysAfter(submittedAt ?? appliedAt, 1 + (i % 4), (i * 5) % 24);
      if (sentAt > now) sentAt = now;
      await db.update(schema.internshipOffers).set({ createdAt: sentAt }).where(eq(schema.internshipOffers.id, offer.id));

      if (offer.status === "accepted") {
        const [existingEvent] = await db
          .select()
          .from(schema.eventLog)
          .where(eq(schema.eventLog.entityId, offer.id))
          .limit(1);
        let acceptedAt = daysAfter(sentAt, 1 + (i % 5), (i * 11) % 24);
        if (acceptedAt > now) acceptedAt = now;
        if (existingEvent) {
          await db.update(schema.eventLog).set({ createdAt: acceptedAt }).where(eq(schema.eventLog.id, existingEvent.id));
        } else {
          await db.insert(schema.eventLog).values({
            entityType: "internship_offer",
            entityId: offer.id,
            eventType: "offer_accepted",
            createdAt: acceptedAt,
          });
        }
      }
    }
    timestampsUpdated++;
  }
  console.log(`Rebuilt applied/submitted/offer/acceptance timestamps for ${timestampsUpdated} applications.`);

  console.log("Done. Analytics and Home should now show real weekly history, real sources, and a real time-to-hire.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
