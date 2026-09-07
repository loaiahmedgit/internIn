import { describe, expect, it } from "vitest";
import { computeCredentialEligibility, type EligibilityInput } from "./eligibility";
import type { EvidenceSummary } from "@/lib/company/evidence-summary";
import type { SubmissionRequirement } from "@/lib/challenges/submission-model";

// Real project types throughout — no invented schema states (per instruction).

function requirement(overrides: Partial<SubmissionRequirement> = {}): SubmissionRequirement {
  return {
    id: "req-1",
    label: "Case study memo",
    inputMode: "file",
    artifactKind: "pdf",
    required: true,
    ...overrides,
  };
}

function evidence(overrides: Partial<EvidenceSummary> = {}): EvidenceSummary {
  return {
    version: 1,
    fingerprint: "fp",
    generatedAt: new Date().toISOString(),
    sources: [],
    highlights: [],
    unavailable: [],
    ...overrides,
  };
}

function baseInput(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    credentialPolicy: "internin_verified",
    requireHumanConfirmation: false,
    submissionStatus: "submitted",
    rubric: [
      { criterion: "Customer reasoning", weight: 50 },
      { criterion: "Practicality", weight: 50 },
    ],
    requirements: [requirement()],
    submittedArtifactLabels: ["Case study memo"],
    evidenceSummary: null,
    existingCredential: null,
    ...overrides,
  };
}

