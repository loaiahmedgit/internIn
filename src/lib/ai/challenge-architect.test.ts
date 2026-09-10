import { describe, expect, it } from "vitest";
import { resolveAssessmentPlanReferences } from "./challenge-architect";

const plan = {
  expectedBeforeJoining: ["Prioritization", "Documentation"], willTeach: ["Internal systems"],
  foundations: [{ entryFoundationIndex: 1, pattern: "communicate" as const, importance: "required" as const, candidateAction: "Write a handoff.", taskTitles: ["Handoff"], evidence: "Written handoff", humanReview: "Inspect accuracy against supplied facts.", proposedDeterministicCheck: null }],
  cannotEstablish: ["Overall suitability"], practicalVerificationRequired: [], activeMinutes: 15, completionWindowHours: null,
};

describe("generated assessment references", () => {
  it("resolves the exact entry foundation without semantic name guessing", () => {
    const resolved = resolveAssessmentPlanReferences(plan);
    expect(resolved.foundations[0].foundation).toBe("Documentation");
    expect(resolved.foundations[0]).not.toHaveProperty("entryFoundationIndex");
  });
  it("rejects a reference beyond the actual entry list", () => {
    expect(() => resolveAssessmentPlanReferences({ ...plan, foundations: [{ ...plan.foundations[0], entryFoundationIndex: 2 }] })).toThrow("does not exist");
  });
  it("rejects fractional and negative references", () => {
    for (const index of [-1, 0.5]) expect(() => resolveAssessmentPlanReferences({ ...plan, foundations: [{ ...plan.foundations[0], entryFoundationIndex: index }] })).toThrow();
  });
});
