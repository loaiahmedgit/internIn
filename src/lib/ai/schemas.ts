import { z } from "zod";
import { CHALLENGE_RESOURCE_TYPES, SUBMISSION_ARTIFACT_KINDS, SUBMISSION_INPUT_MODES } from "@/lib/challenges/submission-model";

/**
 * Structured-output contracts for every AIProvider method.
 * Nothing in the app should ever save raw model text — only these validated shapes.
 */

export const InternshipDraftSchema = z.object({
  role: z.string().trim().min(2).max(120),
  duration: z.string().trim().min(2).max(80),
  hoursPerWeek: z.number().int().min(1).max(60),
  location: z.string().trim().min(2).max(120),
  workMode: z.enum(["remote", "onsite", "hybrid"]).nullable().optional(),
  applicationDeadline: z.coerce.date().nullable().optional(),
  slots: z.number().int().min(1).max(100),
  skills: z.array(z.string().trim().min(1).max(60)).max(20),
  description: z.string().trim().min(20).max(4000),
});
export type InternshipDraft = z.infer<typeof InternshipDraftSchema>;

/** One optional AI-assist call on the Create/Edit Internship form — the user always keeps full manual control; this only ever fills in a suggestion for the field(s) that task targets. */
export const InternshipCopyAssistSchema = z.object({
  description: z.string().trim().min(20).max(4000).optional(),
  items: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
});
export type InternshipCopyAssist = z.infer<typeof InternshipCopyAssistSchema>;

/** The contextual "Ask internIn" panel's answer — grounded entirely in the real facts string passed alongside the question; the model is instructed to never state a number that isn't in that string. */
export const InternshipAssistantAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(1200),
});
export type InternshipAssistantAnswer = z.infer<typeof InternshipAssistantAnswerSchema>;

export const ChallengeTaskSchema = z.object({
  id: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(2000),
});
export type ChallengeTask = z.infer<typeof ChallengeTaskSchema>;

export const RubricCriterionSchema = z.object({
  criterion: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(1500),
  /** 0-100; siblings should sum to 100 — enforced defensively by normalizeRubricWeights (challenge-generation.ts) rather than trusted from the model. */
  weight: z.number().int().min(0).max(100),
});
export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;

/**
 * The AI-authored content design behind a generated resource — server code
 * (resource-generation.ts) turns this into real bytes. Optional: a resource
 * without one falls back to best-effort generation from name+description.
 */
export const ResourceContentSpecSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("spreadsheet"),
    sheetName: z.string().trim().max(80).optional(),
    columns: z
      .array(z.object({ name: z.string().trim().min(1).max(80), dataType: z.enum(["text", "number", "date", "boolean"]) }))
      .min(1)
      .max(20),
    rowCount: z.number().int().min(1).max(500),
    rowGenerationHint: z.string().trim().max(500).optional(),
  }),
  z.object({
    kind: z.literal("document"),
    title: z.string().trim().min(1).max(160),
    sections: z
      .array(z.object({ heading: z.string().trim().min(1).max(160), paragraphs: z.array(z.string().trim().min(1).max(1000)).min(1).max(10) }))
      .min(1)
      .max(10),
  }),
  z.object({
    kind: z.literal("structured_data"),
    schemaDescription: z.string().trim().min(1).max(500),
    sampleRecords: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))).min(1).max(50),
  }),
]);
export type ResourceContentSpecInput = z.infer<typeof ResourceContentSpecSchema>;

export const ChallengeAssetFileSchema = z.object({
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(1000),
  /** "file" (a real generated/uploaded file) or "link" (a real external URL, see externalUrl). Optional — undefined defaults to "file" wherever this is consumed, kept optional rather than `.default()` so plain object literals typed against this schema aren't forced to always include it. */
  resourceType: z.enum(CHALLENGE_RESOURCE_TYPES).optional(),
  /** Informational — the generator primarily dispatches on the file extension in `name`; this mainly drives display labeling and the requires_upload fallback for kinds it can't synthesize (image/video/audio/etc). Optional, same reasoning as resourceType. */
  artifactKind: z.enum(SUBMISSION_ARTIFACT_KINDS).optional(),
  /** Only for resourceType "link" — a real external URL, never fabricated. */
  externalUrl: z.string().trim().url().max(2000).nullable().optional(),
  contentSpec: ResourceContentSpecSchema.nullable().optional(),
});
export type ChallengeAssetFile = z.infer<typeof ChallengeAssetFileSchema>;

/** What the student must actually submit — drives real submission validation, not just display copy. */
export const SubmissionRequirementSchema = z.object({
  id: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(160),
  inputMode: z.enum(SUBMISSION_INPUT_MODES),
  artifactKind: z.enum(SUBMISSION_ARTIFACT_KINDS),
  required: z.boolean(),
  acceptedFormats: z.array(z.string().trim().min(1).max(20)).max(10).optional(),
  providers: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  minFiles: z.number().int().min(1).max(20).optional(),
  maxFiles: z.number().int().min(1).max(20).optional(),
  maxFileSizeBytes: z.number().int().min(1).optional(),
  instructions: z.string().trim().max(500).optional(),
});
export type SubmissionRequirementInput = z.infer<typeof SubmissionRequirementSchema>;

