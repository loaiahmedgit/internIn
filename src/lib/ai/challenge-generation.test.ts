import { describe, it, expect } from "vitest";
import { attachDraftIdentity, buildDesignSummary, formatQuestionnaireAnswers } from "./challenge-generation";
import type { ChallengeDraft, ChallengeDraftGenerated } from "./challenge-clarification-schemas";
import type { QuestionnaireAnswer } from "./assistant-messages";

function draft(overrides: Partial<ChallengeDraftGenerated> = {}): ChallengeDraftGenerated {
  return {
    title: "Customer Data Investigation",
    role: "Database Intern",
    scenario: "A fictional retailer has duplicate customer records.",
    skills: ["SQL"],
    materials: [{ name: "customers.csv", type: "csv", description: "Synthetic customer records" }],
    tasks: [{ title: "Write queries", instructions: "Write SQL to find duplicates.", deliverableType: "code" }],
    durationMinutes: 60,
    rubric: [{ criterion: "SQL correctness", weight: 100, description: "Queries are correct." }],
    assumptions: [],
    safetyNotes: [],
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
    const lines = buildDesignSummary(draft({ safetyNotes: [], assumptions: [] }));
    expect(lines.some((l) => l.startsWith("Keeping it a safe simulation"))).toBe(false);
    expect(lines.some((l) => l.startsWith("Assumptions"))).toBe(false);
  });

  it("includes a safety line when the draft has safety notes (e.g. a pharmacy challenge)", () => {
    const lines = buildDesignSummary(draft({ safetyNotes: ["Never handle real patient data."] }));
    expect(lines.some((l) => l.includes("Never handle real patient data."))).toBe(true);
  });
});

describe("attachDraftIdentity", () => {
  it("mints a fresh id when there is no existing draft", () => {
    const result = attachDraftIdentity(draft(), null);
    expect(result.id).toBeTruthy();
    expect(result.status).toBe("draft");
  });

  it("REUSES the existing draft's id on a revision — a chat edit must update the SAME draft, never start a disconnected new one", () => {
    const first = attachDraftIdentity(draft(), null);
    const revised = attachDraftIdentity(draft({ title: "Revised title" }), first as ChallengeDraft);
    expect(revised.id).toBe(first.id);
    expect(revised.title).toBe("Revised title");
  });

  it("assigns a real id to every task/material/rubric row", () => {
    const result = attachDraftIdentity(draft(), null);
    expect(result.tasks.every((t) => Boolean(t.id))).toBe(true);
    expect(result.materials.every((m) => Boolean(m.id))).toBe(true);
    expect(result.rubric.every((r) => Boolean(r.id))).toBe(true);
  });
});
