import { z } from "zod";

/**
 * Structured output for Ask internIn's "clarify before drafting" step.
 * The model NEVER returns JSX or free text for this — only this shape.
 * Rendering is entirely owned by the app (AskInternInQuestionnaire), which
 * maps this onto the real shadcn Questionnaire primitive.
 */
export const ClarificationChoiceSchema = z.object({
  value: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(200).optional(),
});
export type ClarificationChoice = z.infer<typeof ClarificationChoiceSchema>;

export const ClarificationQuestionSchema = z.object({
  id: z.string().trim().min(1).max(60),
  prompt: z.string().trim().min(4).max(200),
  description: z.string().trim().max(300).optional(),
  type: z.enum(["single", "multiple", "freeform"]),
  required: z.boolean(),
  /** Only present for "single"/"multiple" — a "freeform" question has none. */
  choices: z.array(ClarificationChoiceSchema).max(8).optional(),
  /** Adds an "Other: ___" free-text choice alongside the fixed ones. */
  allowOther: z.boolean().optional(),
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
 * A realistic internship challenge draft — deliberately NOT a flat quiz.
 * `sections` hold a mix of item kinds (practical task, code, spreadsheet,
 * open-ended question, etc.) chosen per-profession, never one universal
 * question type. This is the AUTHORING-TIME shape used inside the Ask
 * internIn conversation; when the employer saves it, it's mapped onto the
 * app's real `Challenge`/`ChallengeSchema` (src/lib/ai/schemas.ts) and
 * persisted through the existing saveChallengeVersionAction — the same
 * real approval pipeline every other challenge in the app goes through.
 */
export const ChallengeCompetencySchema = z.object({
  name: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(1).max(240),
});
export type ChallengeCompetency = z.infer<typeof ChallengeCompetencySchema>;

export const ChallengeMaterialSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(400),
});
export type ChallengeMaterial = z.infer<typeof ChallengeMaterialSchema>;

export const ChallengeItemKindSchema = z.enum([
  "practical_task",
  "open_ended_question",
  "single_choice_question",
  "multiple_choice_question",
  "file_review_task",
  "code_task",
  "spreadsheet_task",
  "design_task",
  "written_deliverable",
]);
export type ChallengeItemKind = z.infer<typeof ChallengeItemKindSchema>;

export const ChallengeItemSchema = z.object({
  kind: ChallengeItemKindSchema,
  title: z.string().trim().min(1).max(160),
  prompt: z.string().trim().min(1).max(2000),
  /** Only meaningful for the two choice-question kinds. */
  choices: z.array(z.string().trim().min(1).max(200)).max(8).optional(),
});
export type ChallengeItem = z.infer<typeof ChallengeItemSchema>;

export const ChallengeSectionSchema = z.object({
  title: z.string().trim().min(1).max(160),
  items: z.array(ChallengeItemSchema).min(1).max(8),
});
export type ChallengeSection = z.infer<typeof ChallengeSectionSchema>;

export const RubricCriterionWeightedSchema = z.object({
  criterion: z.string().trim().min(1).max(160),
  weightPercent: z.number().int().min(0).max(100),
  description: z.string().trim().min(1).max(400),
});
export type RubricCriterionWeighted = z.infer<typeof RubricCriterionWeightedSchema>;

export const ChallengeAiUsagePolicySchema = z.enum([
  "not_allowed",
  "research_only",
  "allowed_disclose",
  "fully_allowed",
]);
export type ChallengeAiUsagePolicy = z.infer<typeof ChallengeAiUsagePolicySchema>;

/** Shared display label for each item kind — used by both the in-chat
 * ChallengeDraftCard and the mapping into the app's real Challenge shape,
 * so the two never drift apart. */
export const CHALLENGE_ITEM_KIND_LABEL: Record<ChallengeItemKind, string> = {
  practical_task: "Practical task",
  open_ended_question: "Open-ended question",
  single_choice_question: "Single-choice question",
  multiple_choice_question: "Multiple-choice question",
  file_review_task: "File/document review",
  code_task: "Code task",
  spreadsheet_task: "Spreadsheet task",
  design_task: "Design task",
  written_deliverable: "Written deliverable",
};

export const ChallengeDraftSchema = z.object({
  title: z.string().trim().min(2).max(180),
  role: z.string().trim().min(2).max(160),
  scenario: z.string().trim().min(20).max(3000),
  objective: z.string().trim().min(10).max(500),
  competencies: z.array(ChallengeCompetencySchema).min(1).max(8),
  materials: z.array(ChallengeMaterialSchema).max(10),
  sections: z.array(ChallengeSectionSchema).min(1).max(6),
  deliverables: z.array(z.string().trim().min(1).max(300)).min(1).max(10),
  estimatedMinutes: z.number().int().min(10).max(480),
  candidateInstructions: z.string().trim().min(10).max(2000),
  aiUsagePolicy: ChallengeAiUsagePolicySchema.optional(),
  evaluationRubric: z.array(RubricCriterionWeightedSchema).min(1).max(8),
  safetyNotes: z.array(z.string().trim().min(1).max(300)).max(6).optional(),
  assumptions: z.array(z.string().trim().min(1).max(300)).max(6).optional(),
});
export type ChallengeDraft = z.infer<typeof ChallengeDraftSchema>;
