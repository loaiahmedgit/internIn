import { generateObject } from "ai";
import { getModel } from "./gemma-provider";
import {
  ChallengeDraftGeneratedSchema,
  EmployerContextSchema,
  type ChallengeDraft,
  type ChallengeDraftGenerated,
  type EmployerContext,
} from "./challenge-clarification-schemas";
import type { QuestionnaireAnswer } from "./assistant-messages";

export const CHALLENGE_POLICY = `When an employer describes an internship role (even vaguely) and wants a work challenge / assessment / task for it, you can help design one — this is core to what you do.

A challenge is a realistic SIMULATION of the actual internship work, never a generic quiz. Depending on the profession, mix practical tasks, code, spreadsheet work, design work, file/document review, a written deliverable, or a presentation — whatever fits the real work, never one uniform task type for every role.

For safety-sensitive professions (healthcare, pharmacy, legal, cybersecurity, engineering, etc.), only ever design SAFE SIMULATED tasks using synthetic/fictional data — documentation, prioritization, escalation judgment, safe procedural scenarios. Never have a candidate perform real diagnosis, real prescribing/dispensing, real unsupervised clinical decisions, a real attack on a real system, or present output as real legal/medical advice.

Rubric criteria must be observable and job-relevant (e.g. "SQL correctness — 30%"), never vague or unrelated to the defined task (never "culture fit", "confidence", appearance, or any protected/personal characteristic). Difficulty should match the specified candidate level, not a seasoned professional, unless told otherwise.`;

export const CLARIFICATION_POLICY = `Establish, in priority order, only what's actually missing:
1. Candidate level / expected experience (e.g. year of study, junior vs. more advanced).
2. Main responsibilities / work area — what they'll actually spend time on.
3. Tools / environment, when the choice would change the task (e.g. which database, which stack).
4. Real constraints or supervisor-only responsibilities, when relevant (e.g. things they must NOT do unsupervised).

Skip anything already given. Never ask more than needed to cover what's missing — 2-4 questions, not one per topic out of habit.

Ask questions the employer can realistically answer about THEIR role, never questions that ask them to design the assessment for you (bad: "What exact realistic task should we give them?" — deciding that is internIn's job, not theirs).

Choose each question's type from its own semantics, never default to "single":
- A single primary target (e.g. "What level of student are you targeting?") -> "single".
- Several things can genuinely apply at once (e.g. "What will they spend most of their time doing?", "Which databases/tools will they work with?") -> "multiple". A database intern can write SQL AND clean data AND maintain schemas at the same time — forcing one answer there is wrong.
- An unpredictable or open detail (e.g. "Anything unusual about the work we should account for?") -> "freeform", and mark it optional (required: false).

For a "multiple" question about tools/technologies, offer "Other" and, when genuinely uncertain fits, a "Not sure yet" choice. Mark a question required only when the challenge genuinely cannot be designed without it — most should be optional (required: false) so the employer can skip anything they're unsure of.`;

/** One human-readable line per answer, "(not specified — use your best
 * professional judgment)" for a skipped optional question — never the
 * literal string "(skipped)" fed to the model as if it were real data. */
export function formatQuestionnaireAnswers(answers: QuestionnaireAnswer[]): string {
  return answers.map((a) => `- ${a.prompt} — ${a.answer ?? "(not specified — use your best professional judgment)"}`).join("\n");
}

/**
 * Builds the ONE canonical structured record of what the employer actually
 * said — the challenge generator consumes THIS, never a re-read of the raw
 * transcript, so a selection like "General database administration" +
 * "Oracle" can't quietly drift into an unrelated "Oracle Reporting"
 * challenge at generation time.
 */
export async function buildEmployerContext(params: { originalRequest: string; transcript: string; answers: QuestionnaireAnswer[] | null }): Promise<EmployerContext> {
  const { originalRequest, transcript, answers } = params;
  const answersBlock = answers?.length ? `\n\nThe employer's answers to clarification questions:\n${formatQuestionnaireAnswers(answers)}` : "";
  const { object } = await generateObject({
    model: getModel(),
    schema: EmployerContextSchema,
    system: `Extract a factual, structured record of an internship role from a hiring conversation. Report ONLY what was actually said or selected — an empty array means "not specified", never a guess. Do not invent a responsibility, tool, or restriction that wasn't mentioned.`,
    prompt: `Original request: ${originalRequest}${answersBlock}\n\nFull conversation:\n${transcript}`,
    abortSignal: AbortSignal.timeout(45_000),
  });
  return object;
}

/** A safe, user-visible "why this looks the way it does" summary, derived
 * entirely from the real generated draft's own fields — never the model's
 * raw hidden reasoning, never fabricated. Rendered via the Reasoning
 * component and collapsed automatically once shown. */
