import { describe, it, expect } from "vitest";
import { mapChallengeDraftToChallenge } from "./challenge-draft-mapping";
import { ChallengeSchema } from "@/lib/ai/schemas";
import type { ChallengeDraft } from "@/lib/ai/challenge-clarification-schemas";

function draft(overrides: Partial<ChallengeDraft> = {}): ChallengeDraft {
  return {
    title: "Database Quality Investigation",
    role: "Database Intern",
    scenario: "A fictional ecommerce database has duplicate customers and inconsistent order totals.",
    objective: "Assess SQL and data-quality reasoning.",
    competencies: [{ name: "SQL", reason: "Core daily work" }],
    materials: [{ name: "customers.csv", description: "Synthetic customer records" }],
    sections: [
      {
        title: "Investigation",
        items: [
          { kind: "practical_task", title: "Find duplicates", prompt: "Identify duplicate customer rows." },
          { kind: "code_task", title: "Write queries", prompt: "Write SQL to detect the issues." },
        ],
      },
      {
        title: "Write-up",
        items: [{ kind: "written_deliverable", title: "Handoff note", prompt: "Summarize findings in 200 words." }],
      },
    ],
    deliverables: ["A short handoff document"],
    estimatedMinutes: 75,
    candidateInstructions: "Work through the sandbox database and answer each task.",
    aiUsagePolicy: "research_only",
    evaluationRubric: [
      { criterion: "SQL correctness", weightPercent: 60, description: "Queries return correct results." },
      { criterion: "Communication", weightPercent: 40, description: "Findings are clearly written." },
    ],
    safetyNotes: undefined,
    assumptions: ["Candidates have basic PostgreSQL familiarity."],
    ...overrides,
  };
}

describe("mapChallengeDraftToChallenge", () => {
  it("produces output that validates against the real, live ChallengeSchema", () => {
    const mapped = mapChallengeDraftToChallenge(draft());
    expect(() => ChallengeSchema.parse(mapped)).not.toThrow();
  });

  it("flattens every section's items into tasks, in order, none dropped", () => {
    const mapped = mapChallengeDraftToChallenge(draft());
    expect(mapped.tasks).toHaveLength(3);
    expect(mapped.tasks.map((t) => t.title)).toEqual(["Find duplicates", "Write queries", "Handoff note"]);
  });

  it("always saves as ai_generated, never a published/approved status", () => {
    const mapped = mapChallengeDraftToChallenge(draft());
    expect(mapped.status).toBe("ai_generated");
  });

  it("folds rubric weight into the criterion label without losing the description", () => {
    const mapped = mapChallengeDraftToChallenge(draft());
    expect(mapped.rubric[0].criterion).toBe("SQL correctness (60%)");
    expect(mapped.rubric[0].description).toBe("Queries return correct results.");
  });

  it("carries assumptions and safety notes into the scenario text instead of silently dropping them", () => {
    const mapped = mapChallengeDraftToChallenge(draft({ safetyNotes: ["Never handle real patient data."] }));
    expect(mapped.scenario).toContain("Never handle real patient data.");
    expect(mapped.scenario).toContain("Candidates have basic PostgreSQL familiarity.");
  });

  it("maps competencies to the flat skills list the rest of the app reads", () => {
    const mapped = mapChallengeDraftToChallenge(draft());
    expect(mapped.skills).toEqual(["SQL"]);
  });
});
