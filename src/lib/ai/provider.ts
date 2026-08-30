import type {
  CandidateComparisonRow,
  CandidateEvidence,
  Challenge,
  InternshipDraft,
  InternshipProgram,
  ResumeExtraction,
  RubricCriterion,
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
}
