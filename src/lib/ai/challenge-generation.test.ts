import { describe, it, expect } from "vitest";
import { buildDesignSummary, formatQuestionnaireAnswers } from "./challenge-generation";
import type { ChallengeDraft } from "./challenge-clarification-schemas";
import type { QuestionnaireAnswer } from "./assistant-messages";

function draft(overrides: Partial<ChallengeDraft> = {}): ChallengeDraft {
  return {
    title: "Customer Data Investigation",
    role: "Database Intern",
    scenario: "A fictional retailer has duplicate customer records.",
    objective: "Assess SQL correctness and data-quality reasoning.",
    competencies: [{ name: "SQL", reason: "Core work" }],
    materials: [{ name: "customers.csv", description: "Synthetic customer records" }],
    sections: [{ title: "Investigation", items: [{ kind: "code_task", title: "Write queries", prompt: "Write SQL." }] }],
    deliverables: ["A short handoff"],
    estimatedMinutes: 60,
    candidateInstructions: "Work through the sandbox database.",
    evaluationRubric: [{ criterion: "SQL correctness", weightPercent: 100, description: "Queries are correct." }],
    ...overrides,
  };
}

describe("formatQuestionnaireAnswers", () => {
  it("renders a real answer as given", () => {
    const answers: QuestionnaireAnswer[] = [{ prompt: "Which database?", answer: "PostgreSQL" }];
    expect(formatQuestionnaireAnswers(answers)).toBe("- Which database? — PostgreSQL");
  });

  it("never sends a raw '(skipped)' placeholder — a null answer becomes a clean instruction to use judgment", () => {
    const answers: QuestionnaireAnswer[] = [{ prompt: "Experience level?", answer: null }];
    const formatted = formatQuestionnaireAnswers(answers);
    expect(formatted).not.toContain("(skipped)");
    expect(formatted).toBe("- Experience level? — (not specified — use your best professional judgment)");
  });

  it("formats multiple answers, mixing real and skipped, one per line", () => {
    const answers: QuestionnaireAnswer[] = [
      { prompt: "Stack?", answer: "PostgreSQL, MySQL" },
      { prompt: "Level?", answer: null },
    ];
    expect(formatQuestionnaireAnswers(answers).split("\n")).toHaveLength(2);
  });
});

describe("buildDesignSummary", () => {
  it("derives lines only from the real draft's own fields, never fabricated ones", () => {
    const lines = buildDesignSummary(draft());
    expect(lines.some((l) => l.includes("database intern"))).toBe(true);
    expect(lines.some((l) => l.includes("SQL"))).toBe(true);
    expect(lines.some((l) => l.includes("customers.csv"))).toBe(true);
    expect(lines.some((l) => l.includes("60 minutes"))).toBe(true);
  });

  it("omits safety-notes/assumptions lines entirely when the draft has none, rather than showing empty bullets", () => {
    const lines = buildDesignSummary(draft({ safetyNotes: undefined, assumptions: undefined }));
    expect(lines.some((l) => l.startsWith("Keeping it a safe simulation"))).toBe(false);
    expect(lines.some((l) => l.startsWith("Assumptions"))).toBe(false);
  });

  it("includes a safety line when the draft has safety notes (e.g. a pharmacy challenge)", () => {
    const lines = buildDesignSummary(draft({ safetyNotes: ["Never handle real patient data."] }));
    expect(lines.some((l) => l.includes("Never handle real patient data."))).toBe(true);
  });
});