export function buildDesignSummary(draft: ChallengeDraftGenerated): string[] {
  const lines: string[] = [`Designing a ${draft.role.toLowerCase()} challenge around ${draft.skills.slice(0, 3).join(", ") || "the described work"}`];
  lines.push(`Matching ${draft.tasks.length} task${draft.tasks.length === 1 ? "" : "s"} to the selected responsibilities`);
  if (draft.materials.length) lines.push(`Preparing synthetic materials: ${draft.materials.map((m) => m.name).join(", ")}`);
  if (draft.durationMinutes) lines.push(`Sizing it for about ${draft.durationMinutes} minutes`);
  if (draft.safetyNotes.length) lines.push(`Keeping it a safe simulation: ${draft.safetyNotes.join(" ")}`);
  if (draft.assumptions.length) lines.push(`Assumptions: ${draft.assumptions.join(" ")}`);
  return lines;
}

// This model is genuinely flaky for this task — real diagnostic runs
// showed successful generations reliably finishing in well under 80s
// (39-58s observed), while unlucky draws don't just run *long*, they hang
// or degenerate into repeated filler indefinitely (one test ran past 400s
// with no timeout at all and never finished). A longer per-attempt wait
// doesn't rescue a hung draw — a FRESH one does. So: several independent
// attempts at a moderate timeout, not fewer attempts with more patience.
const ATTEMPT_TIMEOUT_MS = 75_000;
const ATTEMPTS = [
  { temperature: 0.5, extraInstruction: "" },
  { temperature: 0.35, extraInstruction: "\n\nBe concise — a few sentences per field is enough." },
  {
    temperature: 0.15,
    extraInstruction:
      "\n\nIMPORTANT: previous attempts did not finish in time. Be significantly more concise: shorter scenario, shorter task instructions, fewer materials, and never repeat a sentence or phrase.",
  },
] as const;

// Kept short and positively-phrased on purpose: an earlier, more elaborate
// version of this block ("do not introduce a tool/responsibility that
// isn't listed...") measurably triggered pathologically slow/degenerate
// generation in this model (multiple 130s+ timeouts, once past 400s with
// no timeout at all) — the same context, phrased plainly, succeeded in
// ~40s. Real, reproduced finding, not a guess — see the diagnostic
// scripts used to isolate it. The consistency goal (Part 9's "don't drift
// from the selected responsibilities/tools") is still served: everything
// the model needs is stated once, clearly, without a wall of negatives.
function contextBlockFrom(context: EmployerContext): string {
  const lines = [`Role: ${context.role}`];
  if (context.level) lines.push(`Candidate level: ${context.level}`);
  if (context.responsibilities.length) lines.push(`Main responsibilities: ${context.responsibilities.join(", ")}`);
  if (context.tools.length) lines.push(`Tools/technologies: ${context.tools.join(", ")}`);
  if (context.restrictions.length) lines.push(`Restrictions: ${context.restrictions.join(", ")}`);
  if (context.additionalContext) lines.push(`Additional context: ${context.additionalContext}`);
  return lines.join("\n");
}

/**
 * Generates (or revises) a ChallengeDraft from the canonical EmployerContext
 * — never from a re-serialized chat transcript. One automatic retry at a
 * lower temperature with an explicit "be more concise" nudge on failure
 * (the real, observed failure mode is the model hitting its output-token
 * ceiling mid-JSON). Returns the model's validated output only; id/status
 * assignment is attachDraftIdentity's job, kept separate so a control
 * field is never something the model influences.
 */
export async function generateChallengeDraftObject(params: {
  context: EmployerContext;
  existingDraft: ChallengeDraft | null;
  revisionInstruction?: string;
}): Promise<ChallengeDraftGenerated> {
  const { context, existingDraft, revisionInstruction } = params;
  const basePrompt = existingDraft
    ? `${contextBlockFrom(context)}\n\nCurrent draft (JSON):\n${JSON.stringify(existingDraft)}\n\nThe employer's revision instruction: ${revisionInstruction}\n\nReturn the FULL updated draft (not a diff), reusing everything the employer didn't ask to change.`
    : `${contextBlockFrom(context)}\n\nDesign a new challenge draft for this role.`;

  let lastError: unknown;
  for (const attempt of ATTEMPTS) {
    try {
      const { object } = await generateObject({
        model: getModel(),
        schema: ChallengeDraftGeneratedSchema,
        system: `${CHALLENGE_POLICY}\n\nKeep every field concise — a few sentences at most — so the whole object fits comfortably; never pad or repeat text.`,
        prompt: basePrompt + attempt.extraInstruction,
        temperature: attempt.temperature,
        abortSignal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
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

/** Attaches the control fields the model never touches. Reuses the
 * existing draft's `id` on a revision (so a chat edit updates the SAME
 * draft the app already rendered, never a disconnected new one) and mints
 * a fresh id only when there's no prior draft. Child items (tasks,
 * materials, rubric rows) get fresh ids each time — their identity within
 * a single render doesn't need to survive a full-object regeneration. */
export function attachDraftIdentity(generated: ChallengeDraftGenerated, existingDraft: ChallengeDraft | null): ChallengeDraft {
  return {
    ...generated,
    id: existingDraft?.id ?? crypto.randomUUID(),
    status: "draft",
    tasks: generated.tasks.map((task) => ({ ...task, id: crypto.randomUUID() })),
    materials: generated.materials.map((material) => ({ ...material, id: crypto.randomUUID() })),
    rubric: generated.rubric.map((criterion) => ({ ...criterion, id: crypto.randomUUID() })),
  };
}
