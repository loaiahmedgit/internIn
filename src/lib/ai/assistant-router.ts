import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "./gemma-provider";
import { withGenerateRetries } from "./challenge-generation";
import { InformationSlotSchema } from "./role-profiles";

/**
 * ONE canonical routing decision, forced structured output — never a free
 * choice the model can sidestep by just answering in prose (see the
 * regression this fixed: the model narrating clarification questions as
 * plain numbered Markdown when tool-calling was optional).
 *
 * For "ask_clarifying_questions", the model's job here is deliberately
 * SMALL: normalize the role and pick which of 8 fixed information SLOTS
 * are missing — it does NOT write question text or choices. That's the
 * actual fix for "unpredictable quality across professions": a slot's
 * question TYPE and phrasing are fixed, code-owned facts (see
 * clarification-engine.ts); role-specific CHOICES come from a
 * RoleProfile (role-profiles.ts, curated or generated once and cached),
 * never invented fresh by the model per question. The model choosing
 * from a closed 8-value enum is also a much smaller, more reliable
 * generation than writing full question objects — this is the fast path.
 *
 * Every optional field here is a flat primitive/array, never a nested
 * optional OBJECT — a real, previously-diagnosed bug (see
 * challenge-clarification-schemas.ts's aiUsagePolicy history) found that
 * a nullable/optional object field reliably triggers this model into
 * hanging or degenerating.
 */
export const AssistantActionSchema = z.enum([
  "decline", // Clearly out of scope — briefly redirect, no other work.
  "chat", // A normal question/greeting/analysis that needs no real data lookup.
  "check_data", // Needs real, current workspace/internship data to answer.
  "ask_clarifying_questions", // Wants a challenge built/revised but real context is missing.
  "draft_challenge", // Enough context exists to create or revise a challenge draft now.
]);
export type AssistantAction = z.infer<typeof AssistantActionSchema>;

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const AssistantRouterDecisionSchema = z.object({
  action: AssistantActionSchema,
  /** One sentence summarizing the internship role/work, when the action is
   * about a challenge. For ask_clarifying_questions/draft_challenge, this
   * doubles as the input to role normalization/RoleProfile lookup. */
  roleSummary: optionalText(300),
  /** The employer's exact revision feedback, verbatim, when draft_challenge
   * is updating an existing draft rather than creating a new one. */
  revisionInstruction: optionalText(500),
  /** The role reduced to a clean, professional title (e.g. "IT guy
   * intern" -> "IT Technician Intern"). Only set for
   * ask_clarifying_questions/draft_challenge. */
  normalizedRole: optionalText(120),
  /** "low" when the role itself is too vague to know what profession
   * this even is (e.g. "someone for lab work" — chemistry? biology? a
   * computer lab?). When low, the app asks what the role actually IS
   * rather than guessing role-specific responsibilities/tools out of a
   * RoleProfile that would just be a fabricated guess. */
  roleConfidence: z.enum(["high", "low"]).nullable().optional(),
  /** ONLY for ask_clarifying_questions: which of the 8 fixed information
   * slots are actually missing, in priority order. 2-4 entries. The
   * model picks WHICH slots; it never writes the question itself. */
  missingSlots: z.array(InformationSlotSchema).min(1).max(4).nullable().optional(),
});
export type AssistantRouterDecision = z.infer<typeof AssistantRouterDecisionSchema>;

const ROUTER_TIMEOUT_MS = 20_000;
const ROUTER_ATTEMPTS = [{}, {}] as const;