export const ChallengeSchema = z.object({
  title: z.string().trim().min(2).max(180),
  scenario: z.string().trim().min(20).max(6000),
  estimatedMinutes: z.number().int().min(10).max(480),
  /** Human duration range (normally "30-60 minutes") — the canonical display value;
   * see challenge-duration.ts's formatChallengeDuration. Null for a
   * challenge from a path that never produced one. */
  estimatedDurationLabel: z.string().trim().max(40).nullable().optional(),
  skills: z.array(z.string().trim().min(1).max(60)).max(20),
  tasks: z.array(ChallengeTaskSchema).min(1).max(20),
  deliverables: z.array(z.string().trim().min(1).max(500)).min(1).max(15),
  files: z.array(ChallengeAssetFileSchema).max(10),
  rubric: z.array(RubricCriterionSchema).min(1).max(20),
  /** Every internIn challenge requires at least one real submission — no "no challenge" path. */
  submissionRequirements: z.array(SubmissionRequirementSchema).min(1).max(10),
  /**
   * draft: not yet generated / being edited by hand
   * ai_generated: fresh model output, unreviewed
   * pending_approval: a human has edited it, awaiting explicit approval
   * approved: a human approved it — still not visible to students
   * published: live and visible to students
   * AI must never move a Challenge to "published" on its own.
   */
  status: z.enum(["draft", "ai_generated", "pending_approval", "approved", "published"]),
});
export type Challenge = z.infer<typeof ChallengeSchema>;

export const ScenarioSchema = z.object({
  companyName: z.string(),
  premise: z.string(),
  dataDescription: z.string(),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const CandidateEvidenceSchema = z.object({
  candidateName: z.string(),
  tasksCompleted: z.string(),
  timeSpentMinutes: z.number(),
  submissionSummary: z.string(),
  aiSummary: z.string(),
  strength: z.string(),
  weakness: z.string(),
});
export type CandidateEvidence = z.infer<typeof CandidateEvidenceSchema>;

export const CandidateComparisonRowSchema = z.object({
  candidateName: z.string(),
  completion: z.string(),
  timeMinutes: z.number(),
  analysis: z.string(),
  communication: z.string(),
  mainStrength: z.string(),
  mainWeakness: z.string(),
});
export type CandidateComparisonRow = z.infer<typeof CandidateComparisonRowSchema>;

export const InternshipWeekSchema = z.object({
  week: z.number(),
  title: z.string(),
  objectives: z.array(z.string()),
});
export type InternshipWeek = z.infer<typeof InternshipWeekSchema>;

export const InternshipProgramSchema = z.object({
  internName: z.string(),
  role: z.string(),
  durationWeeks: z.number(),
  hoursPerWeek: z.number(),
  weeks: z.array(InternshipWeekSchema),
});
export type InternshipProgram = z.infer<typeof InternshipProgramSchema>;

/**
 * Adaptive, per-challenge evaluation output — metrics come from the
 * challenge's own rubric criteria (already role/challenge-specific, see
 * RubricCriterionSchema), never a universal fixed list. `level` is
 * qualitative, matching this codebase's existing convention of never
 * inventing a numeric verdict-style score. Any metric that cites text
 * must carry a real quote, verified against its source the same way
 * groundedHighlights already does — never a fabricated quote.
 */
export const EvidenceLevelSchema = z.enum(["strong", "solid", "developing", "insufficient", "not_demonstrated"]);
export type EvidenceLevel = z.infer<typeof EvidenceLevelSchema>;

export const RubricMetricSchema = z.object({
  criterion: z.string().trim().min(1).max(160),
  level: EvidenceLevelSchema,
  rationale: z.string().trim().min(1).max(600),
  evidenceQuote: z.string().trim().min(1).max(400).nullable().optional(),
  sourceId: z.string().trim().min(1).max(100).nullable().optional(),
});
export type RubricMetric = z.infer<typeof RubricMetricSchema>;

export const RubricEvaluationSchema = z.object({
  metrics: z.array(RubricMetricSchema).max(20),
  strengths: z.array(z.string().trim().min(1).max(300)).max(6),
  gaps: z.array(z.string().trim().min(1).max(300)).max(6),
  confidence: z.enum(["low", "medium", "high"]),
});
export type RubricEvaluation = z.infer<typeof RubricEvaluationSchema>;

export const ResumeExtractionSchema = z.object({
  skills: z.array(z.string()).describe("Concrete skills mentioned in the resume — tools, languages, technical or soft skills"),
  interests: z
    .array(z.string())
    .describe("Career fields or areas of interest implied by the resume's experience and education"),
});
export type ResumeExtraction = z.infer<typeof ResumeExtractionSchema>;
