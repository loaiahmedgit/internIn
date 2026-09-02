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
  systemsOrTools: boundedTextArray(12, 100),
  desiredOutcomes: boundedTextArray(8, 240),
  constraints: boundedTextArray(8, 240),
  activityClarity: z.enum(["clear", "ambiguous"]),
  seniorityIntent: optionalText(100),
});
export type WorkNeedProfile = z.infer<typeof WorkNeedProfileSchema>;

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
