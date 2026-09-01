import { describe, it, expect } from "vitest";
import { ClarificationQuestionSchema, ClarificationQuestionsResultSchema, ChallengeDraftGeneratedSchema, ChallengeDraftSchema } from "./challenge-clarification-schemas";

/**
 * Weaker structured-output models routinely emit an explicit `null` for
 * "nothing here" instead of omitting the key. Plain `.optional()` rejects
 * that (Zod treats `null` as an invalid value for an optional field),
 * which was one real, reproduced cause of "the draft never appears" — see
 * challenge-generation.ts. Every genuinely-optional field must tolerate
 * both `undefined` (omitted) and an explicit `null`.
 */
describe("ClarificationQuestionSchema — null-tolerant optional fields", () => {
  const base = { id: "level", slot: "candidate_level" as const, prompt: "What year are you targeting?", type: "single" as const, required: false };

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

function generatedDraft() {
  return {
    role: "Database Intern",
    title: "Database Data Quality Investigation",
    scenario: "A fictional retailer has duplicate customer records that need investigation.",
    skills: ["SQL"],
    tasks: [{ title: "Write queries", instructions: "Write SQL to find duplicates.", deliverableType: "code" }],
    materials: [],
    rubric: [{ criterion: "SQL correctness", weight: 100, description: "Queries return correct results." }],
    assumptions: [],
    safetyNotes: [],
  };
}

describe("ChallengeDraftGeneratedSchema — the shape the model actually outputs", () => {
  it("accepts explicit null for durationMinutes/aiUsagePolicyMode without throwing", () => {
    const result = ChallengeDraftGeneratedSchema.parse({ ...generatedDraft(), durationMinutes: null, aiUsagePolicyMode: null });
    expect(result.durationMinutes).toBeNull();
    expect(result.aiUsagePolicyMode).toBeNull();
  });

  it("accepts an empty materials array (not every challenge needs external materials)", () => {
    expect(() => ChallengeDraftGeneratedSchema.parse(generatedDraft())).not.toThrow();
  });

  it("defaults materials/assumptions/safetyNotes to an empty array when the model omits them — never fails generation over a nonessential field", () => {
    const result = ChallengeDraftGeneratedSchema.parse({ ...generatedDraft(), materials: undefined, assumptions: undefined, safetyNotes: undefined });
    expect(result.materials).toEqual([]);
    expect(result.assumptions).toEqual([]);
    expect(result.safetyNotes).toEqual([]);
  });

  it("degrades an unrecognized deliverableType to 'other' instead of failing the whole generation", () => {
    const draft = generatedDraft();
    const result = ChallengeDraftGeneratedSchema.parse({ ...draft, tasks: [{ ...draft.tasks[0], deliverableType: "excel" }] });
    expect(result.tasks[0].deliverableType).toBe("other");
  });

  it("does not constrain free-text content like a database vendor name to any enum — 'Oracle' is just prose", () => {
    const withOracle = { ...generatedDraft(), scenario: `${generatedDraft().scenario} The company uses an Oracle database.` };
    expect(() => ChallengeDraftGeneratedSchema.parse(withOracle)).not.toThrow();
  });
});

describe("ChallengeDraftSchema — the full, id-carrying app-facing shape", () => {
  function fullDraft() {
    return {
      id: "draft-1",
      status: "draft" as const,
      ...generatedDraft(),
      tasks: [{ id: "t1", title: "Write queries", instructions: "Write SQL to find duplicates.", deliverableType: "code" as const }],
      materials: [],
      rubric: [{ id: "r1", criterion: "SQL correctness", weight: 100, description: "Queries return correct results." }],
    };
  }

  it("parses a real, complete draft without throwing", () => {
    expect(() => ChallengeDraftSchema.parse(fullDraft())).not.toThrow();
  });

  it("rejects a task with no id — ids are a control field the model never supplies, but a saved draft must always have them", () => {
    expect(() =>
      ChallengeDraftSchema.parse({ ...fullDraft(), tasks: [{ title: "Write queries", instructions: "x", deliverableType: "code" }] }),
    ).toThrow();
  });
});
