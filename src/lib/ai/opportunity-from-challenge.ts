import { z } from "zod";
import type { ChallengeDraft, EmployerContext } from "./challenge-clarification-schemas";

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

/**
 * The deliberately narrow listing shape produced from an employer context
 * or existing challenge draft. Real logistics the conversation never asked
 * about are NOT here; the review screen asks the employer for those.
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

function sentenceList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function ensureInternTitle(role: string): string {
  const clean = role.trim().replace(/\s+role$/i, "");
  return /\bintern(ship)?\b/i.test(clean) ? clean : `${clean} Intern`;
}

function withPeriod(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** Builds listing copy only from the employer's canonical structured
 * context. This deterministic path is used by the conversation-first
 * internship flow so a second model call cannot invent a team/company
 * claim or silently rename a selected responsibility or technology. */
export function buildGroundedOpportunityFromContext(
  draft: ChallengeDraft,
  context: EmployerContext,
): OpportunityFromChallenge {
  const title = ensureInternTitle(context.role || draft.role);
  const responsibilities = context.responsibilities;
  const tools = context.tools;
  const responsibilityList = sentenceList(responsibilities);
  const toolList = sentenceList(tools);

  const shortDescription = responsibilities.length
    ? `Build practical experience in ${responsibilityList}${tools.length ? ` using ${toolList}` : ""}.`
    : `Build practical experience completing ${draft.role.toLowerCase()} work${tools.length ? ` using ${toolList}` : ""}.`;

  const descriptionParts = [`As a ${title}, you will work on practical role-related tasks.`];
  if (responsibilities.length) descriptionParts.push(`Your responsibilities will include ${responsibilityList}.`);
  if (tools.length) descriptionParts.push(`You will use ${toolList} while completing this work.`);

  const requirements: string[] = [];
  if (context.level) requirements.push(withPeriod(context.level));
  if (tools.length) requirements.push(`Working knowledge of ${toolList}.`);
  if (responsibilities.length) requirements.push(`Interest in ${responsibilityList}.`);
  requirements.push("Ability to complete practical tasks and explain your approach clearly.");

  const niceToHave: string[] = [];
  if (tools.length) niceToHave.push(`An academic, personal, or internship project using ${toolList}.`);
  if (responsibilities.length > 1) niceToHave.push(`Experience combining ${responsibilityList} in one project or feature.`);

  const learningParts: string[] = [];
  if (responsibilities.length) learningParts.push(`build practical experience in ${responsibilityList}`);
  if (tools.length) learningParts.push(`strengthen your use of ${toolList}`);
  learningParts.push("practice completing structured work against clear requirements");

  return OpportunityFromChallengeSchema.parse({
    title,
    shortDescription,
    description: descriptionParts.join(" "),
    whatYouWillLearn: `You will ${sentenceList(learningParts)}.`,
    requirements: requirements.slice(0, 6),
    niceToHave: niceToHave.slice(0, 3),
  });
}

/**
 * Turns an approved ChallengeDraft into real internship-posting copy — the
 * public listing content, not the challenge itself (Opportunity -> Challenge,
 * never the other way round). This is intentionally deterministic: a
 * challenge simulation may contain fictional context, but a real listing
 * must never inherit that context or invent employer facts.
 */
export async function generateOpportunityFromChallenge(
  draft: ChallengeDraft,
  employerContext?: EmployerContext,
): Promise<OpportunityFromChallenge> {
  const groundedContext: EmployerContext = employerContext ?? {
    originalRequest: draft.role,
    role: draft.role,
    level: null,
    responsibilities: [],
    tools: draft.skills,
    restrictions: [],
    additionalContext: null,
  };
  return buildGroundedOpportunityFromContext(draft, groundedContext);
}
