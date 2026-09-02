import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { recommendRoleFromProfiles } from "./role-intelligence";
import { workActivitySignals, type RoleKnowledgeProfile, type RoleRecommendationResult, type WorkNeedProfile } from "./role-intelligence-schemas";

type EvidenceType = typeof schema.roleEvidenceTypeEnum.enumValues[number];

function searchTerms(values: string[]): string | null {
  const terms = [...new Set(
    values
      .flatMap((value) => value.toLocaleLowerCase("en").replace(/[^\p{L}\p{N}+#./-]+/gu, " ").split(/\s+/u))
      .filter((term) => term.length > 1),
  )];
  return terms.length ? terms.map((term) => `"${term.replaceAll('"', "")}"`).join(" OR ") : null;
}

function valuesForType(
  rows: (typeof schema.roleProfileEvidence.$inferSelect)[],
  evidenceType: EvidenceType,
): string[] {
  return rows
    .filter((row) => row.evidenceType === evidenceType)
    .sort((left, right) => right.importance - left.importance)
    .map((row) => row.text);
}

async function retrieveEvidenceProfileIds(types: EvidenceType[], values: string[], limit: number): Promise<string[]> {
  const query = searchTerms(values);
  if (!query) return [];
  const db = getDb();
  const fullTextQuery = sql`websearch_to_tsquery('english', ${query})`;
  const rows = await db
    .selectDistinct({ id: schema.roleProfileEvidence.roleProfileId })
    .from(schema.roleProfileEvidence)
    .innerJoin(schema.roleProfiles, eq(schema.roleProfileEvidence.roleProfileId, schema.roleProfiles.id))
    .where(and(
      eq(schema.roleProfiles.active, true),
      inArray(schema.roleProfileEvidence.evidenceType, types),
      sql`to_tsvector('english', ${schema.roleProfileEvidence.normalizedText}) @@ ${fullTextQuery}`,
    ))
    .limit(limit);
  return rows.map((row) => row.id);
}

async function retrieveDomainProfileIds(values: string[], limit: number): Promise<string[]> {
  const query = searchTerms(values);
  if (!query) return [];
  const db = getDb();
  const fullTextQuery = sql`websearch_to_tsquery('english', ${query})`;
  const rows = await db
    .select({ id: schema.roleProfiles.id })
    .from(schema.roleProfiles)
    .where(and(
      eq(schema.roleProfiles.active, true),
      sql`to_tsvector('english', ${schema.roleProfiles.occupationFamily} || ' ' || ${schema.roleProfiles.description}) @@ ${fullTextQuery}`,
    ))
    .limit(limit);
  return rows.map((row) => row.id);
}

async function retrieveExplicitTitleProfileIds(explicitTitle: string | null | undefined, limit: number): Promise<string[]> {
  const query = searchTerms(explicitTitle ? [explicitTitle] : []);
  if (!query) return [];
  const db = getDb();
  const fullTextQuery = sql`websearch_to_tsquery('english', ${query})`;
  const [profiles, aliases] = await Promise.all([
    db
      .select({ id: schema.roleProfiles.id })
      .from(schema.roleProfiles)
      .where(and(
        eq(schema.roleProfiles.active, true),
        sql`to_tsvector('english', ${schema.roleProfiles.canonicalTitle} || ' ' || coalesce(${schema.roleProfiles.internshipTitle}, '')) @@ ${fullTextQuery}`,
      ))
      .limit(limit),
    db
      .selectDistinct({ id: schema.roleProfileAliases.roleProfileId })
      .from(schema.roleProfileAliases)
      .innerJoin(schema.roleProfiles, eq(schema.roleProfileAliases.roleProfileId, schema.roleProfiles.id))
      .where(and(
        eq(schema.roleProfiles.active, true),
        sql`to_tsvector('english', ${schema.roleProfileAliases.normalizedAlias}) @@ ${fullTextQuery}`,
      ))
      .limit(limit),
  ]);
  return [...profiles, ...aliases].map((row) => row.id);
}

async function hydrateProfiles(ids: string[]): Promise<RoleKnowledgeProfile[]> {
  if (!ids.length) return [];
  const db = getDb();
  const [profiles, aliases, evidence, mappings] = await Promise.all([
    db.select().from(schema.roleProfiles).where(and(eq(schema.roleProfiles.active, true), inArray(schema.roleProfiles.id, ids))),
    db.select().from(schema.roleProfileAliases).where(inArray(schema.roleProfileAliases.roleProfileId, ids)),
    db.select().from(schema.roleProfileEvidence).where(inArray(schema.roleProfileEvidence.roleProfileId, ids)),
    db
      .select({ mapping: schema.roleProfileSourceMappings, release: schema.roleSourceReleases })
      .from(schema.roleProfileSourceMappings)
      .innerJoin(schema.roleSourceReleases, eq(schema.roleProfileSourceMappings.sourceReleaseId, schema.roleSourceReleases.id))
      .where(inArray(schema.roleProfileSourceMappings.roleProfileId, ids)),
  ]);

  const order = new Map(ids.map((id, index) => [id, index]));
  return profiles
    .sort((left, right) => (order.get(left.id) ?? ids.length) - (order.get(right.id) ?? ids.length))
    .map((profile) => {
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
}

/**
 * Retrieves a recall-oriented union from distinct evidence channels. Final
 * eligibility and confidence are decided by the channel-aware reranker; an
 * empty or failed retrieval remains empty so the product can safely abstain.
 */
export async function retrieveRoleProfiles(need: WorkNeedProfile, limit = 24): Promise<RoleKnowledgeProfile[]> {
  const perChannelLimit = Math.max(limit, 30);
  try {
    const [activityIds, domainEvidenceIds, domainProfileIds, toolIds, contextIds, explicitTitleIds] = await Promise.all([
      retrieveEvidenceProfileIds(["task", "work_activity", "deliverable"], workActivitySignals(need), perChannelLimit),
      retrieveEvidenceProfileIds(["knowledge", "skill", "work_environment"], need.domainSignals, perChannelLimit),
      retrieveDomainProfileIds(need.domainSignals, perChannelLimit),
      retrieveEvidenceProfileIds(["tool"], need.systemsOrTools, perChannelLimit),
      retrieveEvidenceProfileIds(["description", "task", "work_activity"], [...need.problems, ...need.desiredOutcomes], perChannelLimit),
      retrieveExplicitTitleProfileIds(need.explicitRoleTitle, perChannelLimit),
    ]);

    // Channel order is intentional: activity evidence controls recall first,
    // while title retrieval participates only for an employer-named role.
    const ids = [...new Set([
      ...activityIds,
      ...domainEvidenceIds,
      ...domainProfileIds,
      ...toolIds,
      ...contextIds,
      ...explicitTitleIds,
    ])].slice(0, limit);
    return hydrateProfiles(ids);
  } catch (error) {
    const cause = error instanceof Error && "cause" in error && error.cause instanceof Error
      ? ` (${error.cause.message})`
      : "";
    console.warn("[role-intelligence] local evidence retrieval unavailable; abstaining:", `${error instanceof Error ? error.message : error}${cause}`);
    return [];
  }
}

export async function recommendRoleFromKnowledgeBase(need: WorkNeedProfile): Promise<RoleRecommendationResult> {
  const profiles = await retrieveRoleProfiles(need);
  return recommendRoleFromProfiles(need, profiles);
}
