import { z } from "zod";

const boundedTextArray = (maxItems: number, maxLength: number) =>
  z.array(z.string().trim().min(1).max(maxLength)).max(maxItems);

const optionalText = (maxLength: number) => z.string().trim().min(1).max(maxLength).nullable().optional();

/**
 * A task-first description of the employer's need. The occupation title is
 * deliberately optional: problem-first employers should not need to know it.
 * No candidate or protected-characteristic fields belong in this contract.
 */
export const WorkNeedProfileSchema = z.object({
  originalRequest: z.string().trim().min(1).max(2_000),
  explicitRoleTitle: optionalText(160),
  problems: boundedTextArray(8, 240),
  activities: boundedTextArray(12, 180),
  /**
   * Open-ended work-domain concepts grounded in the employer's description.
   * This intentionally is not an industry enum: new occupations and domains
   * must remain representable without a deployment.
   */
  domainSignals: boundedTextArray(8, 160).default([]),
  systemsOrTools: boundedTextArray(12, 100),
  desiredOutcomes: boundedTextArray(8, 240),
  constraints: boundedTextArray(8, 240),
  activityClarity: z.enum(["clear", "ambiguous"]),
  domainClarity: z.enum(["clear", "ambiguous"]).default("ambiguous"),
  seniorityIntent: optionalText(100),
});
export type WorkNeedProfile = z.infer<typeof WorkNeedProfileSchema>;

/**
 * Grounded activity evidence for retrieval. A model may preserve a clearly
 * domain-bound problem and outcome while conservatively leaving `activities`
 * empty; in that case the original problem/outcome text is safer than either
 * inventing tasks or discarding the employer's evidence.
 */
export function workActivitySignals(need: WorkNeedProfile): string[] {
  if (need.activities.length) return need.activities;
  if (need.domainClarity === "clear" && need.problems.length && need.desiredOutcomes.length) {
    return [...need.problems, ...need.desiredOutcomes];
  }
  return [];
}

/**
 * Employment-status words that name no profession at all. A title built
 * entirely from these carries zero role information — trusting it as a
 * meaningful "explicit role" or a retrieved profile's display title would
 * let a bare word like "intern" silently stand in for a real role. This is
 * a generic-noun filter shared by extraction and retrieval, not a
 * per-profession rule: it contains no industry or occupation vocabulary,
 * so it never needs updating when a new occupation is added.
 */
const GENERIC_ROLE_WORDS = new Set([
  "intern", "interns", "internship", "internships", "trainee", "trainees", "apprentice", "apprentices",
  "student", "students", "employee", "employees", "staff", "worker", "workers", "hire", "hires",
  "candidate", "candidates", "person", "people", "someone", "somebody", "member", "members", "team",
  "individual", "individuals", "recruit", "recruits", "position", "role", "job", "junior", "entry", "level",
]);

export function isGenericRoleTitle(title: string): boolean {
  const words = title
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .split(/\s+/u)
    .filter(Boolean);
  return words.length > 0 && words.every((word) => GENERIC_ROLE_WORDS.has(word));
}

export const RoleProfileSourceMappingSchema = z.object({
  source: z.enum(["onet", "esco", "internin_curated"]),
  externalId: z.string().trim().min(1).max(300),
  relation: z.enum(["exact", "narrower", "broader", "related"]),
  sourceVersion: z.string().trim().min(1).max(80).nullable().optional(),
});
export type RoleProfileSourceMapping = z.infer<typeof RoleProfileSourceMappingSchema>;

/** The retrieval-facing projection produced from local role-knowledge rows. */
export const RoleKnowledgeProfileSchema = z.object({
  id: z.string().trim().min(1).max(120),
  kind: z.enum(["source_occupation", "internship_overlay"]),
  canonicalTitle: z.string().trim().min(2).max(160),
  internshipTitle: optionalText(160),
  alternateTitles: boundedTextArray(30, 160),
  occupationFamily: z.string().trim().min(2).max(160),
  description: z.string().trim().min(1).max(2_000),
  typicalTasks: boundedTextArray(30, 300),
  workActivities: boundedTextArray(30, 200),
  skills: boundedTextArray(30, 160),
  knowledge: boundedTextArray(20, 160),
  commonTools: boundedTextArray(30, 120),
  workEnvironments: boundedTextArray(12, 160),
  competencies: boundedTextArray(20, 160),
  typicalDeliverables: boundedTextArray(15, 200),
  safetyConstraints: boundedTextArray(10, 300),
  sourceMappings: z.array(RoleProfileSourceMappingSchema).max(20),
});
export type RoleKnowledgeProfile = z.infer<typeof RoleKnowledgeProfileSchema>;

export const RecommendedRoleSchema = z.object({
  roleProfileId: z.string().trim().min(1).max(120).nullable().optional(),
  title: z.string().trim().min(2).max(160),
  confidence: z.number().min(0).max(1),
  reason: z.string().trim().min(1).max(500),
  evidence: boundedTextArray(8, 240),
});
export type RecommendedRole = z.infer<typeof RecommendedRoleSchema>;

export const RoleRecommendationResultSchema = z.object({
  recommendedRole: RecommendedRoleSchema.nullable(),
  alternatives: z.array(RecommendedRoleSchema).max(3),
  ambiguity: z.enum(["low", "medium", "high"]),
  clarificationNeeded: z.boolean(),
  clarificationQuestion: optionalText(400),
  roleSource: z.enum(["explicit", "inferred"]),
});
export type RoleRecommendationResult = z.infer<typeof RoleRecommendationResultSchema>;
