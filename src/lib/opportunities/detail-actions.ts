"use server";

import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { getChallengeState } from "./challenge-state";
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

  const [saved, application] = await Promise.all([
    db.select({ id: schema.savedOpportunities.opportunityId }).from(schema.savedOpportunities).where(and(eq(schema.savedOpportunities.opportunityId, opportunityId), eq(schema.savedOpportunities.studentId, studentUserId))).limit(1),
    db
      .select({ id: schema.applications.id, challengeStartedAt: schema.applications.challengeStartedAt })
      .from(schema.applications)
      .where(and(eq(schema.applications.opportunityId, opportunityId), eq(schema.applications.studentId, studentUserId)))
      .limit(1),
  ]);
  const hasApplied = application.length > 0;

  const [challengeRow] = await db
    .select({ status: schema.challenges.status, currentVersionId: schema.challenges.currentVersionId })
    .from(schema.challenges)
    .where(eq(schema.challenges.opportunityId, opportunityId))
    .limit(1);

  let challenge: OpportunityDetail["challenge"];
  let resources: OpportunityDetail["resources"] = [];
  let deliverables: string[] = [];
  let submissionHasEvidence: boolean | undefined;

  if (challengeRow?.status === "published" && challengeRow.currentVersionId) {
    const [version] = await db
      .select({
        title: schema.challengeVersions.title,
        estimatedMinutes: schema.challengeVersions.estimatedMinutes,
        tasks: schema.challengeVersions.tasks,
        submissionRequirements: schema.challengeVersions.submissionRequirements,
      })
      .from(schema.challengeVersions)
      .where(eq(schema.challengeVersions.id, challengeRow.currentVersionId))
      .limit(1);
    if (version) {
      challenge = { title: version.title, taskCount: version.tasks.length, estimatedMinutes: version.estimatedMinutes };
      deliverables = version.submissionRequirements.map((r) => r.label);
      resources = await db
        .select({
          id: schema.challengeResources.id,
          name: schema.challengeResources.name,
          artifactKind: schema.challengeResources.artifactKind,
          resourceType: schema.challengeResources.resourceType,
          generationStatus: schema.challengeResources.generationStatus,
          sizeBytes: schema.challengeResources.sizeBytes,
        })
        .from(schema.challengeResources)
        .where(eq(schema.challengeResources.challengeVersionId, challengeRow.currentVersionId));
    }

    if (hasApplied) {
      const [submission] = await db
        .select({ id: schema.submissions.id })
        .from(schema.submissions)
        .where(eq(schema.submissions.applicationId, application[0].id))
        .limit(1);
      if (submission) {
        const [evidence] = await db.select({ submissionId: schema.candidateEvidence.submissionId }).from(schema.candidateEvidence).where(eq(schema.candidateEvidence.submissionId, submission.id)).limit(1);
        submissionHasEvidence = Boolean(evidence);
      }
    }
  }

  const challengeState = application.length
    ? getChallengeState({ challengePublished: Boolean(challenge), application: application[0], submission: submissionHasEvidence === undefined ? undefined : { hasEvidence: submissionHasEvidence } })
    : undefined;

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
          ctaLabel: challengeState?.kind === "to_do" ? "Start challenge" : challengeState?.kind === "in_progress" ? "Continue challenge" : "Open application",
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
