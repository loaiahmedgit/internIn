import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "./gemma-provider";
import { withGenerateRetries } from "./challenge-generation";
import type { ChallengeDraft } from "./challenge-clarification-schemas";

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

/**
 * What the model actually fills in for "Create internship from this draft" —
 * deliberately narrow. Everything here is content the challenge already
 * implies (role, scenario, skills, tasks) restated as a real internship
 * posting. Real logistics the challenge conversation never asked about
 * (location, duration, hours/week, mode, deadline, start date, openings)
 * are NOT here — never invented; the review screen asks the employer for
 * those directly (see opportunity-from-challenge-actions.ts).
 */
const OpportunityFromChallengeSchema = z.object({
  title: z.string().trim().min(2).max(120),
  shortDescription: optionalText(500),
  description: z.string().trim().min(20).max(4000),
  whatYouWillLearn: optionalText(2000),
  requirements: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  niceToHave: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
});
export type OpportunityFromChallenge = z.infer<typeof OpportunityFromChallengeSchema>;

const TIMEOUT_MS = 30_000;
const ATTEMPTS = [{}, {}] as const;

/**
 * Turns an approved ChallengeDraft into real internship-posting copy — the
 * public listing content, not the challenge itself (Opportunity -> Challenge,
 * never the other way round). ONE small model call, reusing the draft's own
 * role/scenario/skills/tasks — never re-asks the employer anything the
 * conversation already resolved.
 */
export async function generateOpportunityFromChallenge(draft: ChallengeDraft): Promise<OpportunityFromChallenge> {
  const taskLines = draft.tasks.map((t) => `- ${t.title}`).join("\n");
  const prompt = `A company is hiring an intern. They already designed this practical work challenge for the role — write the internship POSTING (not the challenge) that this candidate would apply to.

Role: ${draft.role}
Challenge title: ${draft.title}
Scenario: ${draft.scenario}
Skills assessed: ${draft.skills.join(", ")}
Tasks in the challenge:
${taskLines}

Write a real internship posting: a compelling title (usually "${draft.role}" or a close, natural variant — e.g. add "Intern" if it's not already in the role name), a one-sentence short description, a fuller role description (what the intern will actually do day to day — broader than just the challenge), what they'll learn, requirements (skills/background a candidate should have), and nice-to-have extras. Never mention logistics you don't know (location, hours, duration, dates) — that's handled separately.`;

  return withGenerateRetries("generateOpportunityFromChallenge", ATTEMPTS, async () => {
    const { object } = await generateObject({
      model: getModel(),
      schema: OpportunityFromChallengeSchema,
      system: "You write clear, honest internship postings for a hiring platform. Never fabricate a logistics detail (location, hours, dates) that wasn't given to you.",
      prompt,
      temperature: 0.5,
      maxOutputTokens: 1200,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return object;
  });
}
