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
- "ask_clarifying_questions": wants a challenge built/revised, but real context is missing. Set normalizedRole (a clean professional title, e.g. "IT guy intern" -> "IT Technician Intern"), roleConfidence, and missingSlots.
- "draft_challenge": wants a challenge built/revised AND already gave (or a prior questionnaire already established) enough concrete context, OR is giving feedback on an existing draft. Set roleSummary and revisionInstruction (when a draft already exists and they're giving feedback on it).

Never pick ask_clarifying_questions out of habit when the message already has enough detail — pick draft_challenge directly. Never invent context.

For "ask_clarifying_questions", pick missingSlots from EXACTLY these 8 values, choosing only what's genuinely missing and would materially change the result, in this priority order — never more than 4:
1. candidate_level — their year of study / experience level.
2. responsibilities — what they'll actually spend time doing. Almost always worth asking unless the employer already described real day-to-day work.
3. tools_technologies — specific tools/systems/tech, when the choice would change the task.
4. work_environment — office/remote/site type, when it would change the assessment.
5. expected_deliverables — what they should produce, when not obvious from responsibilities.
6. access_level — how much system/data access/oversight, when relevant.
7. restrictions — things they must NOT do unsupervised, mainly for safety-sensitive or access-sensitive roles.
8. special_company_context — anything unusual about this specific company/team.

Set roleConfidence to "low" only when the role itself is too ambiguous to know the profession (e.g. "someone for lab work" could be chemistry, biology, or IT) — in that case still normalize your best guess but mark confidence low so the app asks what the role actually is instead of guessing specifics.`;

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
