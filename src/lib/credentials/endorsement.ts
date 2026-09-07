import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * A company withdrawing its endorsement — a live, mutable fact independent
 * of the base credential's own `status` (docs/12's endorsement-model
 * correction, this session's locked decision #2/#4). Never touches
 * `status`/`revokedAt` — the underlying internIn Verified Credential stays
 * `issued` regardless of endorsement state.
 */
export async function withdrawCredentialEndorsement(credentialId: string, actorUserId: string, reason: string) {
  const db = getDb();
  const [credential] = await db.select().from(schema.challengeCredentials).where(eq(schema.challengeCredentials.id, credentialId)).limit(1);
  if (!credential) throw new Error("Credential not found.");
  if (credential.status === "revoked") throw new Error("This credential has already been revoked.");
  if (!credential.companyEndorsed) throw new Error("This credential is not currently endorsed.");
  if (!reason.trim()) throw new Error("A reason is required to withdraw endorsement.");

  const now = new Date();
  const [updated] = await db
    .update(schema.challengeCredentials)
    .set({ companyEndorsed: false, endorsementWithdrawnAt: now, endorsementWithdrawalReason: reason, updatedAt: now })
    .where(eq(schema.challengeCredentials.id, credentialId))
    .returning();

  await db.insert(schema.eventLog).values({
    entityType: "challenge_credential",
    entityId: credentialId,
    eventType: "credential_endorsement_withdrawn",
    actorUserId,
    metadata: { reason },
  });
  return updated;
}
