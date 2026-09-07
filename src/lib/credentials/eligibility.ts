import type { EvidenceSummary } from "@/lib/company/evidence-summary";
import type { SubmissionRequirement } from "@/lib/challenges/submission-model";
import type { CredentialEligibilityResult, CredentialPolicyValue } from "./types";

/**
 * The one canonical eligibility function — see docs/12-verified-challenge-
 * credentials.md §6/§7 and this session's locked decisions. Pure and
 * DB-free on purpose: it reads only real, already-fetched project types
 * (RubricMetric/EvidenceSummary via candidate_evidence, SubmissionRequirement
 * from challenge_versions, the real submission/policy state) so it can be
 * unit-tested directly and so it stays correct automatically when the
 * Assessment Agent (Phase 7) replaces what PRODUCES an EvidenceSummary —
 * this function only ever consumes the shape, never how it was made.
 *
 * No numeric public score is computed or returned. Rubric `weight` is used
 * internally (this challenge schema supports it — RubricCriterionSchema)
 * to weight coverage when criterion text matches; the schema does NOT
 * support a required/"critical criteria" flag, so none is fabricated here.
 */

/**
 * Locked product-owner decision (Phase 4A closure): a Verified Challenge
 * Credential must represent meaningful demonstrated capability — weighted
 * coverage of demonstrated (strong/solid) rubric criteria must reach 70%
 * of the evaluated rubric weight, not 50%. This number is never surfaced
 * publicly — the public/student-facing UX only ever shows the demonstrated
 * criteria list (§8 of docs/12), never a score or this threshold.
 */
const MINIMUM_DEMONSTRATED_COVERAGE = 0.7;

export interface EligibilityInput {
  credentialPolicy: CredentialPolicyValue;
  requireHumanConfirmation: boolean;
  /** Null when no submission exists yet for this application/challenge. */
  submissionStatus: "submitted" | "reviewed" | null;
  /** challenge_versions.rubric — {criterion, weight}. May be empty on very old rows. */
  rubric: { criterion: string; weight: number }[];
  /** challenge_versions.submissionRequirements — real `required` flags, never inferred. */
  requirements: SubmissionRequirement[];
  /** Labels submission_artifacts rows actually carry for this submission (artifact.label || requirement.label at submit time). */
  submittedArtifactLabels: string[];
  /** null = evaluation hasn't run; present = candidate_evidence.evidenceSummary. */
  evidenceSummary: EvidenceSummary | null;
  /** The most recent challenge_credentials row for this submission, if any (active or revoked). */
  existingCredential: { id: string; status: "pending_human_confirmation" | "issued" | "revoked" } | null;
}

/** A criterion counts as "demonstrated" at strong/solid, "weak" at
 * insufficient/not_demonstrated — "developing" counts toward neither
 * bucket (real signal, not yet a demonstration and not a failure either). */
function isDemonstrated(level: string) {
  return level === "strong" || level === "solid";
}

/** Weighted coverage of demonstrated criteria over the challenge's real
 * rubric weights. Falls back to equal weighting for any metric whose
 * criterion text doesn't match a rubric entry (paraphrase, or a rubric row
 * with no weight set) — never blocks the rule on a fragile string match. */
function weightedDemonstratedCoverage(metrics: { criterion: string; level: string }[], rubric: { criterion: string; weight: number }[]) {
  const rubricWeightByCriterion = new Map(rubric.filter((r) => r.weight > 0).map((r) => [r.criterion.trim().toLowerCase(), r.weight]));
  let demonstratedWeight = 0;
  let totalWeight = 0;
  for (const metric of metrics) {
    const weight = rubricWeightByCriterion.get(metric.criterion.trim().toLowerCase());
    const effectiveWeight = weight ?? 1;
    totalWeight += effectiveWeight;
    if (isDemonstrated(metric.level)) demonstratedWeight += effectiveWeight;
  }
  return totalWeight > 0 ? demonstratedWeight / totalWeight : 0;
}

