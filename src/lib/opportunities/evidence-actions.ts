"use server";

import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { summarizeCandidateAction, compareCandidatesAction } from "@/lib/ai/actions";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Challenge, CandidateEvidence } from "@/lib/ai";

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
 * Generates (or regenerates) descriptive candidate evidence for one
 * submission and persists it. Factual fields (task count, time spent) are
 * computed here from real data, never taken from the AI's output — only the
 * descriptive summary/strength/weakness text comes from the model, and it's
 * grounded in the student's actual submission notes.
 */
export async function generateCandidateEvidenceAction(submissionId: string) {
  const validatedId = IdSchema.parse(submissionId);
  const { user } = await requireCurrentCompanyMember();
  const { submission, application, studentName, challengeVersion } = await loadOwnedSubmission(validatedId);

  const challenge: Challenge = {
    title: challengeVersion.title,
    scenario: challengeVersion.scenario,
    estimatedMinutes: challengeVersion.estimatedMinutes,
    skills: challengeVersion.skills,
    tasks: challengeVersion.tasks,
    deliverables: challengeVersion.deliverables,
    files: challengeVersion.files,
    rubric: challengeVersion.rubric,
    status: "published",
  };

  const result = await summarizeCandidateAction({
    candidateName: studentName,
    challenge,
    submissionNotes: submission.notes,
  });

  const timeSpentMinutes = Math.max(
    1,
    Math.round((submission.submittedAt.getTime() - application.createdAt.getTime()) / 60000),
  );
  const tasksCompleted = `${challenge.tasks.length}/${challenge.tasks.length}`;

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
  for (const submissionId of validatedIds) {
    const { submission, studentName } = await loadOwnedSubmission(submissionId);
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
