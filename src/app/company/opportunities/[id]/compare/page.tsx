import { notFound } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
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

  const candidates = await Promise.all(
    applications.map(async (a) => {
      const [submission] = await db
        .select()
        .from(schema.submissions)
        .where(eq(schema.submissions.applicationId, a.applicationId))
        .orderBy(desc(schema.submissions.submittedAt))
        .limit(1);
      if (!submission) return null;

      const [evidence] = await db
        .select()
        .from(schema.candidateEvidence)
        .where(eq(schema.candidateEvidence.submissionId, submission.id))
        .limit(1);
      if (!evidence) return null;

      const [offer] = await db
        .select({ id: schema.internshipOffers.id })
        .from(schema.internshipOffers)
        .where(eq(schema.internshipOffers.applicationId, a.applicationId))
        .limit(1);

      return {
        applicationId: a.applicationId,
        applicationStatus: a.applicationStatus,
        studentName: a.studentName,
        submissionId: submission.id,
        alreadyInvited: !!offer,
      };
    }),
  );

  const evaluatedCandidates = candidates.filter((c): c is NonNullable<typeof c> => c !== null);

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