export function computeCredentialEligibility(input: EligibilityInput): CredentialEligibilityResult {
  const empty = { demonstratedCriteria: [], unresolvedRequiredArtifacts: [], requiresHumanConfirmation: input.requireHumanConfirmation };

  if (input.existingCredential) {
    return {
      state: input.existingCredential.status,
      eligible: input.existingCredential.status !== "revoked",
      reason:
        input.existingCredential.status === "issued"
          ? "A Verified Challenge Credential has already been issued for this submission."
          : input.existingCredential.status === "pending_human_confirmation"
            ? "This credential is awaiting reviewer confirmation."
            : "The credential for this submission was revoked. Reissuance is a separate, deliberate action — not automatic.",
      existingCredentialId: input.existingCredential.id,
      ...empty,
    };
  }

  if (input.credentialPolicy === "off") {
    return { state: "not_eligible", eligible: false, reason: "Credential issuance is turned off for this challenge.", ...empty };
  }

  if (!input.submissionStatus) {
    return { state: "not_eligible", eligible: false, reason: "No submission exists for this application yet.", ...empty };
  }
  if (input.submissionStatus !== "submitted" && input.submissionStatus !== "reviewed") {
    return { state: "not_eligible", eligible: false, reason: `Submission status "${input.submissionStatus}" does not qualify.`, ...empty };
  }

  if (!input.evidenceSummary) {
    return { state: "pending_evaluation", eligible: false, reason: "Evidence evaluation has not run yet for this submission.", ...empty };
  }

  const metrics = input.evidenceSummary.metrics ?? [];
  if (metrics.length === 0 || !input.evidenceSummary.confidence) {
    return {
      state: "not_eligible",
      eligible: false,
      reason: "Evidence evaluation completed but produced no usable rubric metrics — this credential remains unavailable, not fabricated from an empty result.",
      ...empty,
    };
  }

  const requiredLabels = new Set(input.requirements.filter((r) => r.required).map((r) => r.label));
  const submittedRequiredLabels = input.submittedArtifactLabels.filter((label) => requiredLabels.has(label));
  const unavailable = input.evidenceSummary.unavailable ?? [];
  const unresolvedRequiredArtifacts = submittedRequiredLabels.filter((label) => unavailable.some((entry) => entry.startsWith(`${label}:`)));

  const demonstratedCriteria = metrics.filter((m) => isDemonstrated(m.level)).map((m) => ({ criterion: m.criterion, level: m.level }));
  const coverage = weightedDemonstratedCoverage(metrics, input.rubric);
  const sufficientConfidence = input.evidenceSummary.confidence === "medium" || input.evidenceSummary.confidence === "high";
  const sufficientCoverage = coverage >= MINIMUM_DEMONSTRATED_COVERAGE && demonstratedCriteria.length >= 1;

  if (unresolvedRequiredArtifacts.length > 0) {
    return {
      state: "not_eligible",
      eligible: false,
      reason: `Required evidence still needs human review: ${unresolvedRequiredArtifacts.join(", ")}.`,
      demonstratedCriteria,
      unresolvedRequiredArtifacts,
      requiresHumanConfirmation: input.requireHumanConfirmation,
    };
  }
  if (!sufficientConfidence) {
    return {
      state: "not_eligible",
      eligible: false,
      reason: `Evaluation confidence ("${input.evidenceSummary.confidence}") is too low for a credential.`,
      demonstratedCriteria,
      unresolvedRequiredArtifacts: [],
      requiresHumanConfirmation: input.requireHumanConfirmation,
    };
  }
  if (!sufficientCoverage) {
    return {
      state: "not_eligible",
      eligible: false,
      reason: "Rubric coverage of demonstrated criteria is not yet sufficient for a credential.",
      demonstratedCriteria,
      unresolvedRequiredArtifacts: [],
      requiresHumanConfirmation: input.requireHumanConfirmation,
    };
  }

  return {
    state: input.requireHumanConfirmation ? "pending_human_confirmation" : "eligible",
    eligible: true,
    reason: input.requireHumanConfirmation
      ? "Evidence supports a credential; awaiting reviewer confirmation before issuance."
      : "Evidence supports issuing a Verified Challenge Credential.",
    demonstratedCriteria,
    unresolvedRequiredArtifacts: [],
    requiresHumanConfirmation: input.requireHumanConfirmation,
  };
}
