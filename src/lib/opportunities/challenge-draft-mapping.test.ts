import { describe, it, expect } from "vitest";
import { mapChallengeDraftToChallenge } from "./challenge-draft-mapping";
import { ChallengeSchema } from "@/lib/ai/schemas";
import type { ChallengeDraft } from "@/lib/ai/challenge-clarification-schemas";

function draft(overrides: Partial<ChallengeDraft> = {}): ChallengeDraft {
  return {
    id: "draft-1",
    status: "draft",
    role: "Database Intern",
    title: "Database Quality Investigation",
    scenario: "A fictional ecommerce database has duplicate customers and inconsistent order totals.",
    skills: ["SQL"],
    tasks: [
      { id: "t1", title: "Find duplicates", instructions: "Identify duplicate customer rows.", deliverableType: "code" },
      { id: "t2", title: "Write queries", instructions: "Write SQL to detect the issues.", deliverableType: "code" },
      { id: "t3", title: "Handoff note", instructions: "Summarize findings in 200 words.", deliverableType: "written" },
    ],
    materials: [{ id: "m1", name: "customers.csv", type: "csv", description: "Synthetic customer records" }],
    durationMinutes: 75,
    aiUsagePolicyMode: "research_only",
    rubric: [
      { id: "r1", criterion: "SQL correctness", weight: 60, description: "Queries return correct results." },
      { id: "r2", criterion: "Communication", weight: 40, description: "Findings are clearly written." },
    ],
    assumptions: ["Candidates have basic PostgreSQL familiarity."],
    safetyNotes: [],
    ...overrides,
  };
}

describe("mapChallengeDraftToChallenge", () => {
  it("produces output that validates against the real, live ChallengeSchema", () => {
    const mapped = mapChallengeDraftToChallenge(draft());
    expect(() => ChallengeSchema.parse(mapped)).not.toThrow();
  });

  it("maps every task in order, none dropped, description tagged with its deliverable type", () => {
    const mapped = mapChallengeDraftToChallenge(draft());
    expect(mapped.tasks).toHaveLength(3);
    expect(mapped.tasks.map((t) => t.title)).toEqual(["Find duplicates", "Write queries", "Handoff note"]);
    expect(mapped.tasks[2].description).toContain("[Written response]");
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

  it("maps skills straight through to the flat skills list the rest of the app reads", () => {
    const mapped = mapChallengeDraftToChallenge(draft());
    expect(mapped.skills).toEqual(["SQL"]);
  });

  it("falls back to 60 minutes when durationMinutes is absent, never crashing on a missing optional field", () => {
    const mapped = mapChallengeDraftToChallenge(draft({ durationMinutes: null }));
    expect(mapped.estimatedMinutes).toBe(60);
  });

  it("uses the custom AI usage text when the mode is custom", () => {
    const mapped = mapChallengeDraftToChallenge(draft({ aiUsagePolicyMode: "custom", aiUsagePolicyCustomText: "Only for research, never to generate the final SQL." }));
    expect(mapped.scenario).toContain("Only for research, never to generate the final SQL.");
  });
});
