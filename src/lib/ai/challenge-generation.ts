import { generateObject } from "ai";
import { getModel } from "./gemma-provider";
import { ChallengeDraftGeneratedSchema, EmployerContextSchema, type ChallengeDraft, type ChallengeDraftGenerated, type EmployerContext } from "./challenge-clarification-schemas";
import type { QuestionnaireAnswer } from "./assistant-messages";

// Split ChallengeDraftGeneratedSchema into two independently-generated
// halves — a real, isolated finding, not a guess: a small flat schema
// (role/title/scenario/skills) succeeded reliably in every test (~10-30s);
// the SAME context with the full 7-field schema (adding tasks/materials/
// rubric) hung to its full timeout repeatedly. A follow-up test showed
// this isn't one single deterministic trigger (a minimal tasks-only
// schema also succeeded fast on its own) — the pattern is PROBABILISTIC
// reliability that degrades with overall combined schema size/field
// count, not one specific field. Splitting into two smaller, focused
// calls run in parallel directly exploits the one thing every test
// agreed on: small, focused schemas are far more reliable than one large
// combined one, and running them concurrently keeps total wall time to
// roughly the slower of the two instead of their sum.
const ChallengeDraftCoreSchema = ChallengeDraftGeneratedSchema.pick({
  role: true,
  title: true,
  scenario: true,
  skills: true,
  durationMinutes: true,
  aiUsagePolicyMode: true,
  aiUsagePolicyCustomText: true,
  assumptions: true,
  safetyNotes: true,
});
const ChallengeDraftDetailsSchema = ChallengeDraftGeneratedSchema.pick({ tasks: true, materials: true, rubric: true });

/**
 * Runs `run` up to `attempts.length` times, returning the first success.
 * Real, logged timings per attempt — this model has shown genuine
 * unreliability (not just slowness: a bad draw can hang indefinitely
 * rather than merely run long), so several independent attempts at a
 * moderate timeout recover better than one long wait. Shared by both
 * clarification-question and challenge-draft generation so the retry
 * behavior — and its logging — never drifts between the two.
 */
export async function withGenerateRetries<T, A>(label: string, attempts: readonly A[], run: (attempt: A, attemptIndex: number) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts.length; i++) {
    const t0 = Date.now();
    try {
      const result = await run(attempts[i], i);
      console.log(`[assistant] ${label} succeeded on attempt ${i + 1}/${attempts.length} in ${Date.now() - t0}ms`);
      return result;
    } catch (error) {
      lastError = error;
      console.error(`[assistant] ${label} attempt ${i + 1}/${attempts.length} failed after ${Date.now() - t0}ms:`, error instanceof Error ? error.message : error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} failed.`);
}

export const CHALLENGE_POLICY = `When an employer describes an internship role (even vaguely) and wants a work challenge / assessment / task for it, you can help design one — this is core to what you do.

A challenge is a realistic SIMULATION of the actual internship work, never a generic quiz. Depending on the profession, mix practical tasks, code, spreadsheet work, design work, file/document review, a written deliverable, or a presentation — whatever fits the real work, never one uniform task type for every role.

For safety-sensitive professions (healthcare, pharmacy, legal, cybersecurity, engineering, etc.), only ever design SAFE SIMULATED tasks using synthetic/fictional data — documentation, prioritization, escalation judgment, safe procedural scenarios. Never have a candidate perform real diagnosis, real prescribing/dispensing, real unsupervised clinical decisions, a real attack on a real system, or present output as real legal/medical advice.

Rubric criteria must be observable and job-relevant (e.g. "SQL correctness — 30%"), never vague or unrelated to the defined task (never "culture fit", "confidence", appearance, or any protected/personal characteristic). Difficulty should match the specified candidate level, not a seasoned professional, unless told otherwise.`;

/** One human-readable line per answer, "(not specified — use your best
 * professional judgment)" for a skipped optional question — never the
 * literal string "(skipped)" fed to the model as if it were real data. */
export function formatQuestionnaireAnswers(answers: QuestionnaireAnswer[]): string {
  return answers.map((a) => `- ${a.prompt} — ${a.answer ?? "(not specified — use your best professional judgment)"}`).join("\n");
}

const CONTEXT_TIMEOUT_MS = 30_000;
const CONTEXT_ATTEMPTS = [{}, {}] as const;

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
  return withGenerateRetries("buildEmployerContext", CONTEXT_ATTEMPTS, async () => {
    const { object } = await generateObject({
      model: getModel(),
      schema: EmployerContextSchema,
      system: `Extract a factual, structured record of an internship role from a hiring conversation. Report ONLY what was actually said or selected — an empty array means "not specified", never a guess. Do not invent a responsibility, tool, or restriction that wasn't mentioned.`,
      prompt: `Original request: ${originalRequest}${answersBlock}\n\nFull conversation:\n${transcript}`,
      abortSignal: AbortSignal.timeout(CONTEXT_TIMEOUT_MS),
    });
    return object;
  });
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