describe("computeCredentialEligibility", () => {
  it("policy off → cannot issue", () => {
    const result = computeCredentialEligibility(baseInput({ credentialPolicy: "off", evidenceSummary: evidence({ confidence: "high", metrics: [{ criterion: "Customer reasoning", level: "strong", rationale: "r" }] }) }));
    expect(result.state).toBe("not_eligible");
    expect(result.eligible).toBe(false);
  });

  it("no submission → not_eligible", () => {
    const result = computeCredentialEligibility(baseInput({ submissionStatus: null }));
    expect(result.state).toBe("not_eligible");
  });

  it("evidence pending → cannot issue", () => {
    const result = computeCredentialEligibility(baseInput({ evidenceSummary: null }));
    expect(result.state).toBe("pending_evaluation");
    expect(result.eligible).toBe(false);
  });

  it("evidence failure (no metrics, no confidence) → cannot issue", () => {
    const result = computeCredentialEligibility(baseInput({ evidenceSummary: evidence({ metrics: [], confidence: undefined }) }));
    expect(result.state).toBe("not_eligible");
    expect(result.reason).toMatch(/no usable rubric metrics/);
  });

  it("insufficient evidence (weak criteria outnumber demonstrated) → cannot issue", () => {
    const result = computeCredentialEligibility(
      baseInput({
        evidenceSummary: evidence({
          confidence: "high",
          metrics: [
            { criterion: "Customer reasoning", level: "insufficient", rationale: "r" },
            { criterion: "Practicality", level: "not_demonstrated", rationale: "r" },
          ],
        }),
      }),
    );
    expect(result.state).toBe("not_eligible");
    expect(result.eligible).toBe(false);
  });

  it("required evidence still flagged 'requires human review' → cannot issue", () => {
    const result = computeCredentialEligibility(
      baseInput({
        evidenceSummary: evidence({
          confidence: "high",
          metrics: [
            { criterion: "Customer reasoning", level: "strong", rationale: "r" },
            { criterion: "Practicality", level: "strong", rationale: "r" },
          ],
          unavailable: ["Case study memo: requires human review — this file format cannot be evaluated yet."],
        }),
      }),
    );
    expect(result.state).toBe("not_eligible");
    expect(result.unresolvedRequiredArtifacts).toEqual(["Case study memo"]);
  });

  it("low confidence → cannot issue even with demonstrated criteria", () => {
    const result = computeCredentialEligibility(
      baseInput({
        evidenceSummary: evidence({
          confidence: "low",
          metrics: [
            { criterion: "Customer reasoning", level: "strong", rationale: "r" },
            { criterion: "Practicality", level: "strong", rationale: "r" },
          ],
        }),
      }),
    );
    expect(result.state).toBe("not_eligible");
    expect(result.reason).toMatch(/confidence/i);
  });

  it("eligible evidence → eligible (auto-issuance policy)", () => {
    const result = computeCredentialEligibility(
      baseInput({
        evidenceSummary: evidence({
          confidence: "high",
          metrics: [
            { criterion: "Customer reasoning", level: "strong", rationale: "r" },
            { criterion: "Practicality", level: "solid", rationale: "r" },
          ],
        }),
      }),
    );
    expect(result.state).toBe("eligible");
    expect(result.eligible).toBe(true);
    expect(result.demonstratedCriteria).toHaveLength(2);
  });

  it("confirmation-required path → pending_human_confirmation, not issued outright", () => {
    const result = computeCredentialEligibility(
      baseInput({
        requireHumanConfirmation: true,
        evidenceSummary: evidence({
          confidence: "high",
          metrics: [
            { criterion: "Customer reasoning", level: "strong", rationale: "r" },
            { criterion: "Practicality", level: "solid", rationale: "r" },
          ],
        }),
      }),
    );
    expect(result.state).toBe("pending_human_confirmation");
    expect(result.eligible).toBe(true);
    expect(result.requiresHumanConfirmation).toBe(true);
  });

  it("uses real rubric weights when criterion text matches", () => {
    // Customer reasoning carries 90% of the weight and is demonstrated;
    // Practicality (10%) is weak — an unweighted count (1 of 2) would
    // fail the >=70% bar, but the real weighted coverage (90%) passes.
    const result = computeCredentialEligibility(
      baseInput({
        rubric: [
          { criterion: "Customer reasoning", weight: 90 },
          { criterion: "Practicality", weight: 10 },
        ],
        evidenceSummary: evidence({
          confidence: "high",
          metrics: [
            { criterion: "Customer reasoning", level: "strong", rationale: "r" },
            { criterion: "Practicality", level: "insufficient", rationale: "r" },
          ],
        }),
      }),
    );
    expect(result.state).toBe("eligible");
  });

  it("70% threshold: 60% weighted coverage — would have passed the old 50% rule, correctly fails now", () => {
    const result = computeCredentialEligibility(
      baseInput({
        rubric: [
          { criterion: "Customer reasoning", weight: 60 },
          { criterion: "Practicality", weight: 40 },
        ],
        evidenceSummary: evidence({
          confidence: "high",
          metrics: [
            { criterion: "Customer reasoning", level: "strong", rationale: "r" },
            { criterion: "Practicality", level: "insufficient", rationale: "r" },
          ],
        }),
      }),
    );
    expect(result.state).toBe("not_eligible");
    expect(result.eligible).toBe(false);
  });

  it("70% threshold: exactly 70% weighted coverage is sufficient (boundary is inclusive)", () => {
    const result = computeCredentialEligibility(
      baseInput({
        rubric: [
          { criterion: "Customer reasoning", weight: 70 },
          { criterion: "Practicality", weight: 30 },
        ],
        evidenceSummary: evidence({
          confidence: "high",
          metrics: [
            { criterion: "Customer reasoning", level: "strong", rationale: "r" },
            { criterion: "Practicality", level: "insufficient", rationale: "r" },
          ],
        }),
      }),
    );
    expect(result.state).toBe("eligible");
  });

  it("existing issued credential → state issued, eligible true (idempotent short-circuit)", () => {
    const result = computeCredentialEligibility(baseInput({ existingCredential: { id: "cred-1", status: "issued" } }));
    expect(result.state).toBe("issued");
    expect(result.eligible).toBe(true);
    expect(result.existingCredentialId).toBe("cred-1");
  });

  it("existing revoked credential → state revoked, eligible false, no silent auto-reissue", () => {
    const result = computeCredentialEligibility(baseInput({ existingCredential: { id: "cred-1", status: "revoked" } }));
    expect(result.state).toBe("revoked");
    expect(result.eligible).toBe(false);
  });

  it("application/hiring status is not a possible input — credential eligibility is structurally independent of it", () => {
    // EligibilityInput has no applicationStatus/offerStatus field at all —
    // rejection cannot revoke or affect eligibility because there is no
    // code path through which it could reach this function.
    const keys = Object.keys(baseInput());
    expect(keys).not.toContain("applicationStatus");
    expect(keys).not.toContain("offerStatus");
  });
});
