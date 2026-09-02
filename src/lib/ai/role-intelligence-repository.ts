import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ROLE_INTELLIGENCE_FIXTURES } from "./role-intelligence-fixtures";
import { recommendRoleFromProfiles } from "./role-intelligence";
import type { RoleKnowledgeProfile, RoleRecommendationResult, WorkNeedProfile } from "./role-intelligence-schemas";

function retrievalQuery(need: WorkNeedProfile): string {
  return [
    ...need.activities,
    ...need.systemsOrTools,
    ...need.desiredOutcomes,
    ...need.problems,
    need.originalRequest,
  ].join(" ");
}

function valuesForType(
  rows: (typeof schema.roleProfileEvidence.$inferSelect)[],
  evidenceType: typeof schema.roleEvidenceTypeEnum.enumValues[number],
): string[] {
  return rows
    .filter((row) => row.evidenceType === evidenceType)
    .sort((left, right) => right.importance - left.importance)
    .map((row) => row.text);
}

/**
 * Retrieves a small task-matched candidate set from local Postgres. The
 * deterministic fixture fallback keeps development and zero-downtime deploys
 * working before the additive migration/seed has reached every environment.
 */
export async function retrieveRoleProfiles(need: WorkNeedProfile, limit = 20): Promise<RoleKnowledgeProfile[]> {
  const db = getDb();
  const query = retrievalQuery(need).trim();

  try {
    const fullTextQuery = sql`plainto_tsquery('english', ${query})`;
    const rank = sql<number>`ts_rank_cd(to_tsvector('english', ${schema.roleProfileSearchDocuments.searchText}), ${fullTextQuery})`;
    const rows = query
      ? await db
          .select({ profile: schema.roleProfiles, rank })
          .from(schema.roleProfiles)
          .innerJoin(
            schema.roleProfileSearchDocuments,
            eq(schema.roleProfileSearchDocuments.roleProfileId, schema.roleProfiles.id),
          )
          .where(and(eq(schema.roleProfiles.active, true), sql`to_tsvector('english', ${schema.roleProfileSearchDocuments.searchText}) @@ ${fullTextQuery}`))
          .orderBy(desc(rank))
          .limit(limit)
      : await db
          .select({ profile: schema.roleProfiles, rank: sql<number>`0` })
          .from(schema.roleProfiles)
          .where(eq(schema.roleProfiles.active, true))
          .limit(limit);

    if (!rows.length) return ROLE_INTELLIGENCE_FIXTURES;
    const ids = rows.map((row) => row.profile.id);
    const [aliases, evidence, mappings] = await Promise.all([
      db.select().from(schema.roleProfileAliases).where(inArray(schema.roleProfileAliases.roleProfileId, ids)),
      db.select().from(schema.roleProfileEvidence).where(inArray(schema.roleProfileEvidence.roleProfileId, ids)),
      db
        .select({ mapping: schema.roleProfileSourceMappings, release: schema.roleSourceReleases })
        .from(schema.roleProfileSourceMappings)
        .innerJoin(schema.roleSourceReleases, eq(schema.roleProfileSourceMappings.sourceReleaseId, schema.roleSourceReleases.id))
        .where(inArray(schema.roleProfileSourceMappings.roleProfileId, ids)),
    ]);

    return rows.map(({ profile }) => {
      const profileEvidence = evidence.filter((row) => row.roleProfileId === profile.id);
      return {
        id: profile.stableKey,
        kind: profile.kind,
        canonicalTitle: profile.canonicalTitle,
        internshipTitle: profile.internshipTitle,
        alternateTitles: aliases.filter((row) => row.roleProfileId === profile.id).map((row) => row.alias),
        occupationFamily: profile.occupationFamily,
        description: profile.description,
        typicalTasks: valuesForType(profileEvidence, "task"),
        workActivities: valuesForType(profileEvidence, "work_activity"),
        skills: valuesForType(profileEvidence, "skill"),
        knowledge: valuesForType(profileEvidence, "knowledge"),
        commonTools: valuesForType(profileEvidence, "tool"),
        workEnvironments: valuesForType(profileEvidence, "work_environment"),
        competencies: valuesForType(profileEvidence, "competency"),
        typicalDeliverables: valuesForType(profileEvidence, "deliverable"),
        safetyConstraints: valuesForType(profileEvidence, "safety_constraint"),
        sourceMappings: mappings
          .filter((row) => row.mapping.roleProfileId === profile.id)
          .map(({ mapping, release }) => ({
            source: release.source,
            externalId: mapping.externalId,
            relation: mapping.relation,
            sourceVersion: release.version,
          })),
      } satisfies RoleKnowledgeProfile;
    });
  } catch (error) {
    // Additive rollouts can briefly run new code before the migration/seed.
    // Falling back to the same version-controlled corpus is safe and keeps
    // role discovery available; unexpected failures remain observable.
    console.warn("[role-intelligence] local retrieval unavailable; using bundled profiles:", error instanceof Error ? error.message : error);
    return ROLE_INTELLIGENCE_FIXTURES;
  }
}

export async function recommendRoleFromKnowledgeBase(need: WorkNeedProfile): Promise<RoleRecommendationResult> {
  const profiles = await retrieveRoleProfiles(need);
  return recommendRoleFromProfiles(need, profiles);
}
