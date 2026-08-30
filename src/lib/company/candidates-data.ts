import { eq, inArray, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";

export interface CandidateRow {
  applicationId: string;
  studentName: string;
  studentEmail: string;
  opportunityId: string;
  role: string;
  status: "applied" | "shortlisted" | "invited" | "declined" | "withdrawn";
  appliedAt: Date;
  hasSubmission: boolean;
  submissionId: string | null;
  submittedAt: Date | null;
  submissionNotes: string | null;
  hasCv: boolean;
  artifacts: { name: string; url: string }[];
  aiUsageMode: "open" | "ai_allowed" | "restricted_ai" | "controlled" | null;
  /** Real generated evidence — never a numeric fit score. Null until a company generates it. */
  evidence: {
    tasksCompleted: string;
    timeSpentMinutes: number;
    aiSummary: string;
    strength: string;
    weakness: string;
  } | null;
  offer: { id: string; status: "pending" | "accepted" | "declined" } | null;
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
      createdAt: schema.applications.createdAt,
      studentName: schema.users.fullName,
      studentEmail: schema.users.email,
      cvUrl: schema.studentProfiles.cvUrl,
    })
    .from(schema.applications)
    .innerJoin(schema.users, eq(schema.applications.studentId, schema.users.id))
    .leftJoin(schema.studentProfiles, eq(schema.studentProfiles.userId, schema.users.id))
    .where(inArray(schema.applications.opportunityId, opportunityIds));
  const applicationIds = applications.map((a) => a.id);

  const submissions = applicationIds.length
    ? await db
        .select({
          id: schema.submissions.id,
          applicationId: schema.submissions.applicationId,
          submittedAt: schema.submissions.submittedAt,
          notes: schema.submissions.notes,
          artifacts: schema.submissions.artifacts,
          aiUsageMode: schema.submissions.aiUsageMode,
        })
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
    ? await db
        .select({
          submissionId: schema.candidateEvidence.submissionId,
          tasksCompleted: schema.candidateEvidence.tasksCompleted,
          timeSpentMinutes: schema.candidateEvidence.timeSpentMinutes,
          aiSummary: schema.candidateEvidence.aiSummary,
          strength: schema.candidateEvidence.strength,
          weakness: schema.candidateEvidence.weakness,
        })
        .from(schema.candidateEvidence)
        .where(inArray(schema.candidateEvidence.submissionId, submissionIds))
    : [];
  const evidenceBySubmission = new Map(evidenceRows.map((e) => [e.submissionId, e]));

  const offers = applicationIds.length
    ? await db
        .select({ id: schema.internshipOffers.id, applicationId: schema.internshipOffers.applicationId, status: schema.internshipOffers.status })
        .from(schema.internshipOffers)
        .where(inArray(schema.internshipOffers.applicationId, applicationIds))
    : [];
  const offerByApplication = new Map(offers.map((o) => [o.applicationId, o]));

  const rows: CandidateRow[] = applications.map((a) => {
    const submission = latestSubmissionByApplication.get(a.id);
    const evidence = submission ? evidenceBySubmission.get(submission.id) : undefined;
    const offer = offerByApplication.get(a.id);
    return {
      applicationId: a.id,
      studentName: a.studentName,
      studentEmail: a.studentEmail,
      opportunityId: a.opportunityId,
      role: roleById.get(a.opportunityId) ?? "",
      status: a.status,
      appliedAt: a.createdAt,
      hasSubmission: !!submission,
      submissionId: submission?.id ?? null,
      submittedAt: submission?.submittedAt ?? null,
      submissionNotes: submission?.notes ?? null,
      hasCv: !!a.cvUrl,
      artifacts: submission?.artifacts ?? [],
      aiUsageMode: submission?.aiUsageMode ?? null,
      evidence: evidence
        ? {
            tasksCompleted: evidence.tasksCompleted,
            timeSpentMinutes: evidence.timeSpentMinutes,
            aiSummary: evidence.aiSummary,
            strength: evidence.strength,
            weakness: evidence.weakness,
          }
        : null,
      offer: offer ? { id: offer.id, status: offer.status } : null,
    };
  });

  return { rows, roleOptions: opportunities };
}
