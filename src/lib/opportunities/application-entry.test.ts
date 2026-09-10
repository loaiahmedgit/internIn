import { describe, expect, it } from "vitest";
import { baselineQuestions, captureBaselineEvidence, evaluateEligibility, EligibilityRequirementsSchema } from "./application-entry";

describe("objective application eligibility", () => {
  const mechanical = { major: "Mechanical Engineering", education: [], certifications: [] };
  it("blocks a major outside the company's explicit alternatives", () => {
    expect(evaluateEligibility([{ field: "study_field", acceptedValues: ["Nursing", "Medicine"] }], mechanical)[0].met).toBe(false);
  });
  it("allows engineering for a healthcare data role when the company explicitly accepts it", () => {
    expect(evaluateEligibility([{ field: "study_field", acceptedValues: ["Computer Science", "Mechanical Engineering"] }], mechanical)[0].met).toBe(true);
  });
  it("does not infer education level from a profile's university status", () => {
    expect(evaluateEligibility([{ field: "education_level", acceptedValues: ["Bachelor's"] }], mechanical)[0].met).toBe(false);
  });
  it("matches canonical education entries and normalizes whitespace/case only", () => {
    const result = evaluateEligibility([{ field: "study_field", acceptedValues: ["nursing"] }], { major: null, education: [{ fieldOfStudy: " Nursing ", level: "Bachelor's" }], certifications: [] });
    expect(result[0]).toMatchObject({ met: true, basis: "Profile-declared information; documents not independently verified" });
  });
  it("keeps missing and expired certification requirements unmet", () => {
    const result = evaluateEligibility([{ field: "certification", acceptedValues: ["First aid"] }], { ...mechanical, certifications: [{ name: "First aid", expiryDate: "2026-09-01" }] }, "2026-09-10");
    expect(result[0].met).toBe(false);
  });
  it("has no implicit eligibility requirements", () => {
    expect(evaluateEligibility([], mechanical)).toEqual([]);
  });
  it("rejects arbitrary personal or suitability criteria", () => {
    expect(EligibilityRequirementsSchema.safeParse([{ field: "culture_fit", acceptedValues: ["Good"] }]).success).toBe(false);
  });
});

describe("baseline work evidence", () => {
  it("provides two bounded, role-context work questions when none were authored", () => {
    const questions = baselineQuestions("Procurement Intern", []);
    expect(questions).toHaveLength(2);
    expect(questions.every((question) => question.includes("Procurement Intern"))).toBe(true);
  });
  it("freezes company wording alongside the actual candidate response", () => {
    expect(captureBaselineEvidence(["Write a handoff."], ["  Waiting for the supplier.  "]))
      .toEqual([{ question: "Write a handoff.", response: "Waiting for the supplier." }]);
  });
  it("rejects missing, blank, surplus, and oversized responses", () => {
    for (const answers of [[], [" "], ["Answer", "extra"], ["x".repeat(3001)]]) {
      expect(() => captureBaselineEvidence(["Question"], answers)).toThrow();
    }
  });
});
