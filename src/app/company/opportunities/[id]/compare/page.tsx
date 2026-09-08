import { notFound } from "next/navigation";
import { eq, and, inArray, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { CandidateComparisonView } from "@/components/opportunities/candidate-comparison-view";

export default async function CompareCandidatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { membership } = await requireCurrentCompanyMember();
  const db = getDb();

  const [opportunity] = await db
    .select()
    .from(schema.opportunities)
    .where(and(eq(schema.opportunities.id, id), eq(schema.opportunities.companyId, membership.companyId)))
    .limit(1);

  if (!opportunity) notFound();

  const applications = await db
    .select({
      applicationId: schema.applications.id,
      applicationStatus: schema.applications.status,
      studentName: schema.users.fullName,
    })
    .from(schema.applications)
    .innerJoin(schema.users, eq(schema.applications.studentId, schema.users.id))
    .where(eq(schema.applications.opportunityId, opportunity.id));

  const applicationIds = applications.map((a) => a.applicationId);

  const submissions = applicationIds.length
    ? await db
        .select({ id: schema.submissions.id, applicationId: schema.submissions.applicationId })
        .from(schema.submissions)
        .where(inArray(schema.submissions.applicationId, applicationIds))
        .orderBy(desc(schema.submissions.submittedAt))
    : [];
  const latestSubmissionByApplication = new Map<string, (typeof submissions)[number]>();
  for (const s of submissions) {
    if (!latestSubmissionByApplication.has(s.applicationId)) latestSubmissionByApplication.set(s.applicationId, s);
  }
  const submissionIds = [...latestSubmissionByApplication.values()].map((s) => s.id);

  const evidenceRows = submissionIds.length
    ? await db.select({ submissionId: schema.candidateEvidence.submissionId }).from(schema.candidateEvidence).where(inArray(schema.candidateEvidence.submissionId, submissionIds))
    : [];
  const submissionIdsWithEvidence = new Set(evidenceRows.map((e) => e.submissionId));

  const offers = applicationIds.length
    ? await db.select({ applicationId: schema.internshipOffers.applicationId }).from(schema.internshipOffers).where(inArray(schema.internshipOffers.applicationId, applicationIds))
    : [];
  const applicationIdsWithOffer = new Set(offers.map((o) => o.applicationId));

  const evaluatedCandidates = applications.flatMap((a) => {
    const submission = latestSubmissionByApplication.get(a.applicationId);
    if (!submission || !submissionIdsWithEvidence.has(submission.id)) return [];
    return [
      {
        applicationId: a.applicationId,
        applicationStatus: a.applicationStatus,
        studentName: a.studentName,
        submissionId: submission.id,
        alreadyInvited: applicationIdsWithOffer.has(a.applicationId),
      },
    ];
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Compare candidates</p>
      <h1 className="mt-1 text-2xl font-bold text-navy">{opportunity.role}</h1>

      {evaluatedCandidates.length < 2 ? (
        <p className="mt-10 text-navy/60">
          Need at least 2 candidates with a generated AI summary to compare. Go back and generate evidence
          for more submissions first.
        </p>
      ) : (
        <CandidateComparisonView candidates={evaluatedCandidates} />
      )}
    </div>
  );
}
