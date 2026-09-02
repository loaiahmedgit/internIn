import { config } from "dotenv";
config({ path: ".env.local" });
import { describe, it, expect } from "vitest";
import { classifyAssistantRequest } from "./assistant-router";

/**
 * Real, live calls to classifyAssistantRequest — the actual natural-
 * language extraction behavior these 4 scenarios prove (whether a message
 * already answers a slot, whether the model correctly treats "no minimum
 * number of clarification questions" as real) is not something a pure
 * unit test of deterministic code can demonstrate; it's a property of the
 * model call itself. Skipped automatically when no API key is configured
 * (CI without secrets) rather than failing — this is an opt-in proof, not
 * part of the required, always-green suite.
 */
const hasCredentials = Boolean(process.env.OPENROUTER_API_KEY);
const maybe = hasCredentials ? describe : describe.skip;

maybe("classifyAssistantRequest — real clarification-detection behavior (live model)", () => {
  it(
    "1. Fully specified request -> draft_challenge directly, zero clarification questions",
    async () => {
      const transcript = `Employer: I want a technical student to fix computers when small problems happen. School, university, or graduate doesn't matter. Mostly normal computer and software issues.`;
      const decision = await classifyAssistantRequest(transcript);
      expect(decision.action).toBe("draft_challenge");
      // Zero clarification questions IS the point — draft_challenge carries
      // no missingSlots at all, there is nothing left to resolve.
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
        expect(decision.action).toBe("draft_challenge");
      }
    },
    60_000,
  );

  it(
    "3. Very vague request -> real clarification is needed (the role itself is unclear)",
    async () => {
      const transcript = `Employer: I need someone for lab work.`;
      const decision = await classifyAssistantRequest(transcript);
      expect(decision.action).toBe("ask_clarifying_questions");
      expect(decision.missingSlots?.length ?? 0).toBeGreaterThan(0);
    },
    60_000,
  );

  it(
    "4. Information already stated in natural language is never asked again — explicit 'level doesn't matter' must not produce a candidate_level question",
    async () => {
      const transcript = `Employer: I want a technical student to fix computers when small problems happen. School, university, or graduate doesn't matter. Mostly normal computer and software issues.`;
      const decision = await classifyAssistantRequest(transcript);
      const slots = decision.missingSlots ?? [];
      expect(slots).not.toContain("candidate_level");
      expect(slots).not.toContain("responsibilities");
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
    },
    60_000,
  );
});
