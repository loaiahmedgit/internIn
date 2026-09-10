import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { computeCredentialEligibility } from "./eligibility";
import { loadCredentialContext, toEligibilityInput } from "./credential-data";

async function loadPendingCredential(credentialId: string) {
  const db = getDb();
  const [credential] = await db.select().from(schema.challengeCredentials).where(eq(schema.challengeCredentials.id, credentialId)).limit(1);
  if (!credential) throw new Error("Credential not found.");
  if (credential.status !== "pending_human_confirmation") throw new Error(`Credential is not awaiting confirmation (status: ${credential.status}).`);
  return credential;
}

/**
 * Confirms a credential that reached `pending_human_confirmation` — this
 * is about credential issuance only, never a hire/reject/shortlist/rank
 * action (docs/12 §11, this session's locked decisions). Re-checks
 * eligibility server-side before flipping status — a reviewer confirming
 * days later must not issue on evidence that no longer supports it.
 */
export async function confirmPendingCredential(credentialId: string, actorUserId: string) {
  const credential = await loadPendingCredential(credentialId);

  const context = await loadCredentialContext(credential.submissionId);
  if (!context) throw new Error("Submission not found.");
  // Recompute as if fresh — ignore this credential's own pending row so
  // the re-check reflects the evidence, not just "a pending row exists".
  const eligibility = computeCredentialEligibility({ ...toEligibilityInput(context), existingCredential: null });
  if (eligibility.state !== "eligible" && eligibility.state !== "pending_human_confirmation") {
    throw new Error(`Evidence no longer supports this credential: ${eligibility.reason}`);
  }

  const now = new Date();
  const db = getDb();
  // R1 honesty fix: confirming the base evidence credential means only
  // "the evidence credential may be issued" — it never implies company
  // endorsement, even when this challenge's policy is company_endorsed.
  // companyEndorsed is untouched here; it only ever changes via the
  // separate, explicit grantCredentialCompanyEndorsement action.
  const [updated] = await db
    .update(schema.challengeCredentials)
    .set({
      status: "issued",
      issuedAt: now,
      updatedAt: now,
    })
    .where(eq(schema.challengeCredentials.id, credentialId))
    .returning();

  await db.insert(schema.eventLog).values({
    entityType: "challenge_credential",
    entityId: credentialId,
    eventType: "credential_issued",
    actorUserId,
    metadata: { confirmedByReviewer: true },
  });
  return updated;
}

/**
 * A reviewer declining to confirm. This maps to `revoked` (the enum has no
 * separate "declined" state — a credential that was never actually issued
 * and won't be is, functionally, a terminated row, same as any other
 * revocation) rather than adding a fourth persisted status the locked
 * decisions didn't ask for. The distinct `credential_confirmation_declined`
 * event keeps this distinguishable from a real post-issuance revocation in
 * the audit trail.
 */
export async function declineCredentialConfirmation(credentialId: string, actorUserId: string, reason: string) {
  const credential = await loadPendingCredential(credentialId);
  if (!reason.trim()) throw new Error("A reason is required to decline confirmation.");

  const now = new Date();
  const db = getDb();
  const [updated] = await db
    .update(schema.challengeCredentials)
    .set({ status: "revoked", revokedAt: now, revokedByUserId: actorUserId, revocationReasonInternal: reason, updatedAt: now })
    .where(eq(schema.challengeCredentials.id, credential.id))
    .returning();

  await db.insert(schema.eventLog).values({
    entityType: "challenge_credential",
    entityId: credentialId,
    eventType: "credential_confirmation_declined",
    actorUserId,
    metadata: { reason },
  });
  return updated;
}
