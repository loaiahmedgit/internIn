"use server";

import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { compareCandidatesAction } from "@/lib/ai/actions";
import { evaluateCandidateEvidence } from "@/lib/company/evidence-evaluation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { CandidateEvidence } from "@/lib/ai";

const IdSchema = z.string().uuid();

/**
 * Loads a submission and everything needed to evaluate it, throwing unless
 * the signed-in company actually owns the opportunity it was submitted
 * against — never trusts a client-supplied submission id alone.
 */
async function loadOwnedSubmission(submissionId: string) {
  const { membership } = await requireCurrentCompanyMember();
  const db = getDb();

  const [row] = await db
    .select({
      submission: schema.submissions,
      application: schema.applications,
      opportunityCompanyId: schema.opportunities.companyId,
      studentName: schema.users.fullName,
      challengeVersion: schema.challengeVersions,
    })
    .from(schema.submissions)
    .innerJoin(schema.applications, eq(schema.submissions.applicationId, schema.applications.id))
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.users, eq(schema.applications.studentId, schema.users.id))
    .innerJoin(schema.challengeVersions, eq(schema.submissions.challengeVersionId, schema.challengeVersions.id))
    .where(eq(schema.submissions.id, submissionId))
    .limit(1);

  if (!row || row.opportunityCompanyId !== membership.companyId) {
    throw new Error("Not authorized for this submission.");
  }
  return row;
}

/**
 * Evaluates the exact, owner-checked submission and persists source excerpts.
 * No seeded task counts or model-generated hiring decisions are treated as facts.
 */
export async function generateCandidateEvidenceAction(submissionId: string) {
  const validatedId = IdSchema.parse(submissionId);
  const { user } = await requireCurrentCompanyMember();
  const { submission, application, challengeVersion, opportunityCompanyId } = await loadOwnedSubmission(validatedId);
  const evidenceSummary = await evaluateCandidateEvidence(application.id, opportunityCompanyId, submission.id);
  const timeSpentMinutes = application.challengeStartedAt ? Math.max(0, Math.round((submission.submittedAt.getTime() - application.challengeStartedAt.getTime()) / 60000)) : 0;

  // Derived from the real adaptive evaluation when one ran (real submission
  // evidence existed); otherwise an honest, non-invented fallback — never a
  // hardcoded "looks great" placeholder pretending to be a real finding.
  const tasksCompleted = evidenceSummary.metrics?.length
    ? `${evidenceSummary.metrics.filter((m) => m.level === "strong" || m.level === "solid").length}/${evidenceSummary.metrics.length} rubric criteria show real evidence`
    : "Not verified";
  const result = {
    aiSummary: evidenceSummary.metrics?.length
      ? [...(evidenceSummary.strengths ?? []), ...(evidenceSummary.gaps ?? [])].slice(0, 3).join(" ") || "Structured evidence is available below."
      : evidenceSummary.highlights.length
        ? "Source-linked evidence is available on the candidate profile."
        : "Submission materials are available, but no reliable evidence highlights have been evaluated yet.",
    strength: evidenceSummary.strengths?.[0] ?? "Review the source-linked evidence highlights.",
    weakness: evidenceSummary.gaps?.[0] ?? "Task completion and deliverable quality require human review.",
  };

  const db = getDb();
  const [evidence] = await db
    .insert(schema.candidateEvidence)
    .values({
      submissionId: submission.id,
      rubricVersionId: challengeVersion.id,
      tasksCompleted,
      timeSpentMinutes,
      aiSummary: result.aiSummary,
      strength: result.strength,
      weakness: result.weakness,
      evidenceSummary,
    })
    .onConflictDoUpdate({
      target: schema.candidateEvidence.submissionId,
      set: {
        rubricVersionId: challengeVersion.id,
        tasksCompleted,
        timeSpentMinutes,
        aiSummary: result.aiSummary,
        strength: result.strength,
        weakness: result.weakness,
        evidenceSummary,
        updatedAt: new Date(),
      },
    })
    .returning();

  await db.insert(schema.eventLog).values({
    entityType: "submission",
    entityId: submission.id,
    eventType: "evidence_generated",
    actorUserId: user.id,
  });
  revalidatePath(`/company/candidates/${application.id}`);
  revalidatePath(`/company/submissions/${submission.id}`);
  return evidence.id as string;
}

const SubmissionIdsSchema = z.array(IdSchema).min(2).max(20);

/**
 * Builds a side-by-side comparison across several already-evaluated
 * submissions. Requires every submission to already have generated
 * candidate_evidence — comparison is a read/derive step, not a place to
 * silently trigger generation for submissions the company hasn't looked at.
 */
export async function compareCandidateSubmissionsAction(submissionIds: string[]) {
  const validatedIds = SubmissionIdsSchema.parse(submissionIds);
  const db = getDb();

  const candidates: CandidateEvidence[] = [];
  let opportunityId: string | null = null;
  for (const submissionId of validatedIds) {
    const { submission, studentName, application } = await loadOwnedSubmission(submissionId);
    if (opportunityId && opportunityId !== application.opportunityId) throw new Error("Compare evidence within one internship only.");
    opportunityId = application.opportunityId;
    const [evidence] = await db
      .select()
      .from(schema.candidateEvidence)
      .where(eq(schema.candidateEvidence.submissionId, submission.id))
      .limit(1);
    if (!evidence) {
      throw new Error(`Generate an AI summary for ${studentName} before comparing.`);
    }
    candidates.push({
      candidateName: studentName,
      tasksCompleted: evidence.tasksCompleted,
      timeSpentMinutes: evidence.timeSpentMinutes,
      submissionSummary:
        submission.artifacts.length > 0 ? `${submission.artifacts.length} artifact(s) + written notes` : "Written notes only",
      aiSummary: evidence.aiSummary,
      strength: evidence.strength,
      weakness: evidence.weakness,
    });
  }

  return compareCandidatesAction(candidates);
}
