import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { EvidenceSummary } from "@/lib/company/evidence-summary";
import type { EligibilityInput } from "./eligibility";

export type ChallengeCredentialRow = typeof schema.challengeCredentials.$inferSelect;

export interface CredentialContext {
  submission: typeof schema.submissions.$inferSelect;
  application: typeof schema.applications.$inferSelect;
  challenge: typeof schema.challenges.$inferSelect;
  challengeVersion: typeof schema.challengeVersions.$inferSelect;
  companyId: string;
  companyDisplayName: string;
  submittedArtifactLabels: string[];
  evidenceSummary: EvidenceSummary | null;
  /** Most recent non-revoked row for this submission, if any. */
  existingActiveCredential: ChallengeCredentialRow | null;
  /** Most recent row of any status, if any — used to surface "revoked" honestly instead of silently re-offering eligibility. */
  mostRecentCredential: ChallengeCredentialRow | null;
}

/**
 * Loads everything the eligibility/issuance services need for one
 * submission, from real tables only — no invented joins. Returns null when
 * the submission (or the challenge/company it resolves to) doesn't exist;
 * callers decide how to react. Ownership/authorization is NOT checked
 * here — callers (server actions) must verify the caller is allowed to see
 * this submission before calling this loader, same pattern as
 * `loadOwnedSubmission` in evidence-actions.ts.
 */
export async function loadCredentialContext(submissionId: string): Promise<CredentialContext | null> {
  const db = getDb();

  const [row] = await db
    .select({
      submission: schema.submissions,
      application: schema.applications,
      opportunityCompanyId: schema.opportunities.companyId,
      companyDisplayName: schema.companies.name,
      challengeVersion: schema.challengeVersions,
    })
    .from(schema.submissions)
    .innerJoin(schema.applications, eq(schema.submissions.applicationId, schema.applications.id))
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .innerJoin(schema.challengeVersions, eq(schema.submissions.challengeVersionId, schema.challengeVersions.id))
    .where(eq(schema.submissions.id, submissionId))
    .limit(1);
  if (!row) return null;

  const [challenge] = await db.select().from(schema.challenges).where(eq(schema.challenges.opportunityId, row.application.opportunityId)).limit(1);
  if (!challenge) return null;

  const artifactRows = await db.select({ label: schema.submissionArtifacts.label }).from(schema.submissionArtifacts).where(eq(schema.submissionArtifacts.submissionId, submissionId));

  const [evidence] = await db
    .select({ evidenceSummary: schema.candidateEvidence.evidenceSummary })
    .from(schema.candidateEvidence)
    .where(eq(schema.candidateEvidence.submissionId, submissionId))
    .limit(1);

  const credentialRows = await db
    .select()
    .from(schema.challengeCredentials)
    .where(eq(schema.challengeCredentials.submissionId, submissionId))
    .orderBy(desc(schema.challengeCredentials.createdAt));
  const mostRecentCredential = credentialRows[0] ?? null;
  const existingActiveCredential = credentialRows.find((c) => c.revokedAt === null) ?? null;

  return {
    submission: row.submission,
    application: row.application,
    challenge,
    challengeVersion: row.challengeVersion,
    companyId: row.opportunityCompanyId,
    companyDisplayName: row.companyDisplayName,
    submittedArtifactLabels: artifactRows.map((a) => a.label),
    evidenceSummary: evidence?.evidenceSummary ?? null,
    existingActiveCredential,
    mostRecentCredential,
  };
}

/** Maps a loaded context into the pure eligibility function's input shape. */
export function toEligibilityInput(context: CredentialContext): EligibilityInput {
  const existingCredential = context.existingActiveCredential
    ? { id: context.existingActiveCredential.id, status: context.existingActiveCredential.status }
    : context.mostRecentCredential?.status === "revoked"
      ? { id: context.mostRecentCredential.id, status: "revoked" as const }
      : null;

  return {
    credentialPolicy: context.challenge.credentialPolicy,
    requireHumanConfirmation: context.challenge.requireHumanConfirmation,
    submissionStatus: context.submission.status,
    rubric: context.challengeVersion.rubric.map((r) => ({ criterion: r.criterion, weight: r.weight })),
    requirements: context.challengeVersion.submissionRequirements,
    submittedArtifactLabels: context.submittedArtifactLabels,
    evidenceSummary: context.evidenceSummary,
    existingCredential,
  };
}
