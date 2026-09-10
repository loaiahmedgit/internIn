export const ASSESSMENT_BASIS_VALUES = [
  "synthetic",
  "fictional",
  "historical_adapted",
  "sandbox",
  "anonymized_adapted",
] as const;

export type AssessmentBasis = (typeof ASSESSMENT_BASIS_VALUES)[number];

export const PRODUCTION_WORK_RISK_VALUES = ["none", "possible", "high"] as const;
export type ProductionWorkRisk = (typeof PRODUCTION_WORK_RISK_VALUES)[number];

export const NO_FREE_LABOR_POLICY_VERSION = 2;
export const LONG_CHALLENGE_THRESHOLD_MINUTES = 90;
export const MAX_UNPAID_CHALLENGE_MINUTES = 120;

export const ASSESSMENT_BASIS_LABEL: Record<AssessmentBasis, string> = {
  synthetic: "Synthetic scenario",
  fictional: "Fictional case",
  historical_adapted: "Adapted historical case",
  sandbox: "Sandbox environment",
  anonymized_adapted: "Anonymized, adapted case",
};

export const ASSESSMENT_BASIS_DESCRIPTION: Record<AssessmentBasis, string> = {
  synthetic: "Uses generated data or materials created only for assessment.",
  fictional: "Uses a fictional company, customer, product, or brief.",
  historical_adapted: "Uses a completed past case adapted so the submission is not live work.",
  sandbox: "Uses an isolated repository, system, or environment with no production effect.",
  anonymized_adapted: "Uses de-identified material adapted for assessment rather than live operations.",
};

export type ChallengeSafeguardState = {
  policyVersion: number;
  assessmentBasis: AssessmentBasis | null | undefined;
  nonProductionConfirmed: boolean;
  estimatedMinutes: number;
  durationExceptionJustification: string | null | undefined;
  productionWorkRisk?: ProductionWorkRisk | null;
  transformationApplied?: boolean | null;
};

export type ChallengeSafeguardIssueCode =
  | "legacy_review_required"
  | "assessment_basis_required"
  | "non_production_confirmation_required"
  | "duration_justification_required"
  | "duration_exceeds_maximum"
  | "production_transformation_required";

export type ChallengeSafeguardIssue = {
  code: ChallengeSafeguardIssueCode;
  message: string;
};

/**
 * Pure, deterministic R3 policy boundary. AI may identify and transform a
 * risky request, but publication never depends on an AI call: it depends on
 * stored version state, active-work duration, and an authenticated human
 * confirmation. Legacy versions are allowed to remain live only when the
 * caller explicitly proves this is not a new publication/re-publication.
 */
export function getChallengeSafeguardIssues(
  state: ChallengeSafeguardState,
  options: { allowLegacyAlreadyPublished?: boolean } = {},
): ChallengeSafeguardIssue[] {
  if (state.policyVersion < NO_FREE_LABOR_POLICY_VERSION) {
    return options.allowLegacyAlreadyPublished
      ? []
      : [{
          code: "legacy_review_required",
          message: "Review this legacy Challenge and confirm its non-production assessment setup before publishing it again.",
        }];
  }

  const issues: ChallengeSafeguardIssue[] = [];
  if (!state.assessmentBasis) {
    issues.push({
      code: "assessment_basis_required",
      message: "Choose what makes this a non-production assessment before approving it.",
    });
  }
  if (!state.nonProductionConfirmed) {
    issues.push({
      code: "non_production_confirmation_required",
      message: "Confirm that this Challenge is an assessment and is not intended to obtain unpaid live production work.",
    });
  }
  if (state.estimatedMinutes > MAX_UNPAID_CHALLENGE_MINUTES) {
    issues.push({
      code: "duration_exceeds_maximum",
      message: `Reduce estimated active work to ${MAX_UNPAID_CHALLENGE_MINUTES} minutes or less before publishing this unpaid assessment.`,
    });
  } else if (
    state.estimatedMinutes > LONG_CHALLENGE_THRESHOLD_MINUTES &&
    (state.durationExceptionJustification?.trim().length ?? 0) < 20
  ) {
    issues.push({
      code: "duration_justification_required",
      message: "Explain briefly why this assessment needs more than 90 minutes of active work.",
    });
  }
  if (
    state.productionWorkRisk &&
    state.productionWorkRisk !== "none" &&
    state.transformationApplied !== true
  ) {
    issues.push({
      code: "production_transformation_required",
      message: "Convert the potential live-work request into an equivalent synthetic, adapted, or sandbox assessment before approval.",
    });
  }
  return issues;
}

export function assertChallengeSafeguards(
  state: ChallengeSafeguardState,
  options?: { allowLegacyAlreadyPublished?: boolean },
): void {
  const [issue] = getChallengeSafeguardIssues(state, options);
  if (issue) throw new Error(issue.message);
}

/** Shared postcondition for both current AI Challenge generators. */
export function assertGeneratedNonProductionMetadata(value: {
  assessmentBasis?: AssessmentBasis | null;
  productionWorkRisk?: ProductionWorkRisk | null;
  productionWorkReason?: string | null;
  transformationApplied?: boolean | null;
  originalIntentSummary?: string | null;
}): void {
  if (!value.assessmentBasis || !value.productionWorkRisk || !value.productionWorkReason?.trim() || !value.originalIntentSummary?.trim()) {
    throw new Error("Generated Challenge is missing its non-production assessment metadata.");
  }
  if (value.productionWorkRisk !== "none" && value.transformationApplied !== true) {
    throw new Error("Generated Challenge identified potential live work but did not transform it into a non-production assessment.");
  }
}
