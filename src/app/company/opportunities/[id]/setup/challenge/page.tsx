import { and, desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import type { Challenge } from "@/lib/ai";
import { OpportunityChallengeReviewEditor } from "@/components/opportunities/opportunity-challenge-review-editor";

export default async function EditAttachedChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireCurrentCompanyMember("hiring_access");
  const db = getDb();

  const [opportunity] = await db
    .select()
    .from(schema.opportunities)
    .where(and(eq(schema.opportunities.id, id), eq(schema.opportunities.companyId, membership.companyId)))
    .limit(1);
  if (!opportunity) notFound();
  if (opportunity.status !== "draft") redirect(`/company/opportunities/${id}?tab=challenge`);

  const [challengeRow] = await db
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.opportunityId, id))
    .limit(1);
  if (!challengeRow) notFound();

  const [version] = challengeRow.currentVersionId
    ? await db.select().from(schema.challengeVersions).where(eq(schema.challengeVersions.id, challengeRow.currentVersionId)).limit(1)
    : await db
        .select()
        .from(schema.challengeVersions)
        .where(eq(schema.challengeVersions.challengeId, challengeRow.id))
        .orderBy(desc(schema.challengeVersions.versionNumber))
        .limit(1);
  if (!version) notFound();

  const challenge: Challenge = {
    title: version.title,
    scenario: version.scenario,
    estimatedMinutes: version.estimatedMinutes,
    estimatedDurationLabel: version.estimatedDurationLabel,
    skills: version.skills,
    tasks: version.tasks,
    deliverables: version.deliverables,
    files: version.files,
    rubric: version.rubric,
    submissionRequirements: version.submissionRequirements,
    status: challengeRow.status,
  };

  return <OpportunityChallengeReviewEditor opportunityId={id} role={opportunity.role} initialChallenge={challenge} />;
}
