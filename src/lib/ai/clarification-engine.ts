import type { ClarificationChoice, ClarificationQuestion } from "./challenge-clarification-schemas";
import { resolveQuestionType, type InformationSlot, type RoleProfile } from "./role-profiles";

/**
 * Deterministically builds real ClarificationQuestion objects from a
 * missing-information slot plus a RoleProfile — this is the fix for
 * "unpredictable quality across professions": question TEXT and CHOICES
 * still vary by profession (from the RoleProfile), but the STRUCTURE
 * (which slot maps to which question type, universal vs role-specific
 * phrasing) is the same fixed code path for every profession. The model
 * never invents a question from scratch for these slots.
 */

function toChoices(values: string[], max = 8): ClarificationChoice[] {
  return values.slice(0, max).map((value) => ({ value, label: value }));
}

function buildQuestion(slot: InformationSlot, profile: RoleProfile): ClarificationQuestion | null {
  switch (slot) {
    case "candidate_level":
      // Universal — this is the same question for every profession, on
      // purpose (Part 5 of the request: "The AI does NOT need to
      // reinvent this question every time").
      return {
        id: slot,
        slot,
        prompt: "What level of student or candidate are you targeting?",
        type: "single",
        required: false,
        choices: toChoices(["First/second year student", "Third/final year student", "Recent graduate", "No preference"]),
        allowOther: true,
      };

    case "responsibilities":
      if (profile.taskFamilies.length === 0) return null;
      return {
        id: slot,
        slot,
        prompt: "What will they mainly work on?",
        type: "multiple",
        required: true,
        choices: toChoices(profile.taskFamilies),
        allowOther: true,
      };

    case "tools_technologies": {
      if (profile.commonTools.length === 0) return null;
      const choices = toChoices(profile.commonTools);
      choices.push({ value: "Not sure yet", label: "Not sure yet" });
      return {
        id: slot,
        slot,
        prompt: "Which tools or systems will they work with?",
        type: "multiple",
        required: false,
        choices,
        allowOther: true,
      };
    }

    case "work_environment":
      if (profile.workEnvironments.length === 0) return null;
      return {
        id: slot,
        slot,
        prompt: "What environment will they mainly work in?",
        // The one slot allowed to vary — defaults to "single" (one
        // primary environment is the common case); resolveQuestionType
        // is still the single place this decision is made, not each
        // question inventing its own.
        type: resolveQuestionType(slot, "single"),
        required: false,
        choices: toChoices(profile.workEnvironments),
        allowOther: true,
      };

    case "expected_deliverables":
      if (profile.typicalDeliverables.length === 0) return null;
      return {
        id: slot,
        slot,
        prompt: "What should they produce or hand off by the end?",
        type: "multiple",
        required: false,
        choices: toChoices(profile.typicalDeliverables),
        allowOther: true,
      };

    case "access_level":
      // Universal — genuinely the same regardless of profession; what
      // varies is whether it's worth asking at all (route.ts only
      // includes slots the router actually flagged as missing).
      return {
        id: slot,
        slot,
        prompt: "What level of access or oversight will they have?",
        type: "single",
        required: false,
        choices: toChoices(["View-only / shadowing", "Limited access with supervision", "Standard access with routine oversight", "Not sure yet"]),
        allowOther: true,
      };

    case "restrictions":
      return {
        id: slot,
        slot,
        prompt: "Anything they should NOT do unsupervised?",
        description: profile.safetyConstraints.length ? `For example: ${profile.safetyConstraints[0]}` : undefined,
        type: "freeform",
        required: false,
      };

    case "special_company_context":
      return {
        id: slot,
        slot,
        prompt: "Anything specific or unusual about your company/team we should account for?",
        type: "freeform",
        required: false,
      };

    default:
      return null;
  }
}

/** Slots whose question text and choices are universal — hardcoded in
 * buildQuestion above, never pulled from a RoleProfile. Safe to ask even
 * when the role itself is too ambiguous to have matched a real profile. */
const PROFILE_INDEPENDENT_SLOTS: readonly InformationSlot[] = ["candidate_level", "access_level", "restrictions", "special_company_context"];

/**
 * NEVER invents a slot the router didn't actually flag, and never enforces
 * a minimum question count — "no minimum" is a real product requirement
 * (see assistant-router.ts's ROUTER_SYSTEM: only ask what would materially
 * change the challenge or risks inventing company context). The one real
 * filter here: when role normalization confidence is low (the profession
 * itself is too ambiguous — "someone for lab work"), a profile-DEPENDENT
 * slot (responsibilities/tools_technologies/work_environment/
 * expected_deliverables) would show choices pulled from a RoleProfile
 * matched to a role we're not even confident about — those get dropped.
 * Profile-independent slots (candidate_level, access_level, restrictions,
 * special_company_context) stay exactly as the model flagged them; this
 * function adds nothing it wasn't told.
 */
export function resolveMissingSlots(roleConfidence: "high" | "low" | null | undefined, modelMissingSlots: InformationSlot[] | null | undefined): InformationSlot[] {
  const flagged = modelMissingSlots ?? [];
  if (roleConfidence !== "low") return flagged;
  return flagged.filter((slot) => PROFILE_INDEPENDENT_SLOTS.includes(slot));
}

export function buildClarificationQuestions(missingSlots: InformationSlot[], profile: RoleProfile): ClarificationQuestion[] {
  const questions: ClarificationQuestion[] = [];
  const seen = new Set<InformationSlot>();
  for (const slot of missingSlots) {
    if (seen.has(slot)) continue; // a slot only ever produces one question
    seen.add(slot);
    const question = buildQuestion(slot, profile);
    if (question) questions.push(question);
    if (questions.length >= 4) break; // never more than 4, regardless of how many slots were flagged
  }
  return refineQuestions(questions);
}

/**
 * Deterministic quality pass (Part 6 of the request) — no LLM call needed
 * for any of these rules. Fixes issues in place rather than merely
 * rejecting: dedupes choices, caps choice count, splits an obviously
 * bundled choice ("Python + FastAPI + React" -> three choices), and
 * guarantees "Other" is offered wherever fixed choices exist.
 */
export function refineQuestions(questions: ClarificationQuestion[]): ClarificationQuestion[] {
  return questions.map((question) => {
    if (!question.choices?.length) return question;

    const expanded = question.choices.flatMap((choice) =>
      choice.value.includes(" + ") ? choice.value.split(" + ").map((part) => ({ value: part.trim(), label: part.trim() })) : [choice],
    );

    const seenValues = new Set<string>();
    const deduped = expanded.filter((choice) => {
      const key = choice.value.trim().toLowerCase();
      if (seenValues.has(key)) return false;
      seenValues.add(key);
      return true;
    });

    // Force true, not `?? true`: the whole point of this pass is to fix a
    // quality gap, including a question that came in with allowOther
    // explicitly false/missing — Part 6's own checklist ("Is Other
    // available where appropriate?") is a thing to CORRECT, not just
    // check.
    return { ...question, choices: deduped.slice(0, 8), allowOther: true };
  });
}
