import { eq } from "drizzle-orm";
import { getDb, schema } from "../src/db";

/**
 * Every seeded offer so far ends up "accepted" — real math, but it makes
 * offer acceptance a permanent, meaningless 100% (exactly the "seed data
 * produces meaningless 100% values" complaint). Flips 2 of the accepted
 * offers to "declined" (a real, plausible outcome) so the rate has actual
 * variance, and removes their now-inapplicable offer_accepted event.
 * Scoped to Skyline Logistics; safe to re-run (no-ops once fewer than 2
 * accepted offers remain).
 */
async function main() {
  const db = getDb();
  const [company] = await db.select().from(schema.companies).where(eq(schema.companies.slug, "skyline-logistics"));
  if (!company) throw new Error("Skyline Logistics not found.");

  const offers = await db
    .select({ id: schema.internshipOffers.id, status: schema.internshipOffers.status, applicationId: schema.internshipOffers.applicationId })
    .from(schema.internshipOffers)
    .innerJoin(schema.applications, eq(schema.internshipOffers.applicationId, schema.applications.id))
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .where(eq(schema.opportunities.companyId, company.id));

  const accepted = offers.filter((o) => o.status === "accepted");
  const toDecline = accepted.slice(0, 2);
  for (const offer of toDecline) {
    // Mirror respondToOfferAction's real decline path exactly: offer status,
    // application status, and the event log all move together.
    await db.update(schema.internshipOffers).set({ status: "declined" }).where(eq(schema.internshipOffers.id, offer.id));
    await db.update(schema.applications).set({ status: "declined" }).where(eq(schema.applications.id, offer.applicationId));
    await db.delete(schema.eventLog).where(eq(schema.eventLog.entityId, offer.id));
    await db.insert(schema.eventLog).values({
      entityType: "internship_offer",
      entityId: offer.id,
      eventType: "offer_declined",
    });
  }
  console.log(`Flipped ${toDecline.length} accepted offer(s) to declined for realistic acceptance-rate variance.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
