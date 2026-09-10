import { describe, expect, it } from "vitest";
import { assertArchitectReady, assertAssessmentPlan, emptyRoleReality, nextArchitectQuestions, type AssessmentPlan } from "./architect";

const plan: AssessmentPlan = {
  expectedBeforeJoining: ["Prioritization"], willTeach: ["Internal ticketing system"],
  foundations: [{ foundation: "Prioritization", pattern: "prioritize", importance: "required", candidateAction: "Choose which request needs attention first and explain why.", taskTitles: ["Prioritize requests"], evidence: "Written request order and explanation", humanReview: "Inspect whether the reasons follow the supplied urgency rules.", proposedDeterministicCheck: null }],
  cannotEstablish: ["Long-term reliability and overall suitability"], practicalVerificationRequired: [], activeMinutes: 15, completionWindowHours: 24,
};
const tasks = [{ title: "Prioritize requests" }];

describe("Universal Challenge Architect", () => {
  it("asks a small set of missing high-value questions", () => {
    expect(nextArchitectQuestions(emptyRoleReality())).toHaveLength(3);
    expect(nextArchitectQuestions(emptyRoleReality(), 15)).toHaveLength(4);
  });
  it("does not re-ask facts already supplied or force all fifteen fields", () => {
    const reality = { ...emptyRoleReality(), actualWork: "Triage requests", expectedBeforeJoining: "Prioritization", willTeach: "Internal system", realisticExample: "Choose an urgent request", qualityCriteria: "Follow urgency rules" };
    expect(nextArchitectQuestions(reality)).toEqual([]);
    expect(() => assertArchitectReady({ roleReality: reality, assessmentPlan: plan, tasks, estimatedMinutes: 15 })).not.toThrow();
  });
  it("requires actual employer expectations before approval", () => {
    expect(() => assertArchitectReady({ roleReality: emptyRoleReality(), assessmentPlan: plan, tasks, estimatedMinutes: 15 })).toThrow("before joining");
  });
  it("requires explicit physical-care limitations for caregiving scenarios", () => {
    const roleReality = { ...emptyRoleReality(), actualWork: "Nursing support and bedside care", expectedBeforeJoining: "Prioritization", willTeach: "Local procedures" };
    expect(() => assertArchitectReady({ roleReality, assessmentPlan: plan, tasks, estimatedMinutes: 15 })).toThrow("physical caregiving");
    expect(() => assertArchitectReady({ roleReality, assessmentPlan: { ...plan, cannotEstablish: ["Physical caregiving and clinical competence"], practicalVerificationRequired: ["Supervised physical caregiving"] }, tasks, estimatedMinutes: 15 })).not.toThrow();
  });

  it("rejects invented task mappings", () => {
    expect(() => assertAssessmentPlan(plan, [{ title: "Different task" }], 15)).toThrow("point to a task");
  });
  it("rejects an assessed foundation the team plans to teach", () => {
    expect(() => assertAssessmentPlan({ ...plan, willTeach: ["Prioritization"] }, tasks, 15)).toThrow("Separate");
  });
  it("rejects an assessed foundation outside entry expectations", () => {
    expect(() => assertAssessmentPlan({ ...plan, expectedBeforeJoining: ["Documentation"] }, tasks, 15)).toThrow("before-joining expectations");
  });
  it("keeps active work and completion window separate", () => {
    expect(() => assertAssessmentPlan(plan, tasks, 15)).not.toThrow();
    expect(() => assertAssessmentPlan(plan, tasks, 60)).toThrow("active-work time");
  });
  it("does not allow empty evidence or missing limitations", () => {
    expect(() => assertAssessmentPlan({ ...plan, cannotEstablish: [] }, tasks, 15)).toThrow();
    expect(() => assertAssessmentPlan({ ...plan, foundations: [{ ...plan.foundations[0], evidence: "" }] }, tasks, 15)).toThrow();
  });
});
