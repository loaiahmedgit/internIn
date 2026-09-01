import { generateObject } from "ai";
import { getModel } from "./gemma-provider";
import { ChallengeDraftSchema, type ChallengeDraft } from "./challenge-clarification-schemas";
import type { QuestionnaireAnswer } from "./assistant-messages";

export const CHALLENGE_POLICY = `When an employer describes an internship role (even vaguely) and wants a work challenge / assessment / task for it, you can help design one — this is core to what you do.

A challenge is a realistic SIMULATION of the actual internship work, never a generic quiz. Depending on the profession, mix practical tasks, a scenario, open-ended questions, choice questions, code, spreadsheet work, design work, file/document review, or a written deliverable — whatever fits the real work, never one uniform question type for every role.

Before drafting, decide honestly whether you already have enough concrete context (what they'll actually do day to day, tools/tech involved, and anything that affects difficulty, required competencies, safety, or scope). If the employer's own message already gives that, call draftOrReviseChallenge directly — do not force a questionnaire out of habit. If a genuinely important detail is missing and guessing it would change the assessment's substance (safety, difficulty, competencies tested, format, responsibilities, seniority, deliverable), call askClarifyingQuestions instead.

For safety-sensitive professions (healthcare, pharmacy, legal, cybersecurity, engineering, etc.), only ever design SAFE SIMULATED tasks using synthetic/fictional data — documentation, prioritization, escalation judgment, safe procedural scenarios. Never have a candidate perform real diagnosis, real prescribing/dispensing, real unsupervised clinical decisions, a real attack on a real system, or present output as real legal/medical advice.

Rubric criteria must be observable and job-relevant (e.g. "SQL correctness — 30%"), never vague or unrelated to the defined task (never "culture fit", "confidence", appearance, or any protected/personal characteristic). Difficulty should match an internship level, not a seasoned professional, unless the employer asks otherwise.

Once a draft exists, keep revising the SAME draft as the employer gives feedback ("make it easier", "remove the second task", "add an Excel part") — call draftOrReviseChallenge again for that, don't start over. A draft is never published or saved automatically; the employer reviews and explicitly saves it.`;

export const CLARIFICATION_POLICY = `Establish, in priority order, only what's actually missing:
1. Candidate level / expected experience (e.g. year of study, junior vs. more advanced).
2. Main responsibilities / work area — what they'll actually spend time on.
3. Tools / environment, when the choice would change the task (e.g. which database, which stack).
4. Real constraints or supervisor-only responsibilities, when relevant (e.g. things they must NOT do unsupervised).

Skip anything already given. Never ask more than needed to cover what's missing — 2-4 questions, not one per topic out of habit.

Ask questions the employer can realistically answer about THEIR role, never questions that ask them to design the assessment for you (bad: "What exact realistic task should we give them?" — deciding that is internIn's job, not theirs). Prefer fixed choices when likely answers are predictable, with an "Other" option; use freeform only when they aren't. Mark a question required only when the challenge genuinely cannot be designed without it — most should be optional (required: false) so the employer can skip anything they're unsure of.`;

/** One human-readable line per answer, "(not specified — use your best
 * professional judgment)" for a skipped optional question — never the
 * literal string "(skipped)" fed to the model as if it were real data. */
export function formatQuestionnaireAnswers(answers: QuestionnaireAnswer[]): string {
  return answers.map((a) => `- ${a.prompt} — ${a.answer ?? "(not specified — use your best professional judgment)"}`).join("\n");
}

/** A safe, user-visible "why this looks the way it does" summary, derived
 * entirely from the real generated draft's own fields — never the model's
 * raw hidden reasoning, never fabricated. Rendered via the Reasoning
 * component and collapsed automatically once shown. */
export function buildDesignSummary(draft: ChallengeDraft): string[] {
  const lines: string[] = [`Designing a ${draft.role.toLowerCase()} challenge around: ${draft.objective}`];
  if (draft.competencies.length) lines.push(`Testing: ${draft.competencies.map((c) => c.name).join(", ")}`);
  if (draft.materials.length) lines.push(`Preparing synthetic materials: ${draft.materials.map((m) => m.name).join(", ")}`);
  lines.push(`Sizing it for about ${draft.estimatedMinutes} minutes`);
  if (draft.safetyNotes?.length) lines.push(`Keeping it a safe simulation: ${draft.safetyNotes.join(" ")}`);
  if (draft.assumptions?.length) lines.push(`Assumptions: ${draft.assumptions.join(" ")}`);
  return lines;
}

const ATTEMPTS = [
  { temperature: 0.5, extraInstruction: "" },
  {
    temperature: 0.2,
    extraInstruction:
      "\n\nIMPORTANT: your previous attempt did not finish — it ran out of space before completing valid output. Be significantly more concise: a shorter scenario, shorter prompts, fewer materials, and never repeat a sentence or phrase. Every field must be fully complete well before you'd run out of room.",
  },
] as const;

/**
 * Generates (or revises) a ChallengeDraft, with one automatic retry at a
 * lower temperature and an explicit "be more concise" nudge if the first
 * attempt fails. This exists because the real, observed failure mode is
 * the model hitting its output-token ceiling mid-JSON (finishReason:
 * "length", degenerating into repeated filler) on the first pass — a
 * NoObjectGeneratedError that must not be allowed to silently kill the
 * whole assistant turn. Both the free-chat "draft directly" path and the
 * deterministic post-questionnaire path share this one implementation.
 */
export async function generateChallengeDraftObject(params: {
  roleSummary: string;
  contextBlock: string;
  existingDraft: ChallengeDraft | null;
}): Promise<ChallengeDraft> {
  const { roleSummary, contextBlock, existingDraft } = params;
  const basePrompt = existingDraft
    ? `Internship role: ${roleSummary}\n\nCurrent draft (JSON):\n${JSON.stringify(existingDraft)}\n\n${contextBlock}`
    : `Internship role: ${roleSummary}\n\n${contextBlock}`;

  let lastError: unknown;
  for (const attempt of ATTEMPTS) {
    try {
      const { object } = await generateObject({
        model: getModel(),
        schema: ChallengeDraftSchema,
        system: `${CHALLENGE_POLICY}\n\nReturn the FULL challenge draft object (not a diff), reusing everything from the current draft that the employer didn't ask to change. Keep every field concise — a few sentences at most — so the whole object fits comfortably; never pad or repeat text.`,
        prompt: basePrompt + attempt.extraInstruction,
        temperature: attempt.temperature,
        abortSignal: AbortSignal.timeout(90_000),
      });
      return object;
    } catch (error) {
      lastError = error;
      // Real failure detail belongs server-side only — never surfaced to
      // the client as raw stack/JSON.
      console.error("[assistant] challenge draft generation attempt failed:", error instanceof Error ? error.message : error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Challenge draft generation failed.");
}
