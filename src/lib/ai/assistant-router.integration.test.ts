import { config } from "dotenv";
config({ path: ".env.local" });
import { describe, it, expect } from "vitest";
import { classifyAssistantRequest } from "./assistant-router";

/**
 * Real, live calls to classifyAssistantRequest — the actual natural-
 * language extraction behavior these 5 scenarios prove (whether a message
 * already answers a slot, whether the model correctly treats "no minimum
 * number of clarification questions" as real) is not something a pure
 * unit test of deterministic code can demonstrate; it's a property of the
 * model call itself. Skipped automatically when no API key is configured
 * (CI without secrets) rather than failing — this is an opt-in proof, not
 * part of the required, always-green suite.
 */
const hasCredentials = Boolean(process.env.OPENROUTER_API_KEY);
const maybe = hasCredentials ? describe : describe.skip;

maybe("classifyAssistantRequest — real role and clarification routing (live model)", () => {
  it(
    "1. Fully specified problem-first request -> grounded role recommendation",
    async () => {
      const transcript = `Employer: I want a technical student to fix computers when small problems happen. School, university, or graduate doesn't matter. Mostly normal computer and software issues.`;
      const decision = await classifyAssistantRequest(transcript);
      expect(decision.action).toBe("recommend_role");
      expect(decision.missingSlots ?? []).toHaveLength(0);
    },
    60_000,
  );

  it(
    "2. Partially specified request -> ask_clarifying_questions, but ONLY for what's actually missing and material — never the slots already answered",
    async () => {
      // Role and responsibilities are clear; nothing here says whether this
      // needs a junior or senior candidate, or hints at any real
      // restriction/company specifics — candidate_level is the one thing
      // genuinely worth asking (if the model asks at all; it may also
      // reasonably decide it's not material and draft directly — both are
      // correct, "no minimum" means we don't force a specific count).
      const transcript = `Employer: I need a marketing intern to help write social media posts and run some basic ad campaigns for our online store.`;
      const decision = await classifyAssistantRequest(transcript);
      if (decision.action === "ask_clarifying_questions") {
        const slots = decision.missingSlots ?? [];
        expect(slots.length).toBeGreaterThan(0);
        expect(slots.length).toBeLessThanOrEqual(4);
        // The message already says the work IS social media posts + ad
        // campaigns — responsibilities must never be re-asked.
        expect(slots).not.toContain("responsibilities");
      } else {
        expect(decision.action).toBe("offer_next_action");
      }
    },
    60_000,
  );

  it(
    "3. Very vague problem-first request -> role intelligence decides the focused clarification",
    async () => {
      const transcript = `Employer: I need someone for lab work.`;
      const decision = await classifyAssistantRequest(transcript);
      expect(decision.action).toBe("recommend_role");
    },
    60_000,
  );

  it(
    "4. Problem-first routing never asks the legacy questionnaire to identify an occupation",
    async () => {
      const transcript = `Employer: I want a technical student to fix computers when small problems happen. School, university, or graduate doesn't matter. Mostly normal computer and software issues.`;
      const decision = await classifyAssistantRequest(transcript);
      expect(decision.action).toBe("recommend_role");
      expect(decision.missingSlots ?? []).toHaveLength(0);
    },
    60_000,
  );

  it(
    "5. DYNAMIC COUNT: a bare 'web dev intern' request is genuinely vague and needs multiple questions — under-asking (only 1) is the reported regression this proves fixed",
    async () => {
      const transcript = `Employer: I want to hire a web dev intern.`;
      const decision = await classifyAssistantRequest(transcript);
      expect(decision.action).toBe("ask_clarifying_questions");
      const slots = decision.missingSlots ?? [];
      // "Web developer" spans frontend/backend/full-stack/QA with nothing
      // else given — responsibilities is non-negotiable here, and since
      // scope is still totally open, candidate_level can't be judged safe
      // to skip either. One question alone is exactly the bug being fixed.
      expect(slots).toContain("responsibilities");
      expect(slots.length).toBeGreaterThanOrEqual(2);
      expect((decision.employerRoleTitle ?? decision.normalizedRole)?.toLowerCase()).toMatch(/^web (?:dev|developer) intern$/);
    },
    60_000,
  );

  it(
    "6. Exact ERP problem stays problem-first instead of being guessed in the router",
    async () => {
      const transcript = `Employer: We need to hire someone to deal with messy operational or financial data and slow transition times when migrating to new enterprise planning systems like SAP or Oracle.`;
      const decision = await classifyAssistantRequest(transcript);
      expect(decision.action).toBe("recommend_role");
      expect(decision.employerRoleTitle ?? null).toBeNull();
    },
    60_000,
  );

  it(
    "7. A serious named-role/work mismatch is sent to role intelligence instead of silently rewritten",
    async () => {
      const transcript = `Employer: I need a Graphic Design Intern to write backend APIs in Node.js.`;
      const decision = await classifyAssistantRequest(transcript);
      expect(decision.action).toBe("recommend_role");
      expect((decision.employerRoleTitle ?? decision.normalizedRole)?.toLowerCase()).toContain("graphic design");
    },
    60_000,
  );
});
