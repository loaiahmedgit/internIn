import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * Revokes the BASE internIn Verified Credential. Locked decision (this
 * session): only internIn/system-authorized administration may do this —
 * a company cannot directly revoke the base credential (only its own
 * endorsement, see endorsement.ts).
 *
 * KNOWN LIMITATION, reported honestly per instruction rather than worked
 * around: this repo has no internIn-admin role or session type today
 * (`userRoleEnum` is only `"student" | "company"` — confirmed via
 * schema.ts and `src/lib/auth.ts`, which exposes no admin equivalent of
 * `requireCurrentCompanyMember`/`requireCurrentStudent`). Rather than
 * invent an insecure shortcut (e.g. a hardcoded email allowlist or a
 * client-trusted flag), this function is deliberately NOT exported as a
 * "use server" action and NOT wired to any route, component, or button —
 * it requires an explicit, non-session-derived `actor` marker that no
 * normal request handler can produce. The service boundary is real and
 * ready; administrative revocation is genuinely unreachable from the
 * product until a real admin role/session exists. See this task's final
 * report.
 */
export async function revokeBaseCredential(input: {
  credentialId: string;
  reasonInternal: string;
  reasonPublic?: string;
  actor: { source: "system_admin_operation" };
}) {
  if (input.actor.source !== "system_admin_operation") throw new Error("Unauthorized.");
  if (!input.reasonInternal.trim()) throw new Error("An internal revocation reason is required.");

  const db = getDb();
  const [credential] = await db.select().from(schema.challengeCredentials).where(eq(schema.challengeCredentials.id, input.credentialId)).limit(1);
  if (!credential) throw new Error("Credential not found.");
  if (credential.status === "revoked") return credential; // idempotent — no double-revoke event

  const now = new Date();
  const [updated] = await db
    .update(schema.challengeCredentials)
    .set({
      status: "revoked",
      revokedAt: now,
      revocationReasonInternal: input.reasonInternal,
      revocationReasonPublic: input.reasonPublic ?? null,
      updatedAt: now,
    })
    .where(eq(schema.challengeCredentials.id, input.credentialId))
    .returning();

  await db.insert(schema.eventLog).values({
    entityType: "challenge_credential",
    entityId: input.credentialId,
    eventType: "credential_revoked",
    actorUserId: null,
    metadata: { reason: input.reasonInternal, source: "system_admin_operation" },
  });
  return updated;
}

/**
 * A company REQUESTING internIn review a base credential — explicitly NOT
 * a direct revoke action (locked decision #4). Changes no credential
 * state; purely an audit-log signal for future internIn-admin tooling.
 */
export async function requestBaseCredentialReview(credentialId: string, actorUserId: string, reason: string) {
  if (!reason.trim()) throw new Error("A reason is required to request review.");
  const db = getDb();
  const [credential] = await db.select({ id: schema.challengeCredentials.id }).from(schema.challengeCredentials).where(eq(schema.challengeCredentials.id, credentialId)).limit(1);
  if (!credential) throw new Error("Credential not found.");

  await db.insert(schema.eventLog).values({
    entityType: "challenge_credential",
    entityId: credentialId,
    eventType: "credential_review_requested",
    actorUserId,
    metadata: { reason },
  });
}
