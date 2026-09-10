"use server";

import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import type { OpportunityDetail } from "@/components/student/explore-detail-panel";

const NEW_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Builds the full right-panel detail for exactly one opportunity, scoped to
 * the current student. This is what the split-view Explore page calls on
 * every row click (via getOpportunityDetailAction below) instead of a full
 * page navigation — so selecting a different result never touches the
 * page's scroll position or triggers a route transition. The very first
 * paint (a direct link, or the first result auto-selected) calls this same
 * function server-side from the page itself, so both paths share one
 * source of truth for what a "detail" actually contains.
 */
export async function loadOpportunityDetail(opportunityId: string, studentUserId: string): Promise<OpportunityDetail | null> {
  const db = getDb();

  const [row] = await db
    .select({
      id: schema.opportunities.id,
      role: schema.opportunities.role,
      description: schema.opportunities.description,
      shortDescription: schema.opportunities.shortDescription,
      location: schema.opportunities.location,
      workMode: schema.opportunities.workMode,
      duration: schema.opportunities.duration,
      hoursPerWeek: schema.opportunities.hoursPerWeek,
      applicationDeadline: schema.opportunities.applicationDeadline,
      skills: schema.opportunities.skills,
      requirements: schema.opportunities.requirements,
      whatYouWillLearn: schema.opportunities.whatYouWillLearn,
      createdAt: schema.opportunities.createdAt,
      applicationMode: schema.opportunities.applicationMode,
      companyName: schema.companies.name,
      companyVerified: schema.companies.verified,
      companyIndustry: schema.companies.industry,
      companySize: schema.companies.size,
    })
    .from(schema.opportunities)
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(and(eq(schema.opportunities.id, opportunityId), eq(schema.opportunities.status, "published")))
    .limit(1);
  if (!row) return null;

  // Independent of each other (each depends only on opportunityId /
  // studentUserId, already known) — fetched together instead of as three
  // separate round trips.
  const [saved, application, challengeRow] = await Promise.all([
    db.select({ id: schema.savedOpportunities.opportunityId }).from(schema.savedOpportunities).where(and(eq(schema.savedOpportunities.opportunityId, opportunityId), eq(schema.savedOpportunities.studentId, studentUserId))).limit(1),
    db
      .select({ id: schema.applications.id, challengeStartedAt: schema.applications.challengeStartedAt, assignedChallengeVersionId: schema.applications.assignedChallengeVersionId })
      .from(schema.applications)
      .where(and(eq(schema.applications.opportunityId, opportunityId), eq(schema.applications.studentId, studentUserId)))
      .limit(1),
    db
      .select({ status: schema.challenges.status, currentVersionId: schema.challenges.currentVersionId })
      .from(schema.challenges)
      .where(eq(schema.challenges.opportunityId, opportunityId))
      .limit(1)
      .then((rows) => rows[0]),
  ]);
  const hasApplied = application.length > 0;

  let challenge: OpportunityDetail["challenge"];
  let resources: OpportunityDetail["resources"] = [];
  let deliverables: string[] = [];

  if (row.applicationMode !== "quick_apply" && (application[0]?.assignedChallengeVersionId || (challengeRow?.status === "published" && challengeRow.currentVersionId))) {
    const [submitted] = hasApplied ? await db.select({ versionId: schema.submissions.challengeVersionId }).from(schema.submissions).where(eq(schema.submissions.applicationId, application[0].id)).limit(1) : [];
    const currentVersionId = submitted?.versionId ?? application[0]?.assignedChallengeVersionId ?? challengeRow!.currentVersionId!;
    // `version`/`resources` both depend only on currentVersionId (not on
    // each other); `submission` depends only on application[0].id — all
    // three run together instead of three serial round trips.
    const [[version], resourceRows] = await Promise.all([
      db
        .select({
          title: schema.challengeVersions.title,
          estimatedMinutes: schema.challengeVersions.estimatedMinutes,
          tasks: schema.challengeVersions.tasks,
          submissionRequirements: schema.challengeVersions.submissionRequirements,
          rubric: schema.challengeVersions.rubric,
        })
        .from(schema.challengeVersions)
        .where(eq(schema.challengeVersions.id, currentVersionId))
        .limit(1),
      db
        .select({
          id: schema.challengeResources.id,
          name: schema.challengeResources.name,
          artifactKind: schema.challengeResources.artifactKind,
          resourceType: schema.challengeResources.resourceType,
          generationStatus: schema.challengeResources.generationStatus,
          sizeBytes: schema.challengeResources.sizeBytes,
        })
        .from(schema.challengeResources)
        .where(eq(schema.challengeResources.challengeVersionId, currentVersionId)),
    ]);
    if (version) {
      challenge = {
        title: version.title,
        taskCount: version.tasks.length,
        estimatedMinutes: version.estimatedMinutes,
        tasks: version.tasks.map((t) => ({ id: t.id, title: t.title, description: t.description })),
        rubric: version.rubric,
      };
      deliverables = version.submissionRequirements.map((r) => r.label);
      resources = resourceRows;
    }

  }


  return {
    id: row.id,
    role: row.role,
    companyName: row.companyName,
    companyVerified: row.companyVerified,
    companyIndustry: row.companyIndustry,
    companySize: row.companySize,
    location: row.location,
    workMode: row.workMode,
    duration: row.duration,
    hoursPerWeek: row.hoursPerWeek,
    applicationDeadline: row.applicationDeadline,
    description: row.description,
    shortDescription: row.shortDescription,
    skills: row.skills,
    requirements: row.requirements,
    whatYouWillLearn: row.whatYouWillLearn,
    isNew: Date.now() - row.createdAt.getTime() < NEW_WITHIN_MS,
    saved: saved.length > 0,
    challenge,
    resources,
    deliverables,
    hasApplied,
    application: application.length
      ? {
          id: application[0].id,
          ctaLabel: "View application",
        }
      : undefined,
  };
}

/** Called client-side by the split-view Explore page on every row click —
 * never trusts a client-supplied student id, always re-derives the current
 * session's own student. */
export async function getOpportunityDetailAction(opportunityId: string): Promise<OpportunityDetail | null> {
  const { user } = await requireCurrentStudent();
  return loadOpportunityDetail(opportunityId, user.id);
}
