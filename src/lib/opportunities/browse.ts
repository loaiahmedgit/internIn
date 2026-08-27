import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
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
      duration: schema.opportunities.duration,
      hoursPerWeek: schema.opportunities.hoursPerWeek,
      location: schema.opportunities.location,
      skills: schema.opportunities.skills,
      companyName: schema.companies.name,
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
