import { z } from "zod";

/**
 * Structured output for Ask internIn's "clarify before drafting" step.
 * The model NEVER returns JSX or free text for this — only this shape.
 * Rendering is entirely owned by the app (AskInternInQuestionnaire), which
 * maps this onto the real shadcn Questionnaire primitive.
 */
// `.nullable().optional()`, not plain `.optional()`: weaker structured-
// output models routinely emit an explicit `null` for "nothing here"
// instead of omitting the key, and plain `.optional()` rejects that — one
// real cause of "the draft never appears". `.optional()` outermost keeps
// the object key itself omittable in TypeScript (so code building a value
// can still leave it out entirely); `.nullable()` inside makes an explicit
// `null` value valid too. Every genuinely-optional field in this file uses
// this pattern so the *contract* tolerates it, rather than patching
// individual call sites.
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalFlag = () => z.boolean().nullable().optional();

export const ClarificationChoiceSchema = z.object({
  value: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(120),
  description: optionalText(200),
});
export type ClarificationChoice = z.infer<typeof ClarificationChoiceSchema>;

/** The closed, profession-agnostic "what information is missing"
 * vocabulary — see role-profiles.ts for the full explanation. Kept as a
 * plain string union here (not importing InformationSlotSchema) to avoid
 * a cross-module dependency in a foundational schema file; the two must
 * stay in sync (enforced by the shared unit tests). */
const ClarificationSlotSchema = z.enum([
  "candidate_level",
  "responsibilities",
  "tools_technologies",
  "work_environment",
  "expected_deliverables",
  "access_level",
  "restrictions",
  "special_company_context",
]);

export const ClarificationQuestionSchema = z.object({
  id: z.string().trim().min(1).max(60),
  /** WHAT this question is actually asking about — not just display text.
   * Every clarification question is now built deterministically from a
   * slot (see clarification-engine.ts); this field is what makes an
   * answer machine-readable instead of just prose. */
  slot: ClarificationSlotSchema,
  prompt: z.string().trim().min(4).max(200),
  description: optionalText(300),
  type: z.enum(["single", "multiple", "freeform"]),
  required: z.boolean(),
  /** Only present for "single"/"multiple" — a "freeform" question has none. */
  choices: z.array(ClarificationChoiceSchema).max(8).nullable().optional(),
  /** Adds an "Other: ___" free-text choice alongside the fixed ones. */
  allowOther: optionalFlag(),
});
export type ClarificationQuestion = z.infer<typeof ClarificationQuestionSchema>;

export const ClarificationQuestionsResultSchema = z.object({
  intro: z
    .string()
    .trim()
    .min(1)
    .max(240)
    .describe("One short, natural sentence telling the employer why you're asking before drafting the challenge."),
  questions: z.array(ClarificationQuestionSchema).min(2).max(4),
});
export type ClarificationQuestionsResult = z.infer<typeof ClarificationQuestionsResultSchema>;

/**
 * The ONE canonical structured record of what the employer told internIn,
 * built once (from the original message + any questionnaire answers) and
 * consumed directly by challenge generation — never reconstructed by
 * re-reading a giant serialized chat transcript at generation time. Every
 * array here reports exactly what was selected/said; an empty array means
 * "not specified", never a guess.
 */
export const EmployerContextSchema = z.object({
  originalRequest: z.string().trim().min(1).max(500),
  role: z.string().trim().min(2).max(160),
  level: optionalText(160),
  responsibilities: z.array(z.string().trim().min(1).max(160)).max(10),
  tools: z.array(z.string().trim().min(1).max(80)).max(10),
  restrictions: z.array(z.string().trim().min(1).max(300)).max(10),
  additionalContext: optionalText(500),
});
export type EmployerContext = z.infer<typeof EmployerContextSchema>;

/**
 * A realistic internship challenge draft — deliberately NOT a flat quiz,
 * and deliberately NOT primarily Markdown: this is real structured
 * application state, not an AI message. This is the AUTHORING-TIME shape
 * used inside the Ask internIn conversation; when the employer uses it,
 * it's mapped onto the app's real `Challenge`/`ChallengeSchema`
 * (src/lib/ai/schemas.ts) and persisted through the existing
 * saveChallengeVersionAction — the same real approval pipeline every other
 * challenge in the app goes through.
 *
 * Control fields (`id`, per-item `id`s, `status`) follow the project's
 * existing rule (see gemma-provider.ts) that such fields are never trusted
 * from the model: `ChallengeDraftGeneratedSchema` is what generateObject
 * actually validates against, and `attachDraftIdentity` (challenge-
 * generation.ts) is the ONLY place ids/status get attached — reusing the
 * SAME draft id across a revision, never minting a new one, so a chat edit
 * updates the one active draft instead of starting a disconnected new one.
 */
export const ChallengeTaskDeliverableTypeSchema = z.enum([
  "written",
  "file",
  "code",
  "spreadsheet",
  "design",
  "presentation",
  "other",
]);
export type ChallengeTaskDeliverableType = z.infer<typeof ChallengeTaskDeliverableTypeSchema>;

export const DELIVERABLE_TYPE_LABEL: Record<ChallengeTaskDeliverableType, string> = {
  written: "Written response",
  file: "File/document review",
  code: "Code",
  spreadsheet: "Spreadsheet",
  design: "Design",
  presentation: "Presentation",
  other: "Other",
};

const GeneratedTaskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  instructions: z.string().trim().min(1).max(2000),
  // `.catch("other")`, not a bare enum: an unrecognized value here (the
  // model writing "excel" instead of "spreadsheet", say) must not throw
  // away an otherwise-good task — it degrades to "other" instead of
  // failing the whole generation.
  deliverableType: ChallengeTaskDeliverableTypeSchema.catch("other"),
});

const GeneratedMaterialSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.string().trim().min(1).max(60),
  description: optionalText(400),
});

const GeneratedRubricCriterionSchema = z.object({
  criterion: z.string().trim().min(1).max(160),
  weight: z.number().int().min(0).max(100),
  description: optionalText(400),
});

export const ChallengeAiUsagePolicyModeSchema = z.enum([
  "not_allowed",
  "research_only",
  "allowed_with_disclosure",
  "fully_allowed",
  "custom",
]);
export type ChallengeAiUsagePolicyMode = z.infer<typeof ChallengeAiUsagePolicyModeSchema>;

export const AI_USAGE_MODE_LABEL: Record<ChallengeAiUsagePolicyMode, string> = {
  not_allowed: "AI not allowed",
  research_only: "AI allowed for research only",
  allowed_with_disclosure: "AI allowed, must disclose",
  fully_allowed: "AI fully allowed",
  custom: "Custom AI usage policy",
};

/** What generateObject actually validates the model's output against — no
 * ids, no status. See the block comment above for why.
 *
 * AI usage policy is two flat sibling fields (aiUsagePolicyMode /
 * aiUsagePolicyCustomText), not one nested `{mode, customText}` object.
 * Real, isolated diagnostic testing found that a nullable/optional OBJECT
 * schema — as opposed to a nullable/optional primitive or array — reliably
 * triggered this model into hanging or degenerating on this exact field
 * (confirmed by removing it and getting a clean, fast success on an
 * otherwise-identical schema/prompt). Every other optional value here is a
 * primitive or an array, which never showed this failure. */
export const ChallengeDraftGeneratedSchema = z.object({
  role: z.string().trim().min(2).max(160),
  title: z.string().trim().min(2).max(180),
  scenario: z.string().trim().min(20).max(3000),
  skills: z.array(z.string().trim().min(1).max(80)).min(1).max(10),
  tasks: z.array(GeneratedTaskSchema).min(1).max(10),
  // `.default([])`, not a bare required array: the model omitting a
  // genuinely nonessential field (no materials needed for this role, no
  // real safety concern to flag) must not fail the whole generation.
  // Input stays optional; the OUTPUT type is still always a real array —
  // no consuming code needs an undefined-check either way.
  materials: z.array(GeneratedMaterialSchema).max(10).default([]),
  durationMinutes: z.number().int().min(10).max(480).nullable().optional(),
  // A short human duration RANGE ("3–4 hours") for display — separate
  // from durationMinutes (a single number other code already maps onto
  // Challenge.estimatedMinutes). Flat, nullable/optional primitive, not a
  // nested object — follows the established null-tolerant-field rule.
  estimatedDurationLabel: optionalText(40),
  // A short, employer-facing summary of what the candidate hands in —
  // distinct from each task's own instructions. Rendered as one summary
  // line, never a bulleted restatement of the tasks.
  deliverables: z.array(z.string().trim().min(1).max(160)).max(6).default([]),
  rubric: z.array(GeneratedRubricCriterionSchema).min(1).max(8),
  aiUsagePolicyMode: ChallengeAiUsagePolicyModeSchema.nullable().optional(),
  aiUsagePolicyCustomText: optionalText(300),
  assumptions: z.array(z.string().trim().min(1).max(300)).max(6).default([]),
  safetyNotes: z.array(z.string().trim().min(1).max(300)).max(6).default([]),
});
export type ChallengeDraftGenerated = z.infer<typeof ChallengeDraftGeneratedSchema>;

const idField = () => z.string().trim().min(1).max(80);

export const ChallengeDraftTaskSchema = GeneratedTaskSchema.extend({ id: idField() });
export type ChallengeDraftTask = z.infer<typeof ChallengeDraftTaskSchema>;

export const ChallengeDraftMaterialSchema = GeneratedMaterialSchema.extend({ id: idField() });
export type ChallengeDraftMaterial = z.infer<typeof ChallengeDraftMaterialSchema>;

export const ChallengeDraftRubricCriterionSchema = GeneratedRubricCriterionSchema.extend({ id: idField() });
export type ChallengeDraftRubricCriterion = z.infer<typeof ChallengeDraftRubricCriterionSchema>;

/** The full, app-facing draft — `id` is the stable identity a revision
 * targets (see attachDraftIdentity in challenge-generation.ts); `status`
 * is local, cosmetic state ("Draft" vs "Used" badge), never fed back
 * through the model. This is the schema validated at the save-action
 * boundary (challenge-draft-actions.ts) — a client-supplied draft is
 * never trusted without it, same as every other server action here. */
export const ChallengeDraftSchema = ChallengeDraftGeneratedSchema.omit({ tasks: true, materials: true, rubric: true }).extend({
  id: idField(),
  status: z.enum(["draft", "approved"]),
  // The stable identity is `id` — `version` is a plain incrementing
  // counter over revisions of THAT id (regenerate, a chat edit, a manual
  // save). The model never sets either; attachDraftIdentity does
  // (challenge-generation.ts). The UI uses this to show only the latest
  // version of a draft in the conversation, never one card per revision.
  version: z.number().int().min(1),
  tasks: z.array(ChallengeDraftTaskSchema).min(1).max(10),
  materials: z.array(ChallengeDraftMaterialSchema).max(10),
  rubric: z.array(ChallengeDraftRubricCriterionSchema).min(1).max(8),
});
export type ChallengeDraft = z.infer<typeof ChallengeDraftSchema>;