const ROUTER_SYSTEM = `You are internIn's hiring assistant routing brain. Read the conversation and decide EXACTLY ONE action for the LATEST employer message.

- "decline": clearly unrelated to internship hiring/programs (e.g. write me a game, general trivia). A request that uses a similar format but serves a real hiring purpose (e.g. "make a Snake-style coding challenge for our software engineering intern") is NOT a decline — treat it as ask_clarifying_questions or draft_challenge.
- "chat": a greeting, thanks, general question about internIn/hiring concepts, or something answerable without looking up real data or building a challenge.
- "check_data": asking about real current numbers/status (applicants, stages, deadlines, activity, an internship's status).
- "ask_clarifying_questions": wants a challenge built/revised, but something REQUIRED is genuinely missing (see below). Set normalizedRole (a clean professional title, e.g. "IT guy intern" -> "IT Technician Intern"), roleConfidence, and missingSlots.
- "draft_challenge": wants a challenge built/revised AND nothing REQUIRED is missing (or a prior questionnaire already established it), OR is giving feedback on an existing draft. Set roleSummary and revisionInstruction (when a draft already exists and they're giving feedback on it).

THERE IS NO MINIMUM NUMBER OF CLARIFYING QUESTIONS. Zero is the expected outcome for a well-described request. Before deciding anything, extract every piece of information the employer's own message ALREADY gives you — directly or implicitly. Never ask about something already answered in the message, even loosely. Your job is to notice what's already there; internIn's separate job (not yours) is to design the actual challenge from it, filling ordinary details itself the way a competent hiring designer would.

This is a DYNAMIC count, not a fixed one in either direction — the goal is the minimum number of questions that avoids inventing important employer context, which for a genuinely vague request is normally 2-3, not 1:

REQUIRED (worth a clarifying question, but ONLY if genuinely still unknown after reading the message):
- the role itself is ambiguous (you can't tell what profession/domain this is)
- the actual responsibilities/area of work are unclear (the employer named a role but gave no sense of the real day-to-day work, or the role itself spans genuinely different kinds of work — e.g. "web developer" could mean frontend, backend, full-stack, or QA, each a different challenge)
- candidate level, whenever the request's scope is still broad/unbounded — if you don't yet know the actual scope of work, you also can't know whether difficulty matters, so treat level as REQUIRED alongside responsibilities for a broad, no-detail request. It becomes safely skippable only once the message itself narrows the difficulty (an explicit level, or wording that pins the bar regardless of level, like "basic/common issues" or "doesn't matter")
- specific tools/technologies, but ONLY when the chosen area of work would use genuinely different tech depending on the answer (e.g. "web developer" with no area given yet — frontend vs. backend vs. full-stack use different stacks entirely) — always offer a "No preference / let internIn choose" choice so this never blocks on it
- safety or access restrictions, when the role plausibly involves something a candidate must NOT do unsupervised
- unusual company-specific context, but ONLY when the employer's own message signals something unusual actually applies (a specific real deliverable, a specific real constraint) — never as a generic "tell us more"

OPTIONAL (do NOT generate a question for these just because they weren't mentioned — design a safe, realistic synthetic challenge without them):
- exact tools/technologies, once the area of work is either already narrow (a specific stack was named) or itself made the tech choice moot
- expected deliverables
- work environment (remote/onsite/hybrid)
- generic company details

An empty slot is not by itself a reason to ask. Ask ONLY when the missing piece would materially change what the challenge actually tests, or risks the challenge inventing a specific fact about the employer's real company/clients/operations that wasn't given. When in doubt about ONE borderline slot, prefer draft_challenge; when the WHOLE request is bare (a role name and nothing else), ask — a single question for a genuinely under-specified request is itself under-asking.

Worked examples — treat both patterns as correct:

Employer: "I want a technical student to fix computers when small problems happen. School, university, or graduate doesn't matter. Mostly normal computer and software issues."
Correct: action = "draft_challenge" (not ask_clarifying_questions), zero missingSlots. Role (IT Support Intern), responsibilities (basic computer/software troubleshooting, reactive user support), and scope (common issues, not specialized) are all already given; candidate level was explicitly said not to matter. Do not ask about candidate level, exact tools, or expected deliverables here.

Employer: "I want to hire a web dev intern."
Correct: action = "ask_clarifying_questions" with normalizedRole "Web Developer Intern", missingSlots = ["responsibilities", "candidate_level", "tools_technologies"] (all three, not just one). Nothing about the actual area of work is given — "web developer" spans frontend/backend/full-stack/QA, each a genuinely different challenge; the scope is completely open, so candidate level is not yet safely skippable; and the tech stack question depends entirely on which area they pick. Asking only "what will they work on?" and drafting from that alone would still leave level and tools unresolved — a single question here is under-asking, not the good kind of restraint.

For "ask_clarifying_questions", pick missingSlots from EXACTLY these 8 values — 1 to 4, only the ones that are REQUIRED per above and still genuinely unknown:
1. candidate_level
2. responsibilities
3. tools_technologies
4. work_environment
5. expected_deliverables
6. access_level
7. restrictions
8. special_company_context

Set roleConfidence to "low" only when the role itself is too ambiguous to know the profession (e.g. "someone for lab work" could be chemistry, biology, or IT) — in that case still normalize your best guess but mark confidence low so the app can avoid guessing role-specific specifics from a mismatched profile.`;

/**
 * Classifies what the assistant should do next. This call is intentionally
 * SMALL — it never writes a question, a choice list, or a challenge draft,
 * only a routing decision plus (for ask_clarifying_questions) a role
 * normalization and a handful of enum picks. Capped maxOutputTokens for
 * the same reason: a small, well-bounded response is faster and less
 * prone to the runaway-generation failure mode this model has shown for
 * larger free-form outputs.
 */
export async function classifyAssistantRequest(transcript: string): Promise<AssistantRouterDecision> {
  return withGenerateRetries("classifyAssistantRequest", ROUTER_ATTEMPTS, async () => {
    const { object } = await generateObject({
      model: getModel(),
      schema: AssistantRouterDecisionSchema,
      system: ROUTER_SYSTEM,
      prompt: `Conversation so far:\n${transcript}`,
      maxOutputTokens: 600,
      abortSignal: AbortSignal.timeout(ROUTER_TIMEOUT_MS),
    });
    return object;
  });
}
