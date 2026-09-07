import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { computeCredentialEligibility } from "./eligibility";
import { loadCredentialContext, toEligibilityInput, type ChallengeCredentialRow } from "./credential-data";
import { generateVerificationCode } from "./verification-code";
import type { CredentialEligibilityResult, CredentialPolicySnapshot } from "./types";

const MAX_CODE_ATTEMPTS = 5;

export interface IssuanceOutcome {
  outcome: "issued" | "pending_human_confirmation" | "already_exists" | "not_eligible";
  credential: ChallengeCredentialRow | null;
  eligibility: CredentialEligibilityResult;
}

/**
 * The one canonical issuance path (docs/12 §9). Always re-checks
 * eligibility server-side — never trusts a caller-supplied "it's
 * eligible" claim. Idempotent: if a row already governs this submission
 * (active or revoked), it's returned as-is, never duplicated — enforced
 * both by the eligibility check itself (an existing row short-circuits
 * before any insert is attempted) and, as a second line of defense, by
 * the DB's own partial unique index (`challenge_credentials_submission_active_uidx`)
 * via `onConflictDoNothing` + a re-select, which also makes a concurrent
 * double-issuance race safe (whichever insert wins, the loser's caller
 * gets the winner's row back, not an error and not a duplicate).
 */
export async function issueCredentialForSubmission(submissionId: string, actorUserId: string | null): Promise<IssuanceOutcome> {
  const context = await loadCredentialContext(submissionId);
  if (!context) throw new Error("Submission not found.");

  const eligibility = computeCredentialEligibility(toEligibilityInput(context));

  if (eligibility.existingCredentialId) {
    const existing = context.existingActiveCredential ?? context.mostRecentCredential;
    return { outcome: eligibility.state === "revoked" ? "not_eligible" : "already_exists", credential: existing, eligibility };
  }
  if (eligibility.state !== "eligible" && eligibility.state !== "pending_human_confirmation") {
    return { outcome: "not_eligible", credential: null, eligibility };
  }

  const status: "issued" | "pending_human_confirmation" = eligibility.state === "eligible" ? "issued" : "pending_human_confirmation";
  const isEndorsedPolicy = context.challenge.credentialPolicy === "company_endorsed";
  const policySnapshot: CredentialPolicySnapshot = {
    policy: isEndorsedPolicy ? "company_endorsed" : "internin_verified",
    requireHumanConfirmation: context.challenge.requireHumanConfirmation,
    showCompanyLogo: context.challenge.showCompanyLogo,
  };
  const now = new Date();
  const rubricSnapshot = (context.evidenceSummary?.metrics ?? []).map((m) => ({ criterion: m.criterion, level: m.level }));

  const db = getDb();
  let created: ChallengeCredentialRow | undefined;
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS && !created; attempt++) {
    const [row] = await db
      .insert(schema.challengeCredentials)
      .values({
        studentId: context.application.studentId,
        applicationId: context.application.id,
        submissionId: context.submission.id,
        challengeVersionId: context.submission.challengeVersionId,
        companyId: context.companyId,
        status,
        policySnapshot,
        companyEndorsed: status === "issued" && isEndorsedPolicy,
        companyEndorsedAt: status === "issued" && isEndorsedPolicy ? now : null,
        displayTitle: context.challengeVersion.title,
        companyDisplayName: context.companyDisplayName,
        skillsSnapshot: context.challengeVersion.skills,
        rubricSnapshot,
        completedAt: context.submission.submittedAt,
        verificationCode: generateVerificationCode(),
        issuedAt: status === "issued" ? now : null,
      })
      .onConflictDoNothing()
      .returning();
    created = row;
  }

  if (!created) {
    // Either every generated code collided (astronomically unlikely at 5
    // attempts), or a concurrent request already won the partial unique
    // index on submission_id — in both cases, the honest move is to
    // re-read the real current row rather than error or duplicate.
    const [existing] = await db
      .select()
      .from(schema.challengeCredentials)
      .where(and(eq(schema.challengeCredentials.submissionId, submissionId), isNull(schema.challengeCredentials.revokedAt)))
      .limit(1);
    if (existing) return { outcome: "already_exists", credential: existing, eligibility };
    throw new Error("Could not issue credential — verification code generation failed after retries.");
  }

  await db.insert(schema.eventLog).values({
    entityType: "challenge_credential",
    entityId: created.id,
    eventType: status === "issued" ? "credential_issued" : "credential_pending_confirmation",
    actorUserId,
    metadata: { submissionId, companyEndorsed: created.companyEndorsed },
  });

  return { outcome: status, credential: created, eligibility };
}