// Smaller schema, smaller timeout: every isolated test of a schema this
// size succeeded in well under 30s. 2 attempts, not 3 — a focused schema
// either works quickly or it doesn't; a third attempt at the same size
// wasn't earning its wait in testing.
const PART_TIMEOUT_MS = 35_000;
const PART_ATTEMPTS = [
  { temperature: 0.5, extraInstruction: "" },
  { temperature: 0.3, extraInstruction: "\n\nBe concise — a sentence or two per field is enough." },
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
 * — never from a re-serialized chat transcript. Runs as TWO smaller,
 * focused generateObject calls IN PARALLEL (see the schema-split comment
 * above) instead of one large combined call — total wall time is roughly
 * the slower of the two, not their sum. Returns the model's validated
 * output only; id/status assignment is attachDraftIdentity's job, kept
 * separate so a control field is never something the model influences.
 */
export async function generateChallengeDraftObject(params: {
  context: EmployerContext;
  existingDraft: ChallengeDraft | null;
  revisionInstruction?: string;
}): Promise<ChallengeDraftGenerated> {
  const { context, existingDraft, revisionInstruction } = params;
  const basePrompt = existingDraft
    ? `${contextBlockFrom(context)}\n\nCurrent draft (JSON):\n${JSON.stringify(existingDraft)}\n\nThe employer's revision instruction: ${revisionInstruction}\n\nReturn the FULL updated value for your part (not a diff), reusing everything the employer didn't ask to change.`
    : `${contextBlockFrom(context)}\n\nDesign a new challenge draft for this role.`;

  const [core, details] = await Promise.all([
    withGenerateRetries("generateChallengeDraftObject:core", PART_ATTEMPTS, async (attempt) => {
      const { object } = await generateObject({
        model: getModel(),
        schema: ChallengeDraftCoreSchema,
        system: `${CHALLENGE_POLICY}\n\nGenerate ONLY the role, title, scenario, skills, duration, AI usage policy, assumptions, and safety notes — not tasks/materials/rubric, those come from a separate step. Keep every field concise.`,
        prompt: basePrompt + attempt.extraInstruction,
        temperature: attempt.temperature,
        maxOutputTokens: 1500,
        abortSignal: AbortSignal.timeout(PART_TIMEOUT_MS),
      });
      return object;
    }),
    withGenerateRetries("generateChallengeDraftObject:details", PART_ATTEMPTS, async (attempt) => {
      const { object } = await generateObject({
        model: getModel(),
        schema: ChallengeDraftDetailsSchema,
        system: `${CHALLENGE_POLICY}\n\nGenerate ONLY the tasks, materials, and evaluation rubric — not the title/scenario/skills, those come from a separate step. Keep every field concise — a sentence or two at most.`,
        prompt: basePrompt + attempt.extraInstruction,
        temperature: attempt.temperature,
        maxOutputTokens: 3000,
        abortSignal: AbortSignal.timeout(PART_TIMEOUT_MS),
      });
      return object;
    }),
  ]);

  return { ...core, rubric: normalizeRubricWeights(details.rubric), tasks: details.tasks, materials: details.materials };
}

/**
 * Rescales rubric weights to sum to exactly 100 when the model's arithmetic
 * comes out slightly off — a deterministic repair, not a reason to throw
 * away an otherwise-good challenge (Part 7: "do not rely purely on the
 * model to get arithmetic perfect... normalize or validate
 * deterministically"). Any leftover rounding remainder goes to the
 * heaviest criterion, so the total is exact without a fractional weight
 * anywhere.
 */
export function normalizeRubricWeights<T extends { weight: number }>(rubric: T[]): T[] {
  const total = rubric.reduce((sum, r) => sum + r.weight, 0);
  if (rubric.length === 0 || total === 100 || total === 0) return rubric;

  const scaled = rubric.map((r) => ({ ...r, weight: Math.round((r.weight / total) * 100) }));
  const remainder = 100 - scaled.reduce((sum, r) => sum + r.weight, 0);
  if (remainder !== 0) {
    const heaviestIndex = scaled.reduce((best, r, i) => (r.weight > scaled[best].weight ? i : best), 0);
    scaled[heaviestIndex] = { ...scaled[heaviestIndex], weight: scaled[heaviestIndex].weight + remainder };
  }
  return scaled;
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
