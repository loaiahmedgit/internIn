import { describe, it, expect } from "vitest";
import { ClarificationQuestionSchema, ClarificationQuestionsResultSchema, ChallengeDraftSchema } from "./challenge-clarification-schemas";

/**
 * Weaker structured-output models routinely emit an explicit `null` for
 * "nothing here" instead of omitting the key. Plain `.optional()` rejects
 * that (Zod treats `null` as an invalid value for an optional field),
 * which was one real, reproduced cause of "the draft never appears" — see
 * challenge-generation.ts. Every genuinely-optional field must tolerate
 * both `undefined` (omitted) and an explicit `null`, normalizing to
 * `undefined` either way.
 */
describe("ClarificationQuestionSchema — null-tolerant optional fields", () => {
  const base = { id: "level", prompt: "What year are you targeting?", type: "single" as const, required: false };

  it("accepts an omitted optional field", () => {
    const result = ClarificationQuestionSchema.parse(base);
    expect(result.description).toBeUndefined();
    expect(result.choices).toBeUndefined();
    expect(result.allowOther).toBeUndefined();
  });

  it("accepts an explicit null for description/choices/allowOther without throwing", () => {
    const result = ClarificationQuestionSchema.parse({ ...base, description: null, choices: null, allowOther: null });
    expect(result.description).toBeNull();
    expect(result.choices).toBeNull();
    expect(result.allowOther).toBeNull();
  });

  it("still requires the genuinely-required fields", () => {
    expect(() => ClarificationQuestionSchema.parse({ ...base, prompt: undefined })).toThrow();
  });
});

describe("ClarificationQuestionsResultSchema — min/max question count", () => {
  it("rejects fewer than 2 questions", () => {
    expect(() =>
      ClarificationQuestionsResultSchema.parse({ intro: "A few details please.", questions: [{ id: "a", prompt: "What year?", type: "single", required: false }] }),
    ).toThrow();
  });
});

describe("ChallengeDraftSchema — null-tolerant optional fields", () => {
  function base() {
    return {
      title: "Database Data Quality Investigation",
      role: "Database Intern",
      scenario: "A fictional retailer has duplicate customer records that need investigation.",
      objective: "Assess SQL correctness and data-quality reasoning.",
      competencies: [{ name: "SQL", reason: "Core work" }],
      materials: [],
      sections: [{ title: "Investigation", items: [{ kind: "code_task", title: "Write queries", prompt: "Write SQL to find duplicates." }] }],
      deliverables: ["A short handoff summary"],
      estimatedMinutes: 60,
      candidateInstructions: "Work through the sandbox database and answer each task.",
      evaluationRubric: [{ criterion: "SQL correctness", weightPercent: 100, description: "Queries return correct results." }],
    };
  }

  it("accepts explicit null for aiUsagePolicy/safetyNotes/assumptions without throwing", () => {
    const result = ChallengeDraftSchema.parse({ ...base(), aiUsagePolicy: null, safetyNotes: null, assumptions: null });
    expect(result.aiUsagePolicy).toBeNull();
    expect(result.safetyNotes).toBeNull();
    expect(result.assumptions).toBeNull();
  });

  it("accepts an empty materials array (not every challenge needs external materials)", () => {
    expect(() => ChallengeDraftSchema.parse(base())).not.toThrow();
  });

  it("does not constrain free-text content like a database vendor name to any enum — 'Oracle' is just prose", () => {
    const withOracle = { ...base(), scenario: `${base().scenario} The company uses an Oracle database.` };
    expect(() => ChallengeDraftSchema.parse(withOracle)).not.toThrow();
  });
});
