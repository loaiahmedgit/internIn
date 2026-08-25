import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod";
import type { AIProvider } from "./provider";
import {
  InternshipDraftSchema,
  ChallengeSchema,
  ScenarioSchema,
  RubricCriterionSchema,
  CandidateEvidenceSchema,
  CandidateComparisonRowSchema,
  InternshipProgramSchema,
  type Challenge,
  type CandidateComparisonRow,
} from "./schemas";

/**
 * Real provider — OpenRouter via the Vercel AI SDK's generateObject (the
 * SDK's current recommended structured-output API as of the installed
 * version; not an architectural requirement — swap it if a future SDK
 * version recommends something else). Model comes from AI_MODEL, never
 * hardcoded in a call site — changing models is a one-line env change.
 *
 * Control fields (ids, status) are never trusted from the model: the AI
 * output schema omits them, and this class assigns them itself. That keeps
 * "AI never silently publishes" true at the type level, not just by
 * convention.
 */

const DEFAULT_MODEL = "google/gemma-4-31b-it-20260402";

function getModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local to use the real AI provider (see .env.local.example).",
    );
  }
  const openrouter = createOpenRouter({ apiKey });
  return openrouter(process.env.AI_MODEL ?? DEFAULT_MODEL);
}

// AI output shapes omit app-managed control fields (ids, status).
const ChallengeContentSchema = ChallengeSchema.omit({ status: true }).extend({
  tasks: z.array(z.object({ title: z.string(), description: z.string() })),
});

export class GemmaProvider implements AIProvider {
  async generateInternship(input: { description: string }) {
    const { object } = await generateObject({
      model: getModel(),
      schema: InternshipDraftSchema,
      prompt: `A hiring manager described an internship role in their own words. Turn it into a structured internship listing.

Manager's description: "${input.description}"

Infer a sensible role title, realistic duration and hours/week if not stated (default 8 weeks, 20 hours/week), a location (default "Doha / Hybrid" unless stated), slots (default 1), and 3-5 relevant skills.`,
    });
    return object;
  }

  async generateSyntheticScenario(input: { workDescription: string }) {
    const { object } = await generateObject({
      model: getModel(),
      schema: ScenarioSchema,
      prompt: `A company described real work an intern would do: "${input.workDescription}"

Invent a FICTIONAL company and a safe, simulated business scenario that mirrors this work without using any real company's data. The company name must be clearly fictional. Describe (in dataDescription) what synthetic data/files would be provided — never real internal data.`,
    });
    return object;
  }

  async generateRubric(challenge: Challenge) {
    const { object } = await generateObject({
      model: getModel(),
      schema: z.object({ rubric: z.array(RubricCriterionSchema) }),
      prompt: `Write a 3-5 criterion evaluation rubric for this work challenge. Each criterion needs a short name and a one-sentence description of what "good" looks like.

Challenge: ${challenge.title}
Scenario: ${challenge.scenario}
Skills being tested: ${challenge.skills.join(", ")}
Tasks: ${challenge.tasks.map((t) => t.description).join("; ")}`,
    });
    return object.rubric;
  }

  async generateChallenge(input: { internship: { role: string; skills: string[] }; workDescription: string }) {
    const scenario = await this.generateSyntheticScenario({ workDescription: input.workDescription });

    const { object: content } = await generateObject({
      model: getModel(),
      schema: ChallengeContentSchema,
      prompt: `Build a realistic but SAFE work-sample challenge for a "${input.internship.role}" candidate, based on real work described as: "${input.workDescription}"

Use this fictional scenario (do not invent a different company): ${scenario.companyName} — ${scenario.premise} Synthetic data available: ${scenario.dataDescription}

Requirements:
- 3-5 concrete tasks the candidate must complete, in order
- estimatedMinutes should be realistic for the scope (typically 45-120)
- skills tested should overlap with: ${input.internship.skills.join(", ")}
- deliverables: what the candidate must submit
- files: synthetic/fictional files provided (e.g. brief.pdf, dataset.csv) with a one-line description each
- rubric: 3-5 evaluation criteria
- Never reference real companies, real people, or real proprietary data — everything must be clearly synthetic/fictional.`,
    });

    const challenge: Challenge = {
      ...content,
      tasks: content.tasks.map((t) => ({ id: crypto.randomUUID(), ...t })),
      status: "ai_generated",
    };
    return challenge;
  }

  async editChallenge(challenge: Challenge, instruction: string) {
    const { object: content } = await generateObject({
      model: getModel(),
      schema: ChallengeContentSchema,
      prompt: `Apply this edit instruction to the work challenge below and return the FULL updated challenge (not a diff). Keep everything unchanged except what the instruction asks for.

Instruction: "${instruction}"

Current challenge (JSON):
${JSON.stringify({ ...challenge, status: undefined })}`,
    });

    const challengeIds = new Map(challenge.tasks.map((t) => [t.description, t.id]));
    const next: Challenge = {
      ...content,
      tasks: content.tasks.map((t) => ({ id: challengeIds.get(t.description) ?? crypto.randomUUID(), ...t })),
      status: "pending_approval",
    };
    return next;
  }

  async summarizeCandidate(input: { candidateName: string; challenge: Challenge; submissionNotes: string }) {
    const { object } = await generateObject({
      model: getModel(),
      schema: CandidateEvidenceSchema.omit({ candidateName: true }),
      prompt: `Write a descriptive (non-scored) performance summary for a candidate's submission to this challenge. Base it only on the submission notes below — do NOT invent details the candidate didn't write, and do NOT invent a numeric score.

Candidate: ${input.candidateName}
Challenge: ${input.challenge.title}
Tasks: ${input.challenge.tasks.map((t) => t.description).join("; ")}
Rubric: ${input.challenge.rubric.map((r) => r.criterion).join(", ")}

Candidate's submission notes:
"""
${input.submissionNotes || "(no written notes were submitted)"}
"""`,
    });
    return { candidateName: input.candidateName, ...object };
  }

  async compareCandidates(candidates: Awaited<ReturnType<GemmaProvider["summarizeCandidate"]>>[]) {
    const { object } = await generateObject({
      model: getModel(),
      schema: z.object({ rows: z.array(CandidateComparisonRowSchema) }),
      prompt: `Summarize these candidates into a comparison table. Preserve the given order and candidate names exactly.

${JSON.stringify(candidates)}`,
    });
    return object.rows as CandidateComparisonRow[];
  }

  async generateInternshipProgram(input: {
    internName: string;
    role: string;
    durationWeeks: number;
    hoursPerWeek: number;
    goals: string;
  }) {
    const { object } = await generateObject({
      model: getModel(),
      schema: InternshipProgramSchema.omit({ internName: true, role: true, durationWeeks: true, hoursPerWeek: true }),
      prompt: `Generate a week-by-week internship program plan.

Intern: ${input.internName}, Role: ${input.role}
Duration: ${input.durationWeeks} weeks, ${input.hoursPerWeek} hours/week
Manager's goals: "${input.goals}"

Requirements: exactly ${input.durationWeeks} weeks (week numbers 1 to ${input.durationWeeks}). Week 1 must be onboarding (meet team, learn context, tool access). The final week must be a capstone/final project + presentation + documentation. Middle weeks should build toward the stated goals.`,
    });
    return { internName: input.internName, role: input.role, durationWeeks: input.durationWeeks, hoursPerWeek: input.hoursPerWeek, ...object };
  }
}
