import { describe, expect, it } from "vitest";
import {
  NO_FREE_LABOR_POLICY_VERSION,
  assertGeneratedNonProductionMetadata,
  getChallengeSafeguardIssues,
} from "./no-free-labor";

function state(overrides: Partial<Parameters<typeof getChallengeSafeguardIssues>[0]> = {}) {
  return {
    policyVersion: NO_FREE_LABOR_POLICY_VERSION,
    assessmentBasis: "synthetic" as const,
    nonProductionConfirmed: true,
    estimatedMinutes: 60,
    durationExceptionJustification: null,
    productionWorkRisk: "none" as const,
    transformationApplied: false,
    ...overrides,
  };
}

describe("R3 deterministic Challenge safeguards", () => {
  it("allows an ordinary confirmed 60-minute synthetic assessment", () => {
    expect(getChallengeSafeguardIssues(state())).toEqual([]);
  });

  it("requires an explicit assessment basis", () => {
    expect(getChallengeSafeguardIssues(state({ assessmentBasis: null }))).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "assessment_basis_required" })]),
    );
  });

  it("requires version-bound company confirmation", () => {
    expect(getChallengeSafeguardIssues(state({ nonProductionConfirmed: false }))).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "non_production_confirmation_required" })]),
    );
  });

  it("requires a substantive justification above 90 active-work minutes", () => {
    expect(getChallengeSafeguardIssues(state({ estimatedMinutes: 100 }))).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "duration_justification_required" })]),
    );
    expect(
      getChallengeSafeguardIssues(
        state({
          estimatedMinutes: 100,
          durationExceptionJustification: "A second environment is needed to observe the role-specific debugging approach.",
        }),
      ),
    ).toEqual([]);
  });

  it("hard-blocks more than 120 active-work minutes even with a justification", () => {
    expect(
      getChallengeSafeguardIssues(
        state({
          estimatedMinutes: 121,
          durationExceptionJustification: "The company would like a much larger exercise for this role.",
        }),
      ),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ code: "duration_exceeds_maximum" })]));
  });

  it("does not fabricate policy state for legacy versions, while allowing an untouched published record to remain live", () => {
    expect(getChallengeSafeguardIssues(state({ policyVersion: 1 }))).toEqual([
      expect.objectContaining({ code: "legacy_review_required" }),
    ]);
    expect(
      getChallengeSafeguardIssues(state({ policyVersion: 1 }), { allowLegacyAlreadyPublished: true }),
    ).toEqual([]);
  });

  it("blocks an AI-reported production concern unless a transformation was applied", () => {
    expect(
      getChallengeSafeguardIssues(
        state({ productionWorkRisk: "high", transformationApplied: false }),
      ),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ code: "production_transformation_required" })]));
  });
});

describe("R3 generated-output postcondition", () => {
  const safe = {
    assessmentBasis: "sandbox" as const,
    productionWorkRisk: "high" as const,
    productionWorkReason: "The original request would change a live checkout.",
    transformationApplied: true,
    originalIntentSummary: "Diagnose and fix a checkout defect.",
  };

  it("accepts an equivalent sandbox transformation that preserves the assessed intent", () => {
    expect(() => assertGeneratedNonProductionMetadata(safe)).not.toThrow();
    expect(safe.originalIntentSummary).toMatch(/checkout defect/i);
  });

  it("fails closed if the model reports risk but passes the live-work request through unchanged", () => {
    expect(() => assertGeneratedNonProductionMetadata({ ...safe, transformationApplied: false })).toThrow(
      /did not transform/i,
    );
  });

  it("fails closed when structured non-production metadata is missing", () => {
    expect(() =>
      assertGeneratedNonProductionMetadata({
        ...safe,
        assessmentBasis: null,
      }),
    ).toThrow(/missing its non-production assessment metadata/i);
  });
});
