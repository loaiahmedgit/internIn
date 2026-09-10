import type { EvidenceLevel } from "@/lib/ai/schemas";
import type { ChallengeCredentialRow } from "./credential-data";

/**
 * The ONE deliberately minimal public credential shape — §13 of
 * docs/12-verified-challenge-credentials.md. Never pass a raw
 * `challenge_credentials` row to a public-facing surface; always go
 * through `toPublicCredentialDto`. Every field here is safe to render on
 * an unauthenticated page. Explicitly excluded (never add back without
 * re-reading §13): student email, application id, submission id, student
 * id, company id, private artifact paths, candidate_evidence internals,
 * company/private notes, reviewer data, internal revocation reason.
 */
export interface PublicCredentialDto {
  studentDisplayName: string;
  displayTitle: string;
  companyDisplayName: string;
  companyEndorsed: boolean;
  /** Server-validated subset of demonstratedCriteria the company actually
   * recognized (R1 §15) — empty unless companyEndorsed is true. */
  companyEndorsedCapabilities: string[];
  companyEndorsedAt: string | null;
  /** Non-null only when an endorsement was granted and later withdrawn —
   * distinguishes "never granted" from "granted then withdrawn" (R1 §17).
   * The base evidence credential's own status is unaffected by this. */
  endorsementWithdrawnAt: string | null;
  issuedAt: string | null;
  completedAt: string;
  /** Only strong/solid entries from the snapshot — a weak/unresolved
   * criterion was never "demonstrated" and must never render as one,
   * even though the full evaluated set is kept in rubric_snapshot for
   * audit purposes. */
  demonstratedCriteria: { criterion: string; level: EvidenceLevel }[];
  verificationCode: string;
  status: "valid" | "revoked";
  /** Only present when status is "revoked" and the company/internIn chose to set one — never the internal reason. */
  revocationReasonPublic: string | null;
}

const DEMONSTRATED_LEVELS = new Set(["strong", "solid"]);

export function toPublicCredentialDto(row: ChallengeCredentialRow, studentDisplayName: string): PublicCredentialDto {
  return {
    studentDisplayName,
    displayTitle: row.displayTitle,
    companyDisplayName: row.companyDisplayName,
    companyEndorsed: row.companyEndorsed,
    companyEndorsedCapabilities: row.companyEndorsedCapabilities,
    companyEndorsedAt: row.companyEndorsedAt ? row.companyEndorsedAt.toISOString() : null,
    endorsementWithdrawnAt: row.endorsementWithdrawnAt ? row.endorsementWithdrawnAt.toISOString() : null,
    issuedAt: row.issuedAt ? row.issuedAt.toISOString() : null,
    completedAt: row.completedAt.toISOString(),
    demonstratedCriteria: row.rubricSnapshot.filter((entry) => DEMONSTRATED_LEVELS.has(entry.level)),
    verificationCode: row.verificationCode,
    status: row.revokedAt ? "revoked" : "valid",
    revocationReasonPublic: row.revokedAt ? row.revocationReasonPublic : null,
  };
}
