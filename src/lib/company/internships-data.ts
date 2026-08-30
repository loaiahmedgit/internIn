import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getHiringData } from "./hiring-data";
import { hiringMetrics } from "./hiring-metrics";
import type { InternshipActivityRow } from "./home-data";

/** Preserve the existing internship table model without loading program-management data. */
export async function getHiringInternships(companyId: string) {
  const snapshot = await getHiringData(companyId);
  const db = getDb();
  const ids = snapshot.postings.map((p) => p.id);
  if (!ids.length) return { internshipActivity: [] as InternshipActivityRow[] };
  const [postings, challenges] = await Promise.all([
    db
      .select()
      .from(schema.opportunities)
      .where(eq(schema.opportunities.companyId, companyId)),
    db
      .select()
      .from(schema.challenges)
      .where(inArray(schema.challenges.opportunityId, ids)),
  ]);
  const challengeByOpportunity = new Map(
    challenges.map((c) => [c.opportunityId, c]),
  );
  const internshipActivity: InternshipActivityRow[] = postings.map((p) => {
    const m = hiringMetrics(
      snapshot.applications.filter((a) => a.opportunityId === p.id),
    );
    const challengeStatus = challengeByOpportunity.get(p.id)?.status ?? "none";
    return {
      opportunityId: p.id,
      role: p.role,
      status: p.status,
      duration: p.duration,
      location: p.location,
      workMode: p.workMode,
      applicationDeadline: p.applicationDeadline,
      slots: p.slots,
      slotsFilled: m.accepted,
      hoursPerWeek: p.hoursPerWeek,
      description: p.description,
      skills: p.skills,
      applicantCount: m.applicants,
      candidatesToReview: m.toReview,
      challengeStatus:
        challengeStatus === "ai_generated" ? "draft" : challengeStatus,
      createdAt: p.createdAt,
    };
  });
  return { internshipActivity };
}
