import type {
  CandidateComparisonRow,
  CandidateEvidence,
  Challenge,
  InternshipAssistantAnswer,
  InternshipCopyAssist,
  InternshipDraft,
  InternshipProgram,
  ResumeExtraction,
  RubricCriterion,
  RubricEvaluation,
  Scenario,
} from "./schemas";
import type { EvidenceSource, EvidenceQuotesSchema } from "@/lib/company/evidence-summary";
import type { z } from "zod";

/**
 * The only surface application code is allowed to call for AI generation.
 * Swapping the model or vendor means writing a new class that implements this
 * interface and changing the single export in ./index.ts — nothing else in
 * the app should know or care which model is behind it.
 *
 * Model selection (when a real provider is wired up) must come from the
 * AI_MODEL env var, never a hardcoded model string in application code.
 */
export interface AIProvider {
  organizeEvidence(input: { sources: EvidenceSource[]; requirements: string }): Promise<z.infer<typeof EvidenceQuotesSchema>>;
  /** Manager's freeform description -> a structured internship listing draft. */
  generateInternship(input: { description: string }): Promise<InternshipDraft>;

  /** Manager's description of real work -> a safe, simulated Challenge. */
  generateChallenge(input: {
    internship: InternshipDraft;
    workDescription: string;
  }): Promise<Challenge>;

  /** Apply a natural-language edit instruction to an existing Challenge. */
  editChallenge(challenge: Challenge, instruction: string): Promise<Challenge>;

  /** The fictional company/scenario a Challenge is staged inside. */
  generateSyntheticScenario(input: { workDescription: string }): Promise<Scenario>;

  /** Evaluation criteria for a given Challenge. */
  generateRubric(challenge: Challenge): Promise<RubricCriterion[]>;

  /** Turn one student submission into descriptive (non-scored) evidence. */
  summarizeCandidate(input: {
    candidateName: string;
    challenge: Challenge;
    submissionNotes: string;
  }): Promise<CandidateEvidence>;

  /** Compare several candidates' evidence side by side. */
  compareCandidates(candidates: CandidateEvidence[]): Promise<CandidateComparisonRow[]>;

  /**
   * Adaptive, per-challenge structured evaluation — one metric per rubric
   * criterion (the rubric is already role/challenge-specific), plus
   * cross-cutting strengths/gaps/confidence. Must never output a hiring
   * verdict, ranking, or recommendation — enforced by prompt + the output
   * schema itself having no such field.
   */
  evaluateAgainstRubric(input: {
    rubric: RubricCriterion[];
    sources: EvidenceSource[];
    /** Real reasons specific artifacts couldn't be read (e.g. "Figma design
     * file: requires human review — design tool not accessible"). Passed so
     * a criterion that depends on one of these is never confidently scored
     * from unrelated text instead. */
    unavailable: string[];
  }): Promise<RubricEvaluation>;

  /** Whether this provider's configured model can accept image input for evaluation — false unless explicitly known to support vision, never assumed. */
  supportsVision(): boolean;

  /** Manager's description of the accepted intern's plan -> a week-by-week program. */
  generateInternshipProgram(input: {
    internName: string;
    role: string;
    durationWeeks: number;
    hoursPerWeek: number;
    goals: string;
  }): Promise<InternshipProgram>;

  /** Extract skills/interests from resume text. Never written to the profile directly — the student reviews it first. */
  extractResumeInfo(resumeText: string): Promise<ResumeExtraction>;

  /** One optional assist on the Create/Edit Internship form. The recruiter can always type everything by hand instead — this only ever suggests, never gates saving. */
  assistInternshipCopy(input: {
    task: "draft_description" | "improve_description" | "suggest_requirements" | "suggest_learning_outcomes";
    role: string;
    shortDescription?: string;
    fullDescription?: string;
    requirements?: string[];
  }): Promise<InternshipCopyAssist>;

  /** Answers a free-form question about ONE internship's real hiring data. `facts` is a server-built string of real, already-computed numbers/dates for that internship — the model must answer using only what's in it, never invent a figure. */
  answerInternshipQuestion(input: { question: string; facts: string }): Promise<InternshipAssistantAnswer>;
}
