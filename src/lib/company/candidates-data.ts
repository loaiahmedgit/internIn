import { eq, inArray, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";

export interface CandidateRow {
  applicationId: string;
  studentName: string;
  studentEmail: string;
  opportunityId: string;
  role: string;
  status: "applied" | "shortlisted" | "invited" | "declined" | "withdrawn";
  hasSubmission: boolean;
  submissionId: string | null;
  submittedAt: Date | null;
  /** Real free-text evidence summary — never a numeric fit score. */
  evidenceSummary: string | null;
  hasOffer: boolean;
}

/** Company-wide candidate list across every opportunity — the full applicant pool, not just the review queue. */
export async function getCompanyCandidates(companyId: string): Promise<{ rows: CandidateRow[]; roleOptions: { id: string; role: string }[] }> {
  const db = getDb();

  const opportunities = await db
    .select({ id: schema.opportunities.id, role: schema.opportunities.role })
    .from(schema.opportunities)
    .where(eq(schema.opportunities.companyId, companyId));
  const opportunityIds = opportunities.map((o) => o.id);
  const roleById = new Map(opportunities.map((o) => [o.id, o.role]));

  if (opportunityIds.length === 0) return { rows: [], roleOptions: [] };

  const applications = await db
    .select({
      id: schema.applications.id,
      opportunityId: schema.applications.opportunityId,
      status: schema.applications.status,
      studentName: schema.users.fullName,
      studentEmail: schema.users.email,
    })
    .from(schema.applications)
    .innerJoin(schema.users, eq(schema.applications.studentId, schema.users.id))
    .where(inArray(schema.applications.opportunityId, opportunityIds));
  const applicationIds = applications.map((a) => a.id);

  const submissions = applicationIds.length
    ? await db
        .select({
          id: schema.submissions.id,
          applicationId: schema.submissions.applicationId,
          submittedAt: schema.submissions.submittedAt,
        })
        .from(schema.submissions)
        .where(inArray(schema.submissions.applicationId, applicationIds))
        .orderBy(desc(schema.submissions.submittedAt))
    : [];
  const latestSubmissionByApplication = new Map<string, { id: string; submittedAt: Date }>();
  for (const s of submissions) {
    if (!latestSubmissionByApplication.has(s.applicationId)) latestSubmissionByApplication.set(s.applicationId, s);
  }
  const submissionIds = [...latestSubmissionByApplication.values()].map((s) => s.id);

  const evidenceRows = submissionIds.length
    ? await db
        .select({ submissionId: schema.candidateEvidence.submissionId, tasksCompleted: schema.candidateEvidence.tasksCompleted })
        .from(schema.candidateEvidence)
        .where(inArray(schema.candidateEvidence.submissionId, submissionIds))
    : [];
  const evidenceBySubmission = new Map(evidenceRows.map((e) => [e.submissionId, e.tasksCompleted]));

  const offers = applicationIds.length
    ? await db.select({ applicationId: schema.internshipOffers.applicationId }).from(schema.internshipOffers).where(inArray(schema.internshipOffers.applicationId, applicationIds))
    : [];
  const applicationIdsWithOffer = new Set(offers.map((o) => o.applicationId));

  const rows: CandidateRow[] = applications.map((a) => {
    const submission = latestSubmissionByApplication.get(a.id);
    const evidence = submission ? evidenceBySubmission.get(submission.id) : undefined;
    return {
      applicationId: a.id,
      studentName: a.studentName,
      studentEmail: a.studentEmail,
      opportunityId: a.opportunityId,
      role: roleById.get(a.opportunityId) ?? "",
      status: a.status,
      hasSubmission: !!submission,
      submissionId: submission?.id ?? null,
      submittedAt: submission?.submittedAt ?? null,
      evidenceSummary: evidence ?? null,
      hasOffer: applicationIdsWithOffer.has(a.id),
    };
  });

  return { rows, roleOptions: opportunities };
}
