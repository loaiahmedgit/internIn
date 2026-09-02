import { describe, it, expect } from "vitest";
import { attachDraftIdentity, buildDesignSummary, formatQuestionnaireAnswers, normalizeRubricWeights, preserveStructuredEmployerAnswers } from "./challenge-generation";
import { ChallengeDraftGeneratedSchema, ChallengeDraftSchema, type ChallengeDraft, type ChallengeDraftGenerated, type EmployerContext } from "./challenge-clarification-schemas";
import { mapChallengeDraftToChallenge } from "@/lib/opportunities/challenge-draft-mapping";
import { ChallengeSchema } from "@/lib/ai/schemas";
import type { QuestionnaireAnswer } from "./assistant-messages";

function draft(overrides: Partial<ChallengeDraftGenerated> = {}): ChallengeDraftGenerated {
  return {
    title: "Customer Data Investigation",
    role: "Database Intern",
    scenario: "A fictional retailer has duplicate customer records.",
    skills: ["SQL"],
    deliverables: ["SQL scripts"],
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

describe("preserveStructuredEmployerAnswers", () => {
  it("keeps the employer's selected responsibilities, level, and technologies exactly", () => {
    const extracted: EmployerContext = {
      originalRequest: "I need a web developer intern",
      role: "Web Developer",
      level: "Junior",
      responsibilities: ["Generic web work"],
      tools: ["JavaScript"],
      restrictions: [],
      additionalContext: null,
    };
    const result = preserveStructuredEmployerAnswers(
      extracted,
      [
        { prompt: "Responsibilities?", slot: "responsibilities", answer: "Frontend development, Backend development, Full-stack feature work", values: ["Frontend development", "Backend development", "Full-stack feature work"] },
        { prompt: "Candidate level?", slot: "candidate_level", answer: "Recent graduate", values: ["Recent graduate"] },
        { prompt: "Technologies?", slot: "tools_technologies", answer: "React, HTML/CSS, TypeScript, Node.js", values: ["React", "HTML/CSS", "TypeScript", "Node.js"] },
      ],
      "Web Developer Intern",
    );

    expect(result.role).toBe("Web Developer Intern");
    expect(result.level).toBe("Recent graduate");
    expect(result.responsibilities).toEqual(["Frontend development", "Backend development", "Full-stack feature work"]);
    expect(result.tools).toEqual(["React", "HTML/CSS", "TypeScript", "Node.js"]);
  });

  it("uses the same task-first evidence behind a role recommendation without re-inferring it", () => {
    const result = preserveStructuredEmployerAnswers(
      {
        originalRequest: "fallback",
        role: "Fallback role",
        level: null,
        responsibilities: [],
        tools: [],
        restrictions: [],
        additionalContext: null,
      },
      null,
      "ERP Implementation Assistant Intern",
      {
        originalRequest: "We need help preparing data for an Oracle migration.",
        explicitRoleTitle: null,
        problems: ["messy migration data"],
        activities: ["data cleansing", "data mapping", "migration validation"],
        systemsOrTools: ["Oracle ERP"],
        desiredOutcomes: ["fewer migration issues"],
        constraints: ["synthetic data only"],
        activityClarity: "clear",
        seniorityIntent: "intern/junior",
      },
    );

    expect(result.role).toBe("ERP Implementation Assistant Intern");
    expect(result.responsibilities).toEqual(["data cleansing", "data mapping", "migration validation"]);
    expect(result.tools).toEqual(["Oracle ERP"]);
    expect(result.restrictions).toEqual(["synthetic data only"]);
    expect(result.additionalContext).toContain("messy migration data");
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

describe("normalizeRubricWeights", () => {
  it("leaves a rubric that already sums to 100 untouched", () => {
    const rubric = [{ criterion: "A", weight: 60 }, { criterion: "B", weight: 40 }];
    expect(normalizeRubricWeights(rubric)).toEqual(rubric);
  });

  it("rescales a rubric that doesn't sum to 100, exactly to 100", () => {
    const rubric = [{ criterion: "A", weight: 30 }, { criterion: "B", weight: 30 }, { criterion: "C", weight: 30 }]; // sums to 90
    const normalized = normalizeRubricWeights(rubric);
    expect(normalized.reduce((sum, r) => sum + r.weight, 0)).toBe(100);
  });

  it("puts any rounding remainder on the heaviest criterion, never a fractional weight", () => {
    const rubric = [{ criterion: "A", weight: 33 }, { criterion: "B", weight: 33 }, { criterion: "C", weight: 33 }]; // sums to 99
    const normalized = normalizeRubricWeights(rubric);
    expect(normalized.every((r) => Number.isInteger(r.weight))).toBe(true);
    expect(normalized.reduce((sum, r) => sum + r.weight, 0)).toBe(100);
  });

  it("leaves an empty rubric alone rather than dividing by zero", () => {
    expect(normalizeRubricWeights([])).toEqual([]);
  });
});

describe("end-to-end: generated output -> schema validation -> ChallengeDraft -> mapping (Part 15)", () => {
  function generated(overrides: Partial<ChallengeDraftGenerated> = {}): ChallengeDraftGenerated {
    return {
      role: "IT Technician Intern",
      title: "New Hire Onboarding & Troubleshooting",
      scenario: "A fictional company is onboarding new hires who need workstation setup and IT support.",
      skills: ["Hardware setup", "Troubleshooting"],
      tasks: [
        { title: "Set up workstation", instructions: "Unbox and configure a new laptop.", deliverableType: "written" },
        { title: "Resolve a ticket", instructions: "Diagnose a login issue.", deliverableType: "written" },
      ],
      materials: [],
      deliverables: ["Workstation setup notes"],
      durationMinutes: 60,
      rubric: [
        { criterion: "Accuracy", weight: 50, description: "Steps followed correctly." },
        { criterion: "Communication", weight: 50, description: "Clear documentation." },
      ],
      assumptions: [],
      safetyNotes: [],
      ...overrides,
    };
  }

  it("a normal generation with a 100% rubric passes through schema validation, mapping, and the real live ChallengeSchema untouched", () => {
    const parsed = ChallengeDraftGeneratedSchema.parse(generated());
    const withIdentity = attachDraftIdentity(parsed, null);
    expect(() => ChallengeDraftSchema.parse(withIdentity)).not.toThrow();
    const mapped = mapChallengeDraftToChallenge(withIdentity);
    expect(() => ChallengeSchema.parse(mapped)).not.toThrow();
  });

  it("a non-100% rubric is normalized before it ever reaches the schema/renderer boundary", () => {
    const withBadRubric = generated({ rubric: [{ criterion: "Accuracy", weight: 30, description: "x" }, { criterion: "Speed", weight: 30, description: "y" }] });
    const parsed = ChallengeDraftGeneratedSchema.parse(withBadRubric);
    const normalizedRubric = normalizeRubricWeights(parsed.rubric);
    const withIdentity = attachDraftIdentity({ ...parsed, rubric: normalizedRubric }, null);
    expect(withIdentity.rubric.reduce((sum, r) => sum + r.weight, 0)).toBe(100);
  });

  it("an unknown but benign deliverableType alias maps to 'other' and still validates end to end", () => {
    const withAlias = { ...generated(), tasks: [{ title: "Export a sheet", instructions: "Export the ticket log.", deliverableType: "excel" }] };
    const parsed = ChallengeDraftGeneratedSchema.parse(withAlias);
    expect(parsed.tasks[0].deliverableType).toBe("other");
    const withIdentity = attachDraftIdentity(parsed, null);
    expect(() => ChallengeSchema.parse(mapChallengeDraftToChallenge(withIdentity))).not.toThrow();
  });

  it("omitted materials/assumptions/safetyNotes default cleanly and still produce a valid, renderable draft", () => {
    const parsed = ChallengeDraftGeneratedSchema.parse({ ...generated(), materials: undefined, assumptions: undefined, safetyNotes: undefined });
    const withIdentity = attachDraftIdentity(parsed, null);
    expect(withIdentity.materials).toEqual([]);
    expect(() => ChallengeSchema.parse(mapChallengeDraftToChallenge(withIdentity))).not.toThrow();
  });

  it("a revision keeps the SAME draft id all the way through mapping", () => {
    const first = attachDraftIdentity(ChallengeDraftGeneratedSchema.parse(generated()), null);
    const revised = attachDraftIdentity(ChallengeDraftGeneratedSchema.parse(generated({ durationMinutes: 45 })), first as ChallengeDraft);
    expect(revised.id).toBe(first.id);
    expect(revised.durationMinutes).toBe(45);
  });
});
