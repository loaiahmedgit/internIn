import { z } from "zod";

/**
 * Structured-output contracts for every AIProvider method.
 * Nothing in the app should ever save raw model text — only these validated shapes.
 */

export const InternshipDraftSchema = z.object({
  role: z.string().trim().min(2).max(120),
  duration: z.string().trim().min(2).max(80),
  hoursPerWeek: z.number().int().min(1).max(60),
  location: z.string().trim().min(2).max(120),
  slots: z.number().int().min(1).max(100),
  skills: z.array(z.string().trim().min(1).max(60)).max(20),
  description: z.string().trim().min(20).max(4000),
});
export type InternshipDraft = z.infer<typeof InternshipDraftSchema>;

export const ChallengeTaskSchema = z.object({
  id: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(2000),
});
export type ChallengeTask = z.infer<typeof ChallengeTaskSchema>;

export const RubricCriterionSchema = z.object({
  criterion: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(1500),
});
export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;

export const ChallengeAssetFileSchema = z.object({
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(1000),
});
export type ChallengeAssetFile = z.infer<typeof ChallengeAssetFileSchema>;

export const ChallengeSchema = z.object({
  title: z.string().trim().min(2).max(180),
  scenario: z.string().trim().min(20).max(6000),
  estimatedMinutes: z.number().int().min(10).max(480),
  skills: z.array(z.string().trim().min(1).max(60)).max(20),
  tasks: z.array(ChallengeTaskSchema).min(1).max(20),
  deliverables: z.array(z.string().trim().min(1).max(500)).min(1).max(15),
  files: z.array(ChallengeAssetFileSchema).max(10),
  rubric: z.array(RubricCriterionSchema).min(1).max(20),
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
