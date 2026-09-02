import { describe, it, expect } from "vitest";
import { buildClarificationQuestions, refineQuestions, resolveMissingSlots } from "./clarification-engine";
import { getRoleProfile, resolveQuestionType } from "./role-profiles";
import type { InformationSlot, RoleProfile } from "./role-profiles";
import type { ClarificationQuestion } from "./challenge-clarification-schemas";

// The architecture only counts as fixed if it generalizes across
// unrelated professions — testing this deterministically (no live model
// call) is both faster and more exhaustive than live-testing every one.
const PROFESSIONS = [
  "Full Stack Developer Intern",
  "Database Intern",
  "IT Technician Intern",
  "Pharmacy Intern",
  "Marketing Intern",
  "Accountant Intern",
  "Mechanical Engineering Intern",
  "Graphic Design Intern",
  "Architecture Intern",
  "Hospitality Intern",
];

const CORE_SLOTS: InformationSlot[] = ["candidate_level", "responsibilities", "tools_technologies"];

describe("buildClarificationQuestions — generalizes across all 10 required professions", () => {
  for (const profession of PROFESSIONS) {
    describe(profession, () => {
      it("candidate_level is ALWAYS single-select — never a textbox, regardless of profession", async () => {
        const profile = await getRoleProfile(profession);
        const questions = buildClarificationQuestions(["candidate_level"], profile);
        expect(questions[0].type).toBe("single");
        expect(questions[0].slot).toBe("candidate_level");
        expect(questions[0].choices?.length).toBeGreaterThan(0);
      });

      it("responsibilities is ALWAYS multiple-select, with real role-specific choices (not generic filler)", async () => {
        const profile = await getRoleProfile(profession);
        const questions = buildClarificationQuestions(["responsibilities"], profile);
        expect(questions[0].type).toBe("multiple");
        expect(questions[0].choices?.length).toBeGreaterThanOrEqual(3);
        // Every choice must trace back to this profession's own profile —
        // never a hardcoded generic list reused across professions.
        for (const choice of questions[0].choices ?? []) {
          expect(profile.taskFamilies.some((t) => t.includes(choice.value) || choice.value.includes(t))).toBe(true);
        }
      });

      it("tools_technologies is ALWAYS multiple-select and offers 'Not sure yet'", async () => {
        const profile = await getRoleProfile(profession);
        const questions = buildClarificationQuestions(["tools_technologies"], profile);
        if (profile.commonTools.length === 0) return; // some professions may have none — that's fine, question is simply skipped
        expect(questions[0].type).toBe("multiple");
        expect(questions[0].choices?.some((c) => c.value === "Not sure yet")).toBe(true);
      });

      it("no choice list exceeds 8 options and none are duplicated", async () => {
        const profile = await getRoleProfile(profession);
        const questions = buildClarificationQuestions(CORE_SLOTS, profile);
        for (const q of questions) {
          if (!q.choices) continue;
          expect(q.choices.length).toBeLessThanOrEqual(8);
          const values = q.choices.map((c) => c.value.toLowerCase());
          expect(new Set(values).size).toBe(values.length);
        }
      });

      it("Other is offered on every choice-based question", async () => {
        const profile = await getRoleProfile(profession);
        const questions = buildClarificationQuestions(CORE_SLOTS, profile);
        for (const q of questions) {
          if (q.choices?.length) expect(q.allowOther).toBe(true);
        }
      });

      it("never asks more than 4 questions even if more slots were flagged", async () => {
        const profile = await getRoleProfile(profession);
        const questions = buildClarificationQuestions(
          ["candidate_level", "responsibilities", "tools_technologies", "work_environment", "expected_deliverables", "access_level"],
          profile,
        );
        expect(questions.length).toBeLessThanOrEqual(4);
      });
    });
  }

  it("pharmacy's restrictions question surfaces the real curated safety constraint, not a generic one", async () => {
    const profile = await getRoleProfile("Pharmacy Intern");
    const questions = buildClarificationQuestions(["restrictions"], profile);
    expect(questions[0].type).toBe("freeform");
    expect(questions[0].description).toContain("diagnose");
  });

  it("NO MINIMUM: zero missing slots produces zero questions — not an error, not a forced fallback question", async () => {
    const profile = await getRoleProfile("Pharmacy Intern"); // curated — no live model call
    expect(buildClarificationQuestions([], profile)).toEqual([]);
  });
});

