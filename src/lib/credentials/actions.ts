"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember, requireCurrentStudent } from "@/lib/auth";
import { computeCredentialEligibility } from "./eligibility";
import { loadCredentialContext, toEligibilityInput } from "./credential-data";
import { issueCredentialForSubmission } from "./issuance";
import { confirmPendingCredential, declineCredentialConfirmation } from "./confirmation";
import { withdrawCredentialEndorsement } from "./endorsement";
import { requestBaseCredentialReview } from "./revocation";

const IdSchema = z.string().uuid();
const ReasonSchema = z.object({ credentialId: z.string().uuid(), reason: z.string().trim().min(1).max(500) });

/** Never trusts a client-supplied submission id alone — same ownership-check shape as evidence-actions.ts's loadOwnedSubmission. */
async function loadCompanyOwnedSubmissionContext(submissionId: string) {
  const { membership } = await requireCurrentCompanyMember();
  const context = await loadCredentialContext(IdSchema.parse(submissionId));
  if (!context || context.companyId !== membership.companyId) throw new Error("Not authorized for this submission.");
  return context;
}

async function loadCompanyOwnedCredential(credentialId: string) {
  const { user, membership } = await requireCurrentCompanyMember();
  const db = getDb();
  const [credential] = await db
    .select()
    .from(schema.challengeCredentials)
    .where(eq(schema.challengeCredentials.id, IdSchema.parse(credentialId)))
    .limit(1);
  if (!credential || credential.companyId !== membership.companyId) throw new Error("Not authorized for this credential.");
  return { credential, user };
}

/** Read-only — a company reviewer inspecting a candidate's credential state. No UI wires this yet (Phase 4B). */
export async function getCredentialEligibilityAction(submissionId: string) {
  const context = await loadCompanyOwnedSubmissionContext(submissionId);
  return computeCredentialEligibility(toEligibilityInput(context));
}

/** Read-only — a student checking their own submission's credential state. No UI wires this yet (Phase 4B). */
export async function getMyCredentialEligibilityAction(submissionId: string) {
  const { user } = await requireCurrentStudent();
  const context = await loadCredentialContext(IdSchema.parse(submissionId));
  if (!context || context.application.studentId !== user.id) throw new Error("Not authorized for this submission.");
  return computeCredentialEligibility(toEligibilityInput(context));
}

/** Attempts issuance (or reaching pending_human_confirmation) — company-triggered, fully re-checked server-side. No UI wires this yet (Phase 4B). */
export async function issueChallengeCredentialAction(submissionId: string) {
  const { user } = await requireCurrentCompanyMember();
  await loadCompanyOwnedSubmissionContext(submissionId); // authorization check only — issuance service reloads its own context
  return issueCredentialForSubmission(IdSchema.parse(submissionId), user.id);
}

/** No UI wires this yet (Phase 4B). */
export async function confirmChallengeCredentialAction(credentialId: string) {
  const { credential, user } = await loadCompanyOwnedCredential(credentialId);
  return confirmPendingCredential(credential.id, user.id);
}

/** No UI wires this yet (Phase 4B). */
export async function declineChallengeCredentialAction(input: { credentialId: string; reason: string }) {
  const parsed = ReasonSchema.parse(input);
  const { credential, user } = await loadCompanyOwnedCredential(parsed.credentialId);
  return declineCredentialConfirmation(credential.id, user.id, parsed.reason);
}

/** No UI wires this yet (Phase 4B). */
export async function withdrawCredentialEndorsementAction(input: { credentialId: string; reason: string }) {
  const parsed = ReasonSchema.parse(input);
  const { credential, user } = await loadCompanyOwnedCredential(parsed.credentialId);
  return withdrawCredentialEndorsement(credential.id, user.id, parsed.reason);
}

/** Not a revoke — a signal for future internIn-admin tooling only. No UI wires this yet (Phase 4B). */
export async function requestBaseCredentialReviewAction(input: { credentialId: string; reason: string }) {
  const parsed = ReasonSchema.parse(input);
  const { credential, user } = await loadCompanyOwnedCredential(parsed.credentialId);
  await requestBaseCredentialReview(credential.id, user.id, parsed.reason);
}
