import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { ChallengeCredentialRow } from "./credential-data";

const DEMONSTRATED_LEVELS = new Set(["strong", "solid"]);

export interface CredentialSummary {
  id: string;
  submissionId: string;
  displayTitle: string;
  companyDisplayName: string;
  companyEndorsed: boolean;
  issuedAt: Date;
  demonstratedCriteria: string[];
}

/**
 * Everything the Profile page's "Verified work & challenges" section
 * needs, in ONE flat query — no joins, no per-item follow-up query, and
 * no signed artifact URL ever generated here (the whole point of the
 * snapshot design: every display field already lives on the row itself).
 * Only `issued` credentials — a revoked one is intentionally excluded
 * from this active-achievement list (still resolvable directly by anyone
 * who has its link, just not advertised here; docs/12 §9).
 */
export async function getStudentCredentialSummaries(studentId: string): Promise<CredentialSummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.challengeCredentials.id,
      submissionId: schema.challengeCredentials.submissionId,
      displayTitle: schema.challengeCredentials.displayTitle,
      companyDisplayName: schema.challengeCredentials.companyDisplayName,
      companyEndorsed: schema.challengeCredentials.companyEndorsed,
      issuedAt: schema.challengeCredentials.issuedAt,
      rubricSnapshot: schema.challengeCredentials.rubricSnapshot,
    })
    .from(schema.challengeCredentials)
    .where(and(eq(schema.challengeCredentials.studentId, studentId), eq(schema.challengeCredentials.status, "issued")))
    .orderBy(desc(schema.challengeCredentials.issuedAt));

  return rows.map((row) => ({
    id: row.id,
    submissionId: row.submissionId,
    displayTitle: row.displayTitle,
    companyDisplayName: row.companyDisplayName,
    companyEndorsed: row.companyEndorsed,
    issuedAt: row.issuedAt!,
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
