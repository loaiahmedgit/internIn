import "server-only";
import { cache } from "react";
import { and, eq, inArray, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCompanyMember } from "@/lib/auth";
import type { HiringApplication, HiringOpportunity } from "./hiring-metrics";

/** Hiring-only snapshot. Never loads program tasks or supervisor evaluations. */
export const getHiringData = cache(async (companyId: string) => {
  await requireCompanyMember(companyId);
  const db = getDb();
  const postings: HiringOpportunity[] = await db
    .select({
      id: schema.opportunities.id,
      role: schema.opportunities.role,
      status: schema.opportunities.status,
      location: schema.opportunities.location,
      workMode: schema.opportunities.workMode,
      applicationDeadline: schema.opportunities.applicationDeadline,
      createdAt: schema.opportunities.createdAt,
    })
    .from(schema.opportunities)
    .where(eq(schema.opportunities.companyId, companyId));
  const ids = postings.map((p) => p.id);
  if (!ids.length) return { postings, applications: [] as HiringApplication[] };
  const apps = await db
    .select({
      id: schema.applications.id,
      opportunityId: schema.applications.opportunityId,
      status: schema.applications.status,
      appliedAt: schema.applications.createdAt,
      source: schema.applications.source,
      name: schema.users.fullName,
    })
    .from(schema.applications)
    .innerJoin(schema.users, eq(schema.users.id, schema.applications.studentId))
    .where(inArray(schema.applications.opportunityId, ids));
  const appIds = apps.map((a) => a.id);
  if (!appIds.length)
    return { postings, applications: [] as HiringApplication[] };
  const [submissions, offers] = await Promise.all([
    db
      .select({
        applicationId: schema.submissions.applicationId,
        submittedAt: schema.submissions.submittedAt,
      })
      .from(schema.submissions)
      .where(inArray(schema.submissions.applicationId, appIds))
      .orderBy(desc(schema.submissions.submittedAt)),
    db
      .select()
      .from(schema.internshipOffers)
      .where(inArray(schema.internshipOffers.applicationId, appIds)),
  ]);
  const offerIds = offers.map((o) => o.id);
  const events = offerIds.length
    ? await db
        .select()
        .from(schema.eventLog)
        .where(
          and(
            inArray(schema.eventLog.entityId, offerIds),
            eq(schema.eventLog.eventType, "offer_accepted"),
          ),
        )
    : [];
  const submissionByApp = new Map<string, Date>();
  for (const s of submissions)
    if (!submissionByApp.has(s.applicationId))
      submissionByApp.set(s.applicationId, s.submittedAt);
  const offerByApp = new Map(offers.map((o) => [o.applicationId, o]));
  const rows: HiringApplication[] = apps.map((a) => {
    const offer = offerByApp.get(a.id);
    const acceptedAt =
      events
        .filter((e) => e.entityId === offer?.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
        ?.createdAt ?? null;
    return {
      ...a,
      submittedAt: submissionByApp.get(a.id) ?? null,
      offer: offer
        ? { status: offer.status, sentAt: offer.createdAt, acceptedAt }
        : null,
    };
  });
  return { postings, applications: rows };
});
