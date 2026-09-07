import type { EvidenceLevel } from "@/lib/ai/schemas";
import type { credentialPolicyEnum, credentialStatusEnum } from "@/db/schema";

/** Single source of truth for the two enum value sets — re-exported as
 * plain string-literal unions so service code isn't forced to import the
 * pgEnum column builder itself. */
export type CredentialPolicyValue = (typeof credentialPolicyEnum.enumValues)[number];
export type CredentialStatusValue = (typeof credentialStatusEnum.enumValues)[number];

/**
 * The full state a submission can be in with respect to a credential.
 * `not_eligible` | `pending_evaluation` | `eligible` are DERIVED — no row
 * exists in `challenge_credentials` for them (see that table's own
 * comment). `pending_human_confirmation` | `issued` | `revoked` mean a row
 * exists and IS that row's `status` (or, for `revoked`, that the most
 * recent row for this submission was revoked with no active reissue yet).
 */
export type CredentialEligibilityState = "not_eligible" | "pending_evaluation" | "eligible" | "pending_human_confirmation" | "issued" | "revoked";

export interface DemonstratedCriterion {
  criterion: string;
  level: EvidenceLevel;
}

/**
 * Structured output of the one canonical eligibility function
 * (`computeCredentialEligibility`). No UI or action re-implements this
 * logic — everything reads this shape.
 */
export interface CredentialEligibilityResult {
  state: CredentialEligibilityState;
  /** True only for eligible | pending_human_confirmation | issued. */
  eligible: boolean;
  /** Always present, human-readable — never blank, never a raw code. */
  reason: string;
  demonstratedCriteria: DemonstratedCriterion[];
  /** Labels of REQUIRED submission requirements whose evidence is still
   * flagged "requires human review" in the evaluation output — grounded in
   * evidence-evaluation.ts's own `unavailable` string convention, never
   * invented per-criterion state the evidence pipeline doesn't produce. */
  unresolvedRequiredArtifacts: string[];
  requiresHumanConfirmation: boolean;
  /** Set only when state is issued/revoked/pending_human_confirmation — the real row this state came from. */
  existingCredentialId?: string;
}

/** Frozen at issuance time — see docs/12-verified-challenge-credentials.md
 * "Immutable snapshot" and this session's endorsement-model correction:
 * this is a historical record of what governed issuance, not a live value. */
export interface CredentialPolicySnapshot {
  policy: "internin_verified" | "company_endorsed";
  requireHumanConfirmation: boolean;
  showCompanyLogo: boolean;
}
