import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "./gemma-provider";
import { withGenerateRetries } from "./challenge-generation";
import { ClarificationQuestionSchema, type ClarificationQuestion } from "./challenge-clarification-schemas";

/**
 * ONE canonical routing decision, forced structured output — never a free
 * choice the model can sidestep by just answering in prose. This is the
 * fix for a real, reproduced regression: with agentic tool-calling
 * (toolChoice "auto"), the model was free to skip askClarifyingQuestions
 * entirely and narrate the clarification questions as plain numbered
 * Markdown instead. There is now no code path where the model can emit
 * clarification questions, or a challenge draft, as text — every action
 * below is a deterministic code branch (route.ts) that calls the real
 * generation pipeline directly and writes the structured data part
 * itself. The model's only remaining freedom is picking ONE of these
 * actions and, for "chat"/"decline", writing the actual reply text.
 *
 * When the action is "ask_clarifying_questions", the SAME call also
 * returns the actual questions (clarificationIntro/clarificationQuestions)
 * — there is deliberately no separate second generateObject call for
 * that path. An earlier version made two sequential model calls
 * (classify, then generate questions); that redundant second round-trip
 * is exactly the kind of unnecessary waterfall a 3-4-question form never
 * justified, and it doubled the worst-case latency for no benefit.
 *
 * Every optional field here is a flat primitive/array, never a nested
 * optional OBJECT — a real, previously-diagnosed bug (see
 * challenge-clarification-schemas.ts's aiUsagePolicy history) found that
 * a nullable/optional object field (as opposed to a primitive or array)
 * reliably triggers this model into hanging or degenerating. Embedding
 * `clarification: {intro, questions}.nullable().optional()` would recreate
 * that exact failure shape, so intro/questions are flat siblings instead.
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
   * about a challenge (ask_clarifying_questions / draft_challenge). */
  roleSummary: optionalText(300),
  /** The employer's exact revision feedback, verbatim, when draft_challenge
   * is updating an existing draft rather than creating a new one. */
  revisionInstruction: optionalText(500),
  /** Only populated when action is "ask_clarifying_questions". */
  clarificationIntro: optionalText(240),
  clarificationQuestions: z.array(ClarificationQuestionSchema).min(2).max(4).nullable().optional(),
});
export type AssistantRouterDecision = z.infer<typeof AssistantRouterDecisionSchema>;

export interface ClarificationResult {
  intro: string;
  questions: ClarificationQuestion[];
}

const ROUTER_TIMEOUT_MS = 25_000;
const ROUTER_ATTEMPTS = [{}, {}] as const;

const ROUTER_SYSTEM = `You are internIn's hiring assistant routing brain. Read the conversation and decide EXACTLY ONE action for the LATEST employer message.

- "decline": clearly unrelated to internship hiring/programs (e.g. write me a game, general trivia). A request that uses a similar format but serves a real hiring purpose (e.g. "make a Snake-style coding challenge for our software engineering intern") is NOT a decline — treat it as ask_clarifying_questions or draft_challenge.
- "chat": a greeting, thanks, general question about internIn/hiring concepts, or something answerable without looking up real data or building a challenge.
- "check_data": asking about real current numbers/status (applicants, stages, deadlines, activity, an internship's status).
- "ask_clarifying_questions": wants a challenge/assessment built or revised, but a genuinely important detail is missing (day-to-day work, tools/tech, safety-relevant scope, seniority) that would materially change the result.
- "draft_challenge": wants a challenge built/revised AND already gave (or a prior questionnaire already established) enough concrete context, OR is giving feedback on an existing draft ("make it easier", "remove a task", "add an Excel part").

Never pick ask_clarifying_questions out of habit when the message already has enough detail — pick draft_challenge directly. Never invent context.

For roleSummary/revisionInstruction: set roleSummary for any challenge-related action; set revisionInstruction only for draft_challenge when a draft already exists in the conversation and they're giving feedback on it.

When (and ONLY when) action is "ask_clarifying_questions", ALSO fill in clarificationIntro and clarificationQuestions IN THIS SAME RESPONSE — do not leave that for a later step:
- clarificationIntro: one short, natural sentence (e.g. "I can help with that — I just need a few details first.").
- clarificationQuestions: 2-4 questions covering ONLY what's actually missing, in priority order: (1) candidate level/experience, (2) main responsibilities/work area, (3) tools/environment when it would change the task, (4) real constraints, when relevant. Skip anything already given.

Some questions are universal and don't need reinventing: for candidate level, use "What level of student or candidate are you targeting?" (type "single", choices like "First/second year student", "Third/final year student", "Recent graduate", "No preference", allowOther true). For everything role-specific (responsibilities, tools/systems), generate real domain-specific choices for THIS profession.

Choose each question's type from its own semantics — pick deliberately, never default to one type:
- "single": only one primary answer makes sense (candidate level, primary environment, internship mode).
- "multiple": several answers can be true at once (responsibilities, technologies/systems/tools, skills, types of work). A database intern can write SQL AND clean data AND maintain schemas simultaneously — forcing one answer is wrong. Most technology/responsibility questions are "multiple".
- "freeform": ONLY when useful predefined choices genuinely can't cover it (an unusual company-specific constraint) — mark it optional (required: false). Do not default to freeform, and do not default to single.

For "single"/"multiple" questions with predictable answers, ALWAYS give concrete domain-specific choices (5-8 typical) plus allowOther: true — never leave a question as pure freeform when good choices exist. Add a "Not sure yet" choice for technology/tool questions when genuinely useful. Mark a question required only when the challenge truly cannot be designed without it — most should be optional so the employer can skip what they're unsure of. Do not ask a 4th question just to reach four.`;

/**
 * Classifies what the assistant should do next, generating the actual
 * clarification questions inline when relevant — see the module doc
 * comment for why this is ONE call, not two. Capped maxOutputTokens: this
 * response is small by construction (a routing decision plus at most 4
 * short questions), and a low ceiling turns a runaway generation into a
 * fast, clean truncation instead of a long hang.
 */
export async function classifyAssistantRequest(transcript: string): Promise<AssistantRouterDecision> {
  return withGenerateRetries("classifyAssistantRequest", ROUTER_ATTEMPTS, async () => {
    const { object } = await generateObject({
      model: getModel(),
      schema: AssistantRouterDecisionSchema,
      system: ROUTER_SYSTEM,
      prompt: `Conversation so far:\n${transcript}`,
      maxOutputTokens: 1500,
      abortSignal: AbortSignal.timeout(ROUTER_TIMEOUT_MS),
    });
    return object;
  });
}