describe("resolveQuestionType", () => {
  it("candidate_level is fixed to single no matter what the model suggests", () => {
    expect(resolveQuestionType("candidate_level", "freeform")).toBe("single");
    expect(resolveQuestionType("candidate_level", "multiple")).toBe("single");
  });

  it("responsibilities/tools_technologies are fixed to multiple no matter what the model suggests", () => {
    expect(resolveQuestionType("responsibilities", "single")).toBe("multiple");
    expect(resolveQuestionType("tools_technologies", "freeform")).toBe("multiple");
  });

  it("work_environment is the one slot allowed to follow the model's suggestion", () => {
    expect(resolveQuestionType("work_environment", "multiple")).toBe("multiple");
    expect(resolveQuestionType("work_environment", "single")).toBe("single");
  });
});

describe("resolveMissingSlots", () => {
  it("uses the model's picked slots when confidence is high", () => {
    expect(resolveMissingSlots("high", ["responsibilities", "tools_technologies"])).toEqual(["responsibilities", "tools_technologies"]);
  });

  it("drops profile-dependent slots when confidence is low — never guesses role-specific choices from a mismatched profile", () => {
    expect(resolveMissingSlots("low", ["responsibilities", "tools_technologies"])).toEqual([]);
  });

  it("keeps profile-independent slots when confidence is low — those never depended on the profile match", () => {
    expect(resolveMissingSlots("low", ["candidate_level", "responsibilities", "restrictions"])).toEqual(["candidate_level", "restrictions"]);
  });

  it("never invents a slot the model didn't flag, even at low confidence", () => {
    // Old behavior hardcoded ["candidate_level", "special_company_context"]
    // regardless of what the model actually said — that's exactly the
    // "required minimum" this must never do again.
    expect(resolveMissingSlots("low", [])).toEqual([]);
    expect(resolveMissingSlots("low", null)).toEqual([]);
  });

  it("defaults to an empty array when nothing was provided", () => {
    expect(resolveMissingSlots(null, null)).toEqual([]);
  });

  it("NO MINIMUM: a fully-specified request resolves to zero slots — this is the expected, common case, not a fallback failure", () => {
    expect(resolveMissingSlots("high", [])).toEqual([]);
    expect(resolveMissingSlots("high", null)).toEqual([]);
  });
});

describe("refineQuestions — deterministic quality pass, no LLM call", () => {
  function question(overrides: Partial<ClarificationQuestion> = {}): ClarificationQuestion {
    return { id: "q1", slot: "tools_technologies", prompt: "Which tools?", type: "multiple", required: false, ...overrides };
  }

  it("splits an obviously bundled choice into separate atomic choices", () => {
    const [refined] = refineQuestions([question({ choices: [{ value: "Python + FastAPI + React", label: "Python + FastAPI + React" }] })]);
    expect(refined.choices?.map((c) => c.value)).toEqual(["Python", "FastAPI", "React"]);
  });

  it("dedupes choices case-insensitively", () => {
    const [refined] = refineQuestions([
      question({ choices: [{ value: "Windows", label: "Windows" }, { value: "windows", label: "windows" }] }),
    ]);
    expect(refined.choices).toHaveLength(1);
  });

  it("caps choices at 8", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ value: `Choice ${i}`, label: `Choice ${i}` }));
    const [refined] = refineQuestions([question({ choices: many })]);
    expect(refined.choices).toHaveLength(8);
  });

  it("forces allowOther true whenever choices exist", () => {
    const [refined] = refineQuestions([question({ choices: [{ value: "A", label: "A" }], allowOther: false })]);
    expect(refined.allowOther).toBe(true);
  });

  it("leaves freeform questions (no choices) untouched", () => {
    const freeform = question({ type: "freeform", choices: undefined });
    const [refined] = refineQuestions([freeform]);
    expect(refined).toEqual(freeform);
  });
});

describe("role-profiles — curated lookup fuzzy matching", () => {
  // Raw employer slang ("IT guy intern") is the ROUTER's job to normalize
  // (an LLM call, tested separately/live) — getRoleProfile matches
  // already-normalized-ish names against the curated set, so these use
  // realistic router OUTPUT, not raw input.
  it("matches minor variations of a normalized role to the same curated profile", async () => {
    const [a, b] = await Promise.all([getRoleProfile("IT Technician Intern"), getRoleProfile("IT Technician")]);
    expect(a.normalizedRole).toBe("IT Technician Intern");
    expect(b.normalizedRole).toBe("IT Technician Intern");
  });

  it("every curated profile has atomic choices — no entry contains a bundling '+'", async () => {
    for (const profession of PROFESSIONS) {
      const profile: RoleProfile = await getRoleProfile(profession);
      for (const list of [profile.taskFamilies, profile.commonTools, profile.workEnvironments]) {
        for (const entry of list) expect(entry).not.toContain(" + ");
      }
    }
  });
});
