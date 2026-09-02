import { describe, it, expect } from "vitest";
import { AssistantRouterDecisionSchema, normalizeAssistantRouterDecision } from "./assistant-router";

describe("AssistantRouterDecisionSchema", () => {
  it("accepts a minimal decision with just an action", () => {
    expect(() => AssistantRouterDecisionSchema.parse({ action: "chat" })).not.toThrow();
  });

  it("accepts a challenge-building decision with roleSummary and revisionInstruction", () => {
    const result = AssistantRouterDecisionSchema.parse({
      action: "draft_challenge",
      roleSummary: "A database intern working with PostgreSQL",
      revisionInstruction: "Make it 45 minutes",
    });
    expect(result.action).toBe("draft_challenge");
    expect(result.roleSummary).toContain("database intern");
  });

  it("tolerates an explicit null for roleSummary/revisionInstruction — weaker models emit null instead of omitting", () => {
    const result = AssistantRouterDecisionSchema.parse({ action: "ask_clarifying_questions", roleSummary: null, revisionInstruction: null });
    expect(result.roleSummary).toBeNull();
    expect(result.revisionInstruction).toBeNull();
  });

  it("rejects an action outside the closed enum", () => {
    expect(() => AssistantRouterDecisionSchema.parse({ action: "do_something_else" })).toThrow();
  });

  it("only recognizes the nine canonical actions — one code path per action, no ambiguity", () => {
    const actions = ["decline", "chat", "recommend_role", "check_data", "ask_clarifying_questions", "offer_next_action", "draft_challenge", "edit_existing_challenge", "edit_existing_internship"];
    for (const action of actions) {
      expect(() => AssistantRouterDecisionSchema.parse({ action })).not.toThrow();
    }
  });

  it("carries the employer-named role separately from any model summary", () => {
    const result = AssistantRouterDecisionSchema.parse({
      action: "offer_next_action",
      employerRoleTitle: "Frontend Developer Intern",
      normalizedRole: "Software Developer Intern",
    });
    expect(result.employerRoleTitle).toBe("Frontend Developer Intern");
  });

  it("preserves whether a clarified creation request is internship-first or explicitly challenge-only", () => {
    expect(
      AssistantRouterDecisionSchema.parse({ action: "ask_clarifying_questions", creationTarget: "internship" }).creationTarget,
    ).toBe("internship");
    expect(
      AssistantRouterDecisionSchema.parse({ action: "ask_clarifying_questions", creationTarget: "challenge" }).creationTarget,
    ).toBe("challenge");
  });

  it("accepts targetRoleName for edit_existing_challenge — the employer's own wording, resolved to a real internship server-side, never guessed here", () => {
    const result = AssistantRouterDecisionSchema.parse({
      action: "edit_existing_challenge",
      targetRoleName: "Database Intern",
      revisionInstruction: "Make it easier",
    });
    expect(result.targetRoleName).toBe("Database Intern");
  });

  it("accepts normalizedRole, roleConfidence, and missingSlots for ask_clarifying_questions — the model only picks slots, never writes question text/choices", () => {
    const result = AssistantRouterDecisionSchema.parse({
      action: "ask_clarifying_questions",
      normalizedRole: "IT Technician Intern",
      roleConfidence: "high",
      missingSlots: ["candidate_level", "responsibilities", "tools_technologies"],
    });
    expect(result.missingSlots).toEqual(["candidate_level", "responsibilities", "tools_technologies"]);
  });

  it("rejects a slot outside the closed vocabulary — the model cannot invent a new kind of question", () => {
    expect(() => AssistantRouterDecisionSchema.parse({ action: "ask_clarifying_questions", missingSlots: ["favorite_color"] })).toThrow();
  });

  it("tolerates explicit null for normalizedRole/roleConfidence/missingSlots (e.g. for a non-clarification action)", () => {
    const result = AssistantRouterDecisionSchema.parse({ action: "chat", normalizedRole: null, roleConfidence: null, missingSlots: null });
    expect(result.normalizedRole).toBeNull();
    expect(result.roleConfidence).toBeNull();
    expect(result.missingSlots).toBeNull();
  });
});

describe("normalizeAssistantRouterDecision", () => {
  it("routes an unnamed, low-confidence profession to one task-first role clarification", () => {
    const result = normalizeAssistantRouterDecision(
      {
        action: "ask_clarifying_questions",
        normalizedRole: "Lab Intern",
        roleConfidence: "low",
        missingSlots: ["role_domain", "responsibilities", "candidate_level"],
      },
      "Employer: I need someone for lab work.",
    );
    expect(result.action).toBe("recommend_role");
    expect(result.missingSlots).toBeNull();
  });

  it("removes stale question slots from non-question actions", () => {
    expect(
      normalizeAssistantRouterDecision(
        { action: "offer_next_action", missingSlots: ["expected_deliverables"] },
        "Employer: Create an IT support internship.",
      ).missingSlots,
    ).toBeNull();
  });

  it("never asks for deliverables or work environment", () => {
    expect(
      normalizeAssistantRouterDecision(
        {
          action: "ask_clarifying_questions",
          missingSlots: ["expected_deliverables", "work_environment", "responsibilities"],
        },
        "Employer: I need an intern.",
      ).missingSlots,
    ).toEqual(["responsibilities"]);
  });

  it("does not re-ask candidate level when the employer explicitly says it does not matter", () => {
    const result = normalizeAssistantRouterDecision(
      {
        action: "ask_clarifying_questions",
        normalizedRole: "IT Support Intern",
        roleConfidence: "high",
        missingSlots: ["role_domain", "candidate_level"],
      },
      "Employer: School, university, or graduate doesn't matter.",
    );
    expect(result.action).toBe("offer_next_action");
    expect(result.missingSlots).toBeNull();
  });
});
