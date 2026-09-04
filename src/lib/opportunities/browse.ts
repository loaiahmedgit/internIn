import { getDb, schema } from "@/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { computeMatchScore } from "@/lib/matching";

/**
 * Published opportunities, optionally scored against a student's own
 * skills/interests. Shared by /opportunities (public browse, all visitors)
 * and /student/dashboard (the marketplace shown inline to signed-in
 * students) so the query and match logic never drifts between the two.
 */
export async function getOpportunitiesWithMatch(studentUserId?: string) {
  const db = getDb();
  const opportunities = await db
    .select({
      id: schema.opportunities.id,
      role: schema.opportunities.role,
      department: schema.opportunities.department,
      description: schema.opportunities.description,
      shortDescription: schema.opportunities.shortDescription,
      whatYouWillLearn: schema.opportunities.whatYouWillLearn,
      requirements: schema.opportunities.requirements,
      duration: schema.opportunities.duration,
      hoursPerWeek: schema.opportunities.hoursPerWeek,
      location: schema.opportunities.location,
      workMode: schema.opportunities.workMode,
      applicationDeadline: schema.opportunities.applicationDeadline,
      skills: schema.opportunities.skills,
      companyName: schema.companies.name,
      companyVerified: schema.companies.verified,
      createdAt: schema.opportunities.createdAt,
    })
    .from(schema.opportunities)
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(eq(schema.opportunities.status, "published"));

  const studentProfile = studentUserId
    ? (
        await db
          .select({ skills: schema.studentProfiles.skills, interests: schema.studentProfiles.interests })
          .from(schema.studentProfiles)
          .where(eq(schema.studentProfiles.userId, studentUserId))
          .limit(1)
      )[0]
    : undefined;

  const hasMatchData = Boolean(
    studentProfile && (studentProfile.skills.length > 0 || studentProfile.interests.length > 0),
  );
  const withMatch = opportunities.map((o) => ({
    ...o,
    matchScore: hasMatchData
      ? computeMatchScore(studentProfile!.skills, studentProfile!.interests, o.skills)
      : undefined,
  }));
  if (hasMatchData) withMatch.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));

  return { opportunities: withMatch, hasMatchData };
}

/** Plain helper (not a component) so calling Date.now() here never trips the render-purity lint rule. */
export function countCreatedWithinMs(items: { createdAt: Date }[], windowMs: number): number {
  const now = Date.now();
  return items.filter((o) => now - o.createdAt.getTime() < windowMs).length;
}

/**
 * Which opportunities actually have a Challenge a student can start — a
 * company can publish an opportunity before its Challenge is built. Shared
 * by Home, /student/opportunities, and /student/challenges so a "Start
 * challenge" CTA never appears for a challenge that doesn't exist, and so
 * the real estimated time (never invented) can show on cards.
 */
export async function getPublishedChallengeInfo(): Promise<
  Map<string, { estimatedMinutes: number; title: string; taskCount: number }>
> {
  const db = getDb();
  const rows = await db
    .select({
      opportunityId: schema.challenges.opportunityId,
      estimatedMinutes: schema.challengeVersions.estimatedMinutes,
      title: schema.challengeVersions.title,
      tasks: schema.challengeVersions.tasks,
    })
    .from(schema.challenges)
    .innerJoin(schema.challengeVersions, eq(schema.challenges.currentVersionId, schema.challengeVersions.id))
    .where(and(eq(schema.challenges.status, "published"), isNotNull(schema.challenges.currentVersionId)));
  return new Map(
    rows.map((r) => [
      r.opportunityId,
      { estimatedMinutes: r.estimatedMinutes, title: r.title, taskCount: r.tasks.length },
    ]),
  );
}
