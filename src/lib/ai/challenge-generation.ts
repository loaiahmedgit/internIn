import { generateObject } from "ai";
import { getModel } from "./gemma-provider";
import { ChallengeDraftGeneratedSchema, EmployerContextSchema, type ChallengeDraft, type ChallengeDraftGenerated, type EmployerContext } from "./challenge-clarification-schemas";
import type { QuestionnaireAnswer } from "./assistant-messages";
import { workActivitySignals, type WorkNeedProfile } from "./role-intelligence-schemas";
import { normalizeRubricWeights } from "./rubric-weights";

export { normalizeRubricWeights };

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
  estimatedDurationLabel: true,
  deliverables: true,
  aiUsagePolicyMode: true,
  aiUsagePolicyCustomText: true,
  assumptions: true,
  safetyNotes: true,
});
const ChallengeDraftDetailsSchema = ChallengeDraftGeneratedSchema.pick({
  tasks: true,
  materials: true,
  rubric: true,
  submissionRequirements: true,
});

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

/** Applies lossless Questionnaire selections after the model extracts the
 * free-form opening request. Structured UI answers are the source of truth:
 * a selected technology or responsibility must never be renamed, dropped,
 * or expanded by a second model pass. */
export function preserveStructuredEmployerAnswers(
  extracted: EmployerContext,
  answers: QuestionnaireAnswer[] | null,
  roleHint?: string,
  workNeed?: WorkNeedProfile | null,
): EmployerContext {
  const selected = new Map(
    (answers ?? [])
      .filter((answer) => answer.slot && (answer.values?.length || answer.answer))
      .map((answer) => [
        answer.slot!,
        answer.values?.length ? answer.values : answer.answer ? [answer.answer] : [],
      ]),
  );

  const extraSlots = ["work_environment", "expected_deliverables", "access_level", "special_company_context"] as const;
  const structuredAdditional = extraSlots
    .flatMap((slot) => selected.get(slot) ?? [])
    .filter(Boolean)
    .join("; ");

  return EmployerContextSchema.parse({
    ...extracted,
    role: roleHint?.trim() || extracted.role,
    level: selected.get("candidate_level")?.[0] ?? workNeed?.seniorityIntent ?? extracted.level,
    responsibilities: selected.get("responsibilities") ?? (workNeed ? workActivitySignals(workNeed) : extracted.responsibilities),
    tools: selected.get("tools_technologies") ?? workNeed?.systemsOrTools ?? extracted.tools,
    restrictions: selected.get("restrictions") ?? workNeed?.constraints ?? extracted.restrictions,
    additionalContext:
      structuredAdditional ||
      (workNeed ? [...workNeed.problems, ...workNeed.desiredOutcomes].join("; ") || null : extracted.additionalContext),
  });
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
export async function buildEmployerContext(params: {
  originalRequest: string;
  transcript: string;
  answers: QuestionnaireAnswer[] | null;
  roleHint?: string;
  workNeed?: WorkNeedProfile | null;
}): Promise<EmployerContext> {
  const { originalRequest, transcript, answers, roleHint, workNeed } = params;
  if (workNeed && roleHint?.trim()) {
    return preserveStructuredEmployerAnswers(
      {
        originalRequest: workNeed.originalRequest,
        role: roleHint,
        level: workNeed.seniorityIntent ?? null,
        responsibilities: workActivitySignals(workNeed),
        tools: workNeed.systemsOrTools,
        restrictions: workNeed.constraints,
        additionalContext: [...workNeed.problems, ...workNeed.desiredOutcomes].join("; ") || null,
      },
      answers,
      roleHint,
      workNeed,
    );
  }
  const answersBlock = answers?.length ? `\n\nThe employer's answers to clarification questions:\n${formatQuestionnaireAnswers(answers)}` : "";
  return withGenerateRetries("buildEmployerContext", CONTEXT_ATTEMPTS, async () => {
    const { object } = await generateObject({
      model: getModel(),
      schema: EmployerContextSchema,
      system: `Extract a factual, structured record of an internship role from a hiring conversation. Report ONLY what was actually said or selected — an empty array means "not specified", never a guess. Do not invent a responsibility, tool, or restriction that wasn't mentioned.`,
      prompt: `Original request: ${originalRequest}${answersBlock}\n\nFull conversation:\n${transcript}`,
      abortSignal: AbortSignal.timeout(CONTEXT_TIMEOUT_MS),
    });
    return preserveStructuredEmployerAnswers(object, answers, roleHint, workNeed);
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
    : `${contextBlockFrom(context)}\n\nDesign a new challenge draft for this role. Treat the listed responsibilities and tools as the complete requested scope and preserve their wording.`;

  const [core, details] = await Promise.all([
    withGenerateRetries("generateChallengeDraftObject:core", PART_ATTEMPTS, async (attempt) => {
      const { object } = await generateObject({
        model: getModel(),
        schema: ChallengeDraftCoreSchema,
        system: `${CHALLENGE_POLICY}\n\nGenerate ONLY the role, title, scenario, skills, duration, deliverables, AI usage policy, assumptions, and safety notes — not tasks/materials/rubric, those come from a separate step. Keep every field concise.\n\nDefault to a focused 30-60 minute challenge. Use 60-90 minutes only when the work is genuinely complex. Go beyond 90 minutes only when the employer explicitly requested a substantial take-home project. Reduce scope instead of assigning an ordinary intern candidate several hours of work. "estimatedDurationLabel" is a short human range like "30-60 minutes" or "60-90 minutes" and must agree with durationMinutes. "deliverables" is a short list (2-4 items) of what the candidate actually hands in (e.g. "SQL scripts", "a one-page summary report"), not a restatement of the tasks.`,
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
        system: `${CHALLENGE_POLICY}\n\nGenerate ONLY the tasks, materials, evaluation rubric, and submission requirements — not the title/scenario/skills, those come from a separate step. Keep every field concise — a sentence or two at most.\n\nEach task's "title" is ONE short, concrete, action-first sentence — this exact sentence is what the employer sees in the compact summary view (e.g. "Design a reporting schema for the provided OLTP data."), never a short label. "instructions" can add extra step-by-step detail beyond that sentence, for later editing — repeat the title there if nothing more is needed.\n\nAlways include at least 2 supporting materials (synthetic datasets, templates, or reference documents the candidate would actually receive) — a challenge with zero materials is incomplete. Each material's "name" must be a real, candidate-facing filename with a plausible extension (e.g. "customers.csv", "onboarding_checklist.pdf"), never an internal-sounding label like "Base_Model_ID". Put what it actually is in "description", not in the name. For each material, also design its real content in "contentSpec" so the platform can generate an actual file: for a spreadsheet/CSV give sheetName/columns (name+dataType)/rowCount/rowGenerationHint; for a PDF/document give a title and sections (heading+paragraphs) with real fictional content the candidate would actually read; for other structured data give a schemaDescription and a few sampleRecords. If a material is genuinely better as a real external reference than a generated file (a public template, a well-known dataset), set resourceType to "link" and give a real, working externalUrl — never a fabricated one. If a material should be an image, video, audio, or diagram that you cannot design real content for, still name and describe it honestly — the platform will flag it for the employer to upload rather than pretending it exists.\n\nsubmissionRequirements: 1-4 items describing exactly what the candidate must hand in. inputMode is "file" for one uploaded document/spreadsheet, "multiple_files" when more than one file of the same kind is expected, "text" for a written response, or "url" for a link the candidate provides (their own GitHub/GitLab repo, a Figma file, a hosted video/audio recording, a portfolio link). Set artifactKind to what it actually is. required:true for anything genuinely necessary to evaluate the work; use required:false sparingly. For a "url" requirement tied to a specific platform, set providers to that platform's real domain(s), e.g. ["github.com","gitlab.com"] for a code repository or ["figma.com"] for a design link.`,
        prompt: basePrompt + attempt.extraInstruction,
        temperature: attempt.temperature,
        maxOutputTokens: 3000,
        abortSignal: AbortSignal.timeout(PART_TIMEOUT_MS),
      });
      return object;
    }),
  ]);

  return enforceChallengeDurationPolicy(
    {
      ...core,
      // Structured selections win over generated restatements. This keeps
      // React as React and TypeScript as TypeScript all the way into the
      // attached challenge instead of allowing a model synonym or extra
      // technology to change what the employer chose.
      role: context.role,
      skills: context.tools.length ? context.tools : core.skills,
      rubric: normalizeRubricWeights(details.rubric),
      tasks: details.tasks,
      materials: details.materials,
      submissionRequirements: details.submissionRequirements,
    },
    context,
  );
}

function explicitRequestedMinutes(context: EmployerContext): number | null {
  const text = [context.originalRequest, context.additionalContext, ...context.restrictions].filter(Boolean).join(" ");
  const matches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*-?\s*(hours?|hrs?|minutes?|mins?)\b/gi)];
  const values = matches.flatMap((match) => {
    const trailing = text.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 24);
    // Internship availability such as "20 hours/week" is not a challenge
    // time limit. Only standalone hour/minute values can override the
    // focused challenge-duration policy.
    if (/^\s*(?:\/|per\s+|a\s+|each\s+)(?:day|week|month)\b/i.test(trailing)) return [];
    const amount = Number(match[1]);
    const minutes = /^h/i.test(match[2]) ? Math.round(amount * 60) : Math.round(amount);
    return Number.isFinite(minutes) && minutes > 0 ? [Math.min(minutes, 480)] : [];
  });
  return values.length ? Math.max(...values) : null;
}

