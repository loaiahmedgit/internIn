import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { ChallengeCredentialRow } from "./credential-data";

const DEMONSTRATED_LEVELS = new Set(["strong", "solid"]);

export interface CredentialSummary {
  id: string;
  submissionId: string;
  status: "issued" | "revoked";
  displayTitle: string;
  companyDisplayName: string;
  companyEndorsed: boolean;
  companyEndorsedCapabilities: string[];
  issuedAt: Date | null;
  demonstratedCriteria: string[];
}

/**
 * Everything the Profile page's "Verified work & challenges" section
 * needs, in ONE flat query — no joins, no per-item follow-up query, and
 * no signed artifact URL ever generated here (the whole point of the
 * snapshot design: every display field already lives on the row itself).
 *
 * Includes BOTH `issued` and `revoked` credentials on purpose — a
 * revoked one is never advertised as active proof (the caller renders it
 * muted, "Credential revoked"), but it must still be excluded from the
 * page's older generic "evaluated challenge" fallback card, or a revoked
 * credential would silently reappear looking like ordinary valid Verified
 * Work. `pending_human_confirmation` is deliberately still excluded —
 * that state has its own panel on the application page (docs/12 §18),
 * never the Profile's permanent-achievement list.
 */
export async function getStudentCredentialSummaries(studentId: string): Promise<CredentialSummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.challengeCredentials.id,
      submissionId: schema.challengeCredentials.submissionId,
      status: schema.challengeCredentials.status,
      displayTitle: schema.challengeCredentials.displayTitle,
      companyDisplayName: schema.challengeCredentials.companyDisplayName,
      companyEndorsed: schema.challengeCredentials.companyEndorsed,
      companyEndorsedCapabilities: schema.challengeCredentials.companyEndorsedCapabilities,
      issuedAt: schema.challengeCredentials.issuedAt,
      revokedAt: schema.challengeCredentials.revokedAt,
      rubricSnapshot: schema.challengeCredentials.rubricSnapshot,
    })
    .from(schema.challengeCredentials)
    .where(and(eq(schema.challengeCredentials.studentId, studentId), inArray(schema.challengeCredentials.status, ["issued", "revoked"])))
    .orderBy(desc(schema.challengeCredentials.issuedAt));

  return rows.map((row) => ({
    id: row.id,
    submissionId: row.submissionId,
    status: row.status as "issued" | "revoked",
    displayTitle: row.displayTitle,
    companyDisplayName: row.companyDisplayName,
    companyEndorsed: row.companyEndorsed,
    companyEndorsedCapabilities: row.companyEndorsedCapabilities,
    issuedAt: row.issuedAt,
    demonstratedCriteria: row.rubricSnapshot.filter((entry) => DEMONSTRATED_LEVELS.has(entry.level)).map((entry) => entry.criterion),
  }));
}

/**
 * Full row for the student's own credential detail page — ownership
 * checked here (studentId must match), not left to the caller. Returns
 * null for "doesn't exist" and "exists but isn't this student's" alike —
 * the calling page reacts with `notFound()` either way, never
 * distinguishing the two to the caller.
 */
export async function getOwnedCredentialDetail(credentialId: string, studentId: string): Promise<ChallengeCredentialRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.challengeCredentials)
    .where(and(eq(schema.challengeCredentials.id, credentialId), eq(schema.challengeCredentials.studentId, studentId)))
    .limit(1);
  return row ?? null;
}
