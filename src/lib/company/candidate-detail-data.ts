import { eq, or, and, inArray, asc } from "drizzle-orm";
import { getDb, schema } from "@/db";

export interface CandidateDetail {
  applicationId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: "applied" | "shortlisted" | "invited" | "declined" | "withdrawn";
  appliedAt: Date;
  opportunityId: string;
  role: string;
  companyId: string;
  // Real student profile fields only — anything the schema doesn't collect (phone,
  // nationality, languages, GPA, a bio) is simply absent, never guessed.
  profile: {
    educationStage: string | null;
    university: string | null;
    major: string | null;
    graduationYear: number | null;
    location: string | null;
    skills: string[];
    opportunityTypes: string[];
    availability: string | null;
    cvUrl: string | null;
  } | null;
  submission: {
    id: string;
    submittedAt: Date;
    notes: string;
    artifacts: { name: string; url: string }[];
    aiUsageMode: "open" | "ai_allowed" | "restricted_ai" | "controlled";
  } | null;
  challenge: {
    title: string;
    scenario: string;
    skills: string[];
    tasks: { id: string; title: string; description: string }[];
    deliverables: string[];
    rubric: { criterion: string; description: string }[];
  } | null;
  evidence: {
    tasksCompleted: string;
    timeSpentMinutes: number;
    aiSummary: string;
    strength: string;
    weakness: string;
  } | null;
  offer: { id: string; status: "pending" | "accepted" | "declined" } | null;
  notes: { id: string; body: string; authorName: string; createdAt: Date }[];
  activity: { id: string; eventType: string; createdAt: Date }[];
}

/** Everything the candidate profile page needs, in one owner-checked read. Returns null if the application doesn't exist or belongs to a different company. */
export async function getCandidateDetail(applicationId: string, companyId: string): Promise<CandidateDetail | null> {
  const db = getDb();

  const [row] = await db
    .select({
      applicationId: schema.applications.id,
      studentId: schema.applications.studentId,
      status: schema.applications.status,
      appliedAt: schema.applications.createdAt,
      opportunityId: schema.applications.opportunityId,
      opportunityCompanyId: schema.opportunities.companyId,
      role: schema.opportunities.role,
      studentName: schema.users.fullName,
      studentEmail: schema.users.email,
    })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.users, eq(schema.applications.studentId, schema.users.id))
    .where(eq(schema.applications.id, applicationId))
    .limit(1);

  if (!row || row.opportunityCompanyId !== companyId) return null;

  const [profile] = await db
    .select({
      educationStage: schema.studentProfiles.educationStage,
      university: schema.studentProfiles.university,
      major: schema.studentProfiles.major,
      graduationYear: schema.studentProfiles.graduationYear,
      location: schema.studentProfiles.location,
      skills: schema.studentProfiles.skills,
      opportunityTypes: schema.studentProfiles.opportunityTypes,
      availability: schema.studentProfiles.availability,
      cvUrl: schema.studentProfiles.cvUrl,
    })
    .from(schema.studentProfiles)
    .where(eq(schema.studentProfiles.userId, row.studentId))
    .limit(1);

  const [submission] = await db
    .select()
    .from(schema.submissions)
    .where(eq(schema.submissions.applicationId, applicationId))
    .orderBy(schema.submissions.submittedAt)
    .limit(1);

  let challenge: CandidateDetail["challenge"] = null;
  let evidence: CandidateDetail["evidence"] = null;
  if (submission) {
    const [challengeVersion] = await db
      .select()
      .from(schema.challengeVersions)
      .where(eq(schema.challengeVersions.id, submission.challengeVersionId))
      .limit(1);
    if (challengeVersion) {
      challenge = {
        title: challengeVersion.title,
        scenario: challengeVersion.scenario,
        skills: challengeVersion.skills,
        tasks: challengeVersion.tasks,
        deliverables: challengeVersion.deliverables,
        rubric: challengeVersion.rubric,
      };
    }

    const [evidenceRow] = await db
      .select()
      .from(schema.candidateEvidence)
      .where(eq(schema.candidateEvidence.submissionId, submission.id))
      .limit(1);
    if (evidenceRow) {
      evidence = {
        tasksCompleted: evidenceRow.tasksCompleted,
        timeSpentMinutes: evidenceRow.timeSpentMinutes,
        aiSummary: evidenceRow.aiSummary,
        strength: evidenceRow.strength,
        weakness: evidenceRow.weakness,
      };
    }
  }

  const [offer] = await db
    .select({ id: schema.internshipOffers.id, status: schema.internshipOffers.status })
    .from(schema.internshipOffers)
    .where(eq(schema.internshipOffers.applicationId, applicationId))
    .limit(1);

  const noteRows = await db
    .select({
      id: schema.candidateNotes.id,
      body: schema.candidateNotes.body,
      createdAt: schema.candidateNotes.createdAt,
      authorName: schema.users.fullName,
    })
    .from(schema.candidateNotes)
    .innerJoin(schema.users, eq(schema.candidateNotes.authorUserId, schema.users.id))
    .where(eq(schema.candidateNotes.applicationId, applicationId))
    .orderBy(asc(schema.candidateNotes.createdAt));

  const activityEntityIds = submission ? [applicationId, submission.id] : [applicationId];
  const activityRows = await db
    .select({ id: schema.eventLog.id, eventType: schema.eventLog.eventType, createdAt: schema.eventLog.createdAt })
    .from(schema.eventLog)
    .where(
      or(
        and(eq(schema.eventLog.entityType, "application"), inArray(schema.eventLog.entityId, activityEntityIds)),
        and(eq(schema.eventLog.entityType, "submission"), inArray(schema.eventLog.entityId, activityEntityIds)),
      ),
    )
    .orderBy(asc(schema.eventLog.createdAt));

  return {
    applicationId: row.applicationId,
    studentId: row.studentId,
    studentName: row.studentName,
    studentEmail: row.studentEmail,
    status: row.status,
    appliedAt: row.appliedAt,
    opportunityId: row.opportunityId,
    role: row.role,
    companyId,
    profile: profile ?? null,
    submission: submission
      ? {
          id: submission.id,
          submittedAt: submission.submittedAt,
          notes: submission.notes,
          artifacts: submission.artifacts,
          aiUsageMode: submission.aiUsageMode,
        }
      : null,
    challenge,
    evidence,
    offer: offer ? { id: offer.id, status: offer.status } : null,
    notes: noteRows,
    activity: activityRows,
  };
}
