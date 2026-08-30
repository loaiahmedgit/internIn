"use server";

import { aiProvider } from "./index";
import { requireCurrentCompanyMember, requireCurrentStudent } from "@/lib/auth";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

async function requireEvidenceAi() {
  const { membership } = await requireCurrentCompanyMember();
  const [company] = await getDb().select({ enabled: schema.companies.evidenceAiEnabled }).from(schema.companies).where(eq(schema.companies.id, membership.companyId));
  if (!company?.enabled) throw new Error("AI evidence summaries are disabled in Settings.");
}
import {
  CandidateComparisonRowSchema,
  CandidateEvidenceSchema,
  ChallengeSchema,
  InternshipDraftSchema,
  InternshipProgramSchema,
  ResumeExtractionSchema,
  type Challenge,
  type InternshipDraft,
  type CandidateEvidence,
} from "./schemas";

const GenerateInternshipInputSchema = z.object({
  description: z.string().trim().min(20).max(3000),
});
const GenerateChallengeInputSchema = z.object({
  internship: InternshipDraftSchema,
  workDescription: z.string().trim().min(20).max(4000),
});
const EditInstructionSchema = z.string().trim().min(2).max(1000);

/**
 * Server Action wrappers — the only way client components may trigger AI
 * generation. `aiProvider` (and any real API key it needs) never gets
 * imported into a client component's bundle this way.
 */

export async function generateInternshipAction(input: { description: string }): Promise<InternshipDraft> {
  await requireCurrentCompanyMember("hiring_access");
  const validated = GenerateInternshipInputSchema.parse(input);
  return InternshipDraftSchema.parse(await aiProvider.generateInternship(validated));
}

export async function generateChallengeAction(input: {
  internship: InternshipDraft;
  workDescription: string;
}): Promise<Challenge> {
  await requireCurrentCompanyMember("hiring_access");
  const validated = GenerateChallengeInputSchema.parse(input);
  return ChallengeSchema.parse(await aiProvider.generateChallenge(validated));
}

export async function editChallengeAction(challenge: Challenge, instruction: string): Promise<Challenge> {
  await requireCurrentCompanyMember("hiring_access");
  const validatedChallenge = ChallengeSchema.parse(challenge);
  const validatedInstruction = EditInstructionSchema.parse(instruction);
  return ChallengeSchema.parse(await aiProvider.editChallenge(validatedChallenge, validatedInstruction));
}

export async function summarizeCandidateAction(input: {
  candidateName: string;
  challenge: Challenge;
  submissionNotes: string;
}): Promise<CandidateEvidence> {
  await requireEvidenceAi();
  const validated = z
    .object({
      candidateName: z.string().trim().min(1).max(120),
      challenge: ChallengeSchema,
      submissionNotes: z.string().max(10000),
    })
    .parse(input);
  return CandidateEvidenceSchema.parse(await aiProvider.summarizeCandidate(validated));
}

export async function compareCandidatesAction(candidates: CandidateEvidence[]) {
  await requireEvidenceAi();
  const validated = z.array(CandidateEvidenceSchema).min(2).max(20).parse(candidates);
  return z.array(CandidateComparisonRowSchema).parse(await aiProvider.compareCandidates(validated));
}

export async function generateInternshipProgramAction(input: {
  internName: string;
  role: string;
  durationWeeks: number;
  hoursPerWeek: number;
  goals: string;
}) {
  await requireCurrentCompanyMember("program_supervisor");
  const validated = z.object({
    internName: z.string().trim().min(1).max(120),
    role: z.string().trim().min(2).max(120),
    durationWeeks: z.number().int().min(1).max(52),
    hoursPerWeek: z.number().int().min(1).max(60),
    goals: z.string().trim().min(20).max(4000),
  }).parse(input);
  return InternshipProgramSchema.parse(await aiProvider.generateInternshipProgram(validated));
}

export async function extractResumeInfoAction(resumeText: string) {
  await requireCurrentStudent();
  const validated = z.string().trim().min(20).max(50000).parse(resumeText);
  return ResumeExtractionSchema.parse(await aiProvider.extractResumeInfo(validated));
}
