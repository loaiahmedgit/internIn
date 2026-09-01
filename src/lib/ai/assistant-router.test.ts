import { describe, it, expect } from "vitest";
import { AssistantRouterDecisionSchema } from "./assistant-router";

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

  it("only recognizes the five canonical actions — one code path per action, no ambiguity", () => {
    const actions = ["decline", "chat", "check_data", "ask_clarifying_questions", "draft_challenge"];
    for (const action of actions) {
      expect(() => AssistantRouterDecisionSchema.parse({ action })).not.toThrow();
    }
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

  it("rejects a slot outside the closed 8-value vocabulary — the model cannot invent a new kind of question", () => {
    expect(() => AssistantRouterDecisionSchema.parse({ action: "ask_clarifying_questions", missingSlots: ["favorite_color"] })).toThrow();
  });

  it("tolerates explicit null for normalizedRole/roleConfidence/missingSlots (e.g. for a non-clarification action)", () => {
    const result = AssistantRouterDecisionSchema.parse({ action: "chat", normalizedRole: null, roleConfidence: null, missingSlots: null });
    expect(result.normalizedRole).toBeNull();
    expect(result.roleConfidence).toBeNull();
    expect(result.missingSlots).toBeNull();
  });
});
