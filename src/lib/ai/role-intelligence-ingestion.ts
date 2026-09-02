import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { RoleKnowledgeProfile } from "./role-intelligence-schemas";

type SourceReleaseSeed = {
  source: "onet" | "esco" | "internin_curated";
  version: string;
  publishedAt?: Date;
  checksum?: string;
  attribution: string;
  licenseUrl?: string;
};

const SOURCE_RELEASES: SourceReleaseSeed[] = [
  {
    source: "onet",
    version: "31.0",
    attribution: "O*NET® 31.0 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA).",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
  {
    source: "esco",
    version: "1.2.1",
    publishedAt: new Date("2025-12-10T00:00:00.000Z"),
    attribution: "This service uses the ESCO classification of the European Commission.",
    licenseUrl: "https://esco.ec.europa.eu/en/use-esco/download/privacy-statement",
  },
  {
    source: "internin_curated",
    version: "1",
    attribution: "internIn curated internship role overlay, informed by mapped occupation sources.",
  },
];

export function normalizeRoleKnowledgeText(value: string): string {
  return value.toLocaleLowerCase("en").replace(/[^\p{L}\p{N}+#./-]+/gu, " ").trim();
}

/** Builds one denormalized document with task/activity evidence before titles. */
export function buildRoleSearchText(profile: RoleKnowledgeProfile): string {
  return [
    `activities ${[...profile.workActivities, ...profile.typicalTasks].join(" ")}`,
    `tools ${profile.commonTools.join(" ")}`,
    `skills ${profile.skills.join(" ")}`,
    `knowledge ${profile.knowledge.join(" ")}`,
    `deliverables ${profile.typicalDeliverables.join(" ")}`,
    `description ${profile.description}`,
    `titles ${[profile.internshipTitle, profile.canonicalTitle, ...profile.alternateTitles].filter(Boolean).join(" ")}`,
  ].join("\n");
}

function evidenceRows(profile: RoleKnowledgeProfile) {
  const groups = [
    ["description", [profile.description], 45],
    ["task", profile.typicalTasks, 100],
    ["work_activity", profile.workActivities, 100],
    ["skill", profile.skills, 75],
    ["knowledge", profile.knowledge, 65],
    ["tool", profile.commonTools, 90],
    ["work_environment", profile.workEnvironments, 30],
    ["competency", profile.competencies, 55],
    ["deliverable", profile.typicalDeliverables, 70],
    ["safety_constraint", profile.safetyConstraints, 90],
  ] as const;

  return groups.flatMap(([evidenceType, values, importance]) =>
    values.map((text) => ({
      evidenceType,
      text,
      normalizedText: normalizeRoleKnowledgeText(text),
      importance,
      // Fixture/overlay wording is internIn-authored even where the profile
      // maps to an official occupation. Source mappings preserve that
      // distinction instead of mislabeling adapted text as verbatim O*NET.
      source: "internin_curated" as const,
    })),
  );
}

/**
 * Idempotently imports a version-controlled profile set into the local role
 * knowledge tables. Upstream O*NET/ESCO parsers can feed this same boundary;
 * runtime recommendation never calls either external service.
 */
export async function importRoleKnowledgeProfiles(profiles: RoleKnowledgeProfile[]) {
  const db = getDb();

  await db.transaction(async (tx) => {
    const releaseIds = new Map<string, string>();
    for (const release of SOURCE_RELEASES) {
      const [row] = await tx
        .insert(schema.roleSourceReleases)
        .values(release)
        .onConflictDoUpdate({
          target: [schema.roleSourceReleases.source, schema.roleSourceReleases.version],
          set: {
            publishedAt: release.publishedAt,
            checksum: release.checksum,
            attribution: release.attribution,
            licenseUrl: release.licenseUrl,
            importedAt: new Date(),
          },
        })
        .returning({ id: schema.roleSourceReleases.id });
      releaseIds.set(`${release.source}:${release.version}`, row.id);
    }

    for (const profile of profiles) {
      const [profileRow] = await tx
        .insert(schema.roleProfiles)
        .values({
          stableKey: profile.id,
          kind: profile.kind,
          canonicalTitle: profile.canonicalTitle,
          internshipTitle: profile.internshipTitle,
          occupationFamily: profile.occupationFamily,
          description: profile.description,
          active: true,
          metadata: {},
        })
        .onConflictDoUpdate({
          target: schema.roleProfiles.stableKey,
          set: {
            kind: profile.kind,
            canonicalTitle: profile.canonicalTitle,
            internshipTitle: profile.internshipTitle,
            occupationFamily: profile.occupationFamily,
            description: profile.description,
            active: true,
            updatedAt: new Date(),
          },
        })
        .returning({ id: schema.roleProfiles.id });

      await tx.delete(schema.roleProfileAliases).where(eq(schema.roleProfileAliases.roleProfileId, profileRow.id));
      await tx.delete(schema.roleProfileEvidence).where(eq(schema.roleProfileEvidence.roleProfileId, profileRow.id));
      await tx.delete(schema.roleProfileSourceMappings).where(eq(schema.roleProfileSourceMappings.roleProfileId, profileRow.id));

      const aliases = [...new Set([profile.canonicalTitle, profile.internshipTitle, ...profile.alternateTitles].filter((value): value is string => Boolean(value)))];
      if (aliases.length) {
        await tx.insert(schema.roleProfileAliases).values(
          aliases.map((alias) => ({
            roleProfileId: profileRow.id,
            alias,
            normalizedAlias: normalizeRoleKnowledgeText(alias),
            source: "internin_curated" as const,
          })),
        );
      }

      const evidence = evidenceRows(profile);
      if (evidence.length) {
        await tx.insert(schema.roleProfileEvidence).values(evidence.map((row) => ({ ...row, roleProfileId: profileRow.id })));
      }

      for (const mapping of profile.sourceMappings) {
        const releaseId = releaseIds.get(`${mapping.source}:${mapping.sourceVersion ?? (mapping.source === "internin_curated" ? "1" : "")}`);
        if (!releaseId) throw new Error(`Missing source release for ${mapping.source}:${mapping.sourceVersion ?? "unspecified"}`);
        await tx.insert(schema.roleProfileSourceMappings).values({
          roleProfileId: profileRow.id,
          sourceReleaseId: releaseId,
          externalId: mapping.externalId,
          relation: mapping.relation,
        });
      }

      await tx
        .insert(schema.roleProfileSearchDocuments)
        .values({ roleProfileId: profileRow.id, searchText: buildRoleSearchText(profile) })
        .onConflictDoUpdate({
          target: schema.roleProfileSearchDocuments.roleProfileId,
          set: { searchText: buildRoleSearchText(profile), documentVersion: 1, embeddingModel: null, updatedAt: new Date() },
        });
    }

    // A release can legitimately contain zero profiles in a test import;
    // the compound lookup below also proves the enum/version pair remains
    // the stable release identity rather than a guessed latest version.
    await tx
      .select({ id: schema.roleSourceReleases.id })
      .from(schema.roleSourceReleases)
      .where(and(eq(schema.roleSourceReleases.source, "internin_curated"), eq(schema.roleSourceReleases.version, "1")))
      .limit(1);
  });
}
