import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "./gemma-provider";

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
 */
export const AssistantActionSchema = z.enum([
  "decline", // Clearly out of scope — briefly redirect, no other work.
  "chat", // A normal question/greeting/analysis that needs no real data lookup.
  "check_data", // Needs real, current workspace/internship data to answer.
  "ask_clarifying_questions", // Wants a challenge built/revised but real context is missing.
  "draft_challenge", // Enough context exists to create or revise a challenge draft now.
]);
export type AssistantAction = z.infer<typeof AssistantActionSchema>;

export const AssistantRouterDecisionSchema = z.object({
  action: AssistantActionSchema,
  /** One sentence summarizing the internship role/work, when the action is
   * about a challenge (ask_clarifying_questions / draft_challenge).
   * Omitted for other actions. */
  roleSummary: z.string().trim().max(300).nullable().optional(),
  /** The employer's exact revision feedback, verbatim, when draft_challenge
   * is updating an existing draft rather than creating a new one. */
  revisionInstruction: z.string().trim().max(500).nullable().optional(),
});
export type AssistantRouterDecision = z.infer<typeof AssistantRouterDecisionSchema>;

const ROUTER_SYSTEM = `You are the routing brain for internIn's hiring assistant. Read the conversation and decide EXACTLY ONE action — you do not answer the employer directly here, you only classify what should happen next.

- "decline": the request is clearly unrelated to internship hiring/programs (e.g. write me a game, general trivia). A request that uses a similar format but serves a real hiring purpose (e.g. "make a Snake-style coding challenge for our software engineering intern") is NOT a decline — treat it as ask_clarifying_questions or draft_challenge.
- "chat": a greeting, thanks, general question about internIn/hiring concepts, or something answerable without looking up real data or building a challenge.
- "check_data": the employer is asking about real current numbers/status (applicants, stages, deadlines, activity, an internship's status).
- "ask_clarifying_questions": the employer wants a challenge/assessment built or revised, but a genuinely important detail is missing (day-to-day work, tools/tech, safety-relevant scope, seniority) that would materially change the result. Set roleSummary to one sentence describing the role as given so far.
- "draft_challenge": the employer wants a challenge built/revised AND already gave (or a prior questionnaire already established) enough concrete context, OR is giving feedback on an existing draft ("make it easier", "remove a task", "add an Excel part"). Set roleSummary, and set revisionInstruction to their exact feedback verbatim if a draft already exists in the conversation.

Never pick ask_clarifying_questions out of habit when the employer's message already has enough detail — pick draft_challenge directly. Never invent context; that's what ask_clarifying_questions is for.`;

/**
 * Classifies what the assistant should do next. Retried internally (via
 * withGenerateRetries's caller — see challenge-generation.ts for the same
 * pattern) is intentionally NOT done here: this call is small and cheap,
 * and a failure here should surface as a normal error rather than delay
 * routing by tens of seconds retrying a classification.
 */
export async function classifyAssistantRequest(transcript: string): Promise<AssistantRouterDecision> {
  const { object } = await generateObject({
    model: getModel(),
    schema: AssistantRouterDecisionSchema,
    system: ROUTER_SYSTEM,
    prompt: `Conversation so far:\n${transcript}\n\nClassify the action for the LATEST employer message.`,
    abortSignal: AbortSignal.timeout(20_000),
  });
  return object;
}