function upperMinutesFromLabel(label: string | null | undefined): number | null {
  if (!label) return null;
  const match = label.match(/(\d+(?:\.\d+)?)\s*(?:[-–—]|to)?\s*(\d+(?:\.\d+)?)?\s*(hours?|hrs?|minutes?|mins?)/i);
  if (!match) return null;
  const amount = Number(match[2] ?? match[1]);
  return /^h/i.test(match[3]) ? Math.round(amount * 60) : Math.round(amount);
}

function durationFitsLabel(minutes: number, label: string | null | undefined): boolean {
  if (!label) return false;
  const match = label.match(/(\d+(?:\.\d+)?)\s*(?:[-–—]|to)?\s*(\d+(?:\.\d+)?)?\s*(hours?|hrs?|minutes?|mins?)/i);
  if (!match) return false;
  const multiplier = /^h/i.test(match[3]) ? 60 : 1;
  const low = Number(match[1]) * multiplier;
  const high = Number(match[2] ?? match[1]) * multiplier;
  return minutes >= Math.min(low, high) && minutes <= Math.max(low, high);
}

/** Deterministic product guardrail after model validation. It keeps an
 * explicitly requested duration, but otherwise narrows ordinary hiring
 * challenges to a focused 30-60 or 60-90 minute scope. Long generated
 * drafts are actually reduced, not merely relabeled. */
