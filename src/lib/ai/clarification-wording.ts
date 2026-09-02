import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "./gemma-provider";
import { withGenerateRetries } from "./challenge-generation";

/**
 * Surface realization only. Role Intelligence (role-intelligence.ts)
 * decides WHICH two work scopes to contrast — that semantic decision is
 * untouched by this file. This module's only job is turning an already-
 * correct-but-mechanically-assembled question into one a normal person
 * would actually ask, without changing what is being asked.
 */

const NATURALIZE_TIMEOUT_MS = 15_000;
const NATURALIZE_ATTEMPTS = [{}, {}] as const;

const NaturalClarificationSchema = z.object({
  question: z.string().trim().min(10).max(220),
});

const NATURALIZE_SYSTEM = `You rewrite ONE hiring clarification question so it reads like a normal person asked it, not like extracted phrases were concatenated.

Rules:
- Preserve the exact distinction being asked about. Never change what is being contrasted, never add a third option, never invent a fact about the employer's business that wasn't already implied by the input question.
- Output ONE short, conversational sentence. The usual shape is "Will they mainly [concrete action], or also [different concrete action]?", but adjust grammar and wording freely as long as the meaning is identical.
- Merge overlapping or redundant phrases into one natural clause instead of listing near-duplicates (e.g. "track support requests" and "manage support request queue" both describe organizing an incoming queue — say that once: "organize and triage incoming support tickets").
- Never repeat the same important word two or more times in the sentence (for example, never write "...support broader customer support" — a word must not appear as both a template connector and inside the described scope; rephrase one of them).
- Prefer plain, concrete verbs (organize, triage, respond, manage, prepare, review, coordinate) over stiff or repeated wording from the input when it reads awkwardly.
- Never use "broader responsibilities" or "broader X operations" if the input already gives a concrete alternative activity — describe that concrete activity instead. Only keep vague "broader" wording when the input itself has nothing more concrete to offer.
- If the input already reads naturally, return it unchanged.
- Output only the rewritten question — no bullet points, no headings, no explanation.`;

/** Connector/grammar words expected to repeat in a normal English
 * question — never counted as the "same important word twice" smell. */
const CONNECTOR_WORDS = new Set([
  "will", "they", "mainly", "also", "or", "and", "to", "the", "a", "an", "of", "for", "with", "in", "on", "this",
  "that", "their", "them", "your", "you", "day", "work", "role", "person",
]);

/**
 * Deterministic quality gate, independent of any model call: flags the
 * exact "database fields concatenated" smell — a significant word (4+
 * letters, not a grammar connector) appearing two or more times in the
 * sentence. Generic across any domain; it has no idea what the words mean.
 */
export function looksRobotic(question: string): boolean {
  const words = question
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}\s'-]+/gu, " ")
    .split(/\s+/u)
    .filter((word) => word.length >= 4 && !CONNECTOR_WORDS.has(word));
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return [...counts.values()].some((count) => count >= 2);
}

/**
 * Rewrites an already-correct (but possibly mechanically assembled)
 * clarification question into natural language, preserving the exact
 * distinction. Fails open: any generation error, or a result that still
 * fails the deterministic quality gate after every attempt, falls back to
 * the original grounded-but-plainer question — never blocks the flow, and
 * never returns something worse than what came in.
 */
export async function naturalizeClarificationQuestion(rawQuestion: string): Promise<string> {
  try {
    const rewritten = await withGenerateRetries("naturalizeClarificationQuestion", NATURALIZE_ATTEMPTS, async () => {
      const { object } = await generateObject({
        model: getModel(),
        schema: NaturalClarificationSchema,
        system: NATURALIZE_SYSTEM,
        prompt: `Rewrite this clarification question naturally, preserving the exact same distinction:\n"${rawQuestion}"`,
        maxOutputTokens: 200,
        abortSignal: AbortSignal.timeout(NATURALIZE_TIMEOUT_MS),
      });
      const question = object.question.trim();
      if (looksRobotic(question)) throw new Error("naturalized question still repeats a significant word");
      return question;
    });
    return rewritten;
  } catch (error) {
    console.warn("[clarification-wording] naturalization failed or stayed repetitive; using the grounded question as-is:", error instanceof Error ? error.message : error);
    return rawQuestion;
  }
}
