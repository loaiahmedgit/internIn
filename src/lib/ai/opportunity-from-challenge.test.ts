import { describe, expect, it } from "vitest";
import { buildGroundedOpportunityFromContext } from "./opportunity-from-challenge";
import type { ChallengeDraft, EmployerContext } from "./challenge-clarification-schemas";

const context: EmployerContext = {
  originalRequest: "I need a web developer intern",
  role: "Web Developer Intern",
  level: "Recent graduate",
  responsibilities: ["Frontend development", "Backend development", "Full-stack feature work"],
  tools: ["React", "HTML/CSS", "TypeScript", "Node.js"],
  restrictions: [],
  additionalContext: null,
};

const draft: ChallengeDraft = {
  id: "draft-web",
  version: 1,
  status: "draft",
  role: "Web Developer Intern",
  title: "Full-Stack Feature Implementation",
  scenario: "A fictional application needs a new feature.",
  skills: ["React", "HTML/CSS", "TypeScript", "Node.js"],
  tasks: [{ id: "task-1", title: "Implement the feature", instructions: "Build the frontend and backend parts.", deliverableType: "code" }],
  materials: [],
  durationMinutes: 75,
  estimatedDurationLabel: "60-90 minutes",
  deliverables: ["Source code"],
  rubric: [{ id: "rubric-1", criterion: "Implementation quality", weight: 100, description: "The feature works." }],
  submissionRequirements: [{ id: "req-1", label: "Source code", inputMode: "url", artifactKind: "code_repository", required: true, providers: ["github.com", "gitlab.com"] }],
  assumptions: [],
  safetyNotes: [],
};

describe("buildGroundedOpportunityFromContext", () => {
  it("preserves every selected responsibility, technology, and candidate level", () => {
    const opportunity = buildGroundedOpportunityFromContext(draft, context);
    const copy = JSON.stringify(opportunity);

    for (const value of [...context.responsibilities, ...context.tools, context.level!]) {
      expect(copy).toContain(value);
    }
    expect(opportunity.title).toBe("Web Developer Intern");
    expect(opportunity.requirements).toHaveLength(4);
    expect(opportunity.niceToHave.length).toBeLessThanOrEqual(3);
  });

  it("does not invent employer teams, clients, production systems, or industry facts", () => {
    const copy = JSON.stringify(buildGroundedOpportunityFromContext(draft, context)).toLowerCase();
    expect(copy).not.toMatch(/our (engineering |development )?team|our clients|production environment|production systems|company workflow|our industry/);
  });
});
