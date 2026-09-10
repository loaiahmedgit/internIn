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
import { grantCredentialCompanyEndorsement } from "./company-endorsement";
import { requestBaseCredentialReview } from "./revocation";
import { hasOpportunityResponsibility } from "@/lib/opportunities/responsibility-assignments";

const IdSchema = z.string().uuid();
const ReasonSchema = z.object({ credentialId: z.string().uuid(), reason: z.string().trim().min(1).max(500) });
const GrantEndorsementSchema = z.object({
  credentialId: z.string().uuid(),
  capabilities: z.array(z.string().trim().min(1).max(160)).min(1).max(20),
});

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

/**
 * R1 §5 — the strict double-gate for endorsement grant/withdraw: real
 * company-level permission (hiring_reviewer, same base gate every other
 * credential action here uses) AND a real certificate_approver assignment
 * for the SPECIFIC opportunity this credential's application belongs to.
 * Deliberately NO workspace_admin bypass, unlike Phase 6A's
 * assertAssignedOrAdmin — R1 §5 explicitly: "do not allow company
 * permission alone to grant endorsement everywhere," and an admin's broad
 * permission is exactly that kind of "permission alone."
 */
async function loadCompanyOwnedCredentialForEndorsement(credentialId: string) {
  const { user, membership } = await requireCurrentCompanyMember();
  const db = getDb();
  const [row] = await db
    .select({ credential: schema.challengeCredentials, opportunityId: schema.applications.opportunityId })
    .from(schema.challengeCredentials)
    .innerJoin(schema.applications, eq(schema.challengeCredentials.applicationId, schema.applications.id))
    .where(eq(schema.challengeCredentials.id, IdSchema.parse(credentialId)))
    .limit(1);
  if (!row || row.credential.companyId !== membership.companyId) throw new Error("Not authorized for this credential.");
  const isCertificateApprover = await hasOpportunityResponsibility(row.opportunityId, membership.id, "certificate_approver");
  if (!isCertificateApprover) throw new Error("You're not an assigned certificate approver for this internship. Ask a workspace administrator to assign you.");
  return { credential: row.credential, user };
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

/**
 * R1 §5/§13 — withdrawal requires the same strict double-gate as granting,
 * not just any hiring_reviewer with company-level permission.
 */
export async function withdrawCredentialEndorsementAction(input: { credentialId: string; reason: string }) {
  const parsed = ReasonSchema.parse(input);
  const { credential, user } = await loadCompanyOwnedCredentialForEndorsement(parsed.credentialId);
  return withdrawCredentialEndorsement(credential.id, user.id, parsed.reason);
}

/**
 * R1 §5/§11 — the ONLY server action allowed to grant a company endorsement.
 * Gated on loadCompanyOwnedCredentialForEndorsement's strict double-gate
 * (real hiring_reviewer permission + real certificate_approver assignment
 * for this credential's opportunity, no admin bypass); the actual write and
 * capability-subset validation happen in grantCredentialCompanyEndorsement.
 */
export async function grantCredentialCompanyEndorsementAction(input: { credentialId: string; capabilities: string[] }) {
  const parsed = GrantEndorsementSchema.parse(input);
  const { credential, user } = await loadCompanyOwnedCredentialForEndorsement(parsed.credentialId);
  return grantCredentialCompanyEndorsement(credential.id, user.id, parsed.capabilities);
}

/** Not a revoke — a signal for future internIn-admin tooling only. No UI wires this yet (Phase 4B). */
export async function requestBaseCredentialReviewAction(input: { credentialId: string; reason: string }) {
  const parsed = ReasonSchema.parse(input);
  const { credential, user } = await loadCompanyOwnedCredential(parsed.credentialId);
  await requestBaseCredentialReview(credential.id, user.id, parsed.reason);
}