export function enforceChallengeDurationPolicy(
  draft: ChallengeDraftGenerated,
  context: EmployerContext,
): ChallengeDraftGenerated {
  const explicitlyRequested = explicitRequestedMinutes(context);
  if (explicitlyRequested !== null) {
    const maxTasks = explicitlyRequested <= 60 ? 3 : explicitlyRequested <= 90 ? 4 : draft.tasks.length;
    return {
      ...draft,
      tasks: draft.tasks.slice(0, maxTasks),
      deliverables: draft.deliverables.slice(0, maxTasks),
      durationMinutes: explicitlyRequested,
      estimatedDurationLabel: `${explicitlyRequested} minutes`,
    };
  }

  const outputMinutes = Math.max(draft.durationMinutes ?? 0, upperMinutesFromLabel(draft.estimatedDurationLabel) ?? 0);
  const isComplex = draft.tasks.length >= 4 || draft.deliverables.length >= 3 || draft.materials.length >= 3;
  const maxTasks = isComplex ? 4 : 3;
  const policyMinutes = isComplex ? 75 : 45;
  const policyLabel = isComplex ? "60-90 minutes" : "30-60 minutes";

  if (
    outputMinutes <= 90 &&
    draft.durationMinutes &&
    durationFitsLabel(draft.durationMinutes, draft.estimatedDurationLabel)
  ) {
    return {
      ...draft,
      tasks: draft.tasks.slice(0, maxTasks),
      deliverables: draft.deliverables.slice(0, maxTasks),
    };
  }

  return {
    ...draft,
    tasks: draft.tasks.slice(0, maxTasks),
    deliverables: draft.deliverables.slice(0, maxTasks),
    durationMinutes: policyMinutes,
    estimatedDurationLabel: policyLabel,
  };
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
    version: (existingDraft?.version ?? 0) + 1,
    status: "draft",
    tasks: generated.tasks.map((task) => ({ ...task, id: crypto.randomUUID() })),
    materials: generated.materials.map((material) => ({ ...material, id: crypto.randomUUID() })),
    rubric: generated.rubric.map((criterion) => ({ ...criterion, id: crypto.randomUUID() })),
    submissionRequirements: generated.submissionRequirements.map((requirement) => ({ ...requirement, id: crypto.randomUUID() })),
  };
}
