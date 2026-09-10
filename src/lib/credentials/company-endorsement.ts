import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

const DEMONSTRATED_LEVELS = new Set(["strong", "solid"]);

/**
 * The ONE place `companyEndorsed` is ever allowed to become true — R1's
 * central honesty fix. Never called from issuance/confirmation/AI
 * evaluation/shortlist/offer/hire; only from the explicit "Grant
 * certificate" action (credentials/actions.ts), itself gated on a real
 * certificate_approver assignment (responsibility-assignments.ts).
 */
export async function grantCredentialCompanyEndorsement(credentialId: string, actorUserId: string, capabilities: string[]) {
  const db = getDb();
  const [credential] = await db.select().from(schema.challengeCredentials).where(eq(schema.challengeCredentials.id, credentialId)).limit(1);
  if (!credential) throw new Error("Credential not found.");
  if (credential.status !== "issued") throw new Error("Only an issued evidence credential can receive a company endorsement.");
  if (credential.policySnapshot.policy !== "company_endorsed") throw new Error("Company endorsement isn't available for this credential's challenge policy.");
  if (credential.companyEndorsed) throw new Error("This credential is already endorsed.");

  // Server-validated subset — never trust client-supplied capability text
  // (R1 §8: "Do NOT let the reviewer type arbitrary unsupported skills").
  // The selectable set is exactly this credential's own frozen
  // rubricSnapshot, filtered to demonstrated (strong/solid) entries —
  // the same definition eligibility.ts's isDemonstrated already uses.
  const demonstratedCriteria = new Set(credential.rubricSnapshot.filter((entry) => DEMONSTRATED_LEVELS.has(entry.level)).map((entry) => entry.criterion));
  const validatedCapabilities = [...new Set(capabilities)].filter((c) => demonstratedCriteria.has(c));
  if (validatedCapabilities.length === 0) throw new Error("Select at least one evidence-backed capability to recognize.");
  if (validatedCapabilities.length !== new Set(capabilities).size) throw new Error("One or more selected capabilities aren't part of this credential's demonstrated evidence.");

  const now = new Date();
  const [updated] = await db
    .update(schema.challengeCredentials)
    .set({
      companyEndorsed: true,
      companyEndorsedAt: now,
      companyEndorsedByUserId: actorUserId,
      companyEndorsedCapabilities: validatedCapabilities,
      // A fresh grant supersedes any prior withdrawal on this same row —
      // the old withdrawal stays in event_log for history (R1 §13: never
      // erase the historical grant/withdrawal events).
      endorsementWithdrawnAt: null,
      endorsementWithdrawnByUserId: null,
      endorsementWithdrawalReason: null,
      updatedAt: now,
    })
    .where(eq(schema.challengeCredentials.id, credentialId))
    .returning();

  // Real audit data only — no chain-of-thought, no private evidence copy
  // (R1 §7). capabilities here are the same criterion label strings
  // already public on the credential's own rubricSnapshot.
  await db.insert(schema.eventLog).values({
    entityType: "challenge_credential",
    entityId: credentialId,
    eventType: "credential_company_endorsement_granted",
    actorUserId,
    metadata: { capabilities: validatedCapabilities },
  });

  return updated;
}
