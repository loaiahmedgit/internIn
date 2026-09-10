"use server";

import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { canManagePublication, type WorkspacePermission } from "@/lib/company/permissions";
import { sendNotificationEvent } from "@/lib/inngest/client";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  ChallengeSchema,
  InternshipDraftSchema,
  InternshipProgramSchema,
  InternshipCopyAssistSchema,
  NOT_A_WORK_MODE_LOCATION_MESSAGE,
  isWorkModeLabel,
  aiProvider,
  type InternshipDraft,
  type InternshipProgram,
  type Challenge,
} from "@/lib/ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateResourceFile } from "@/lib/challenges/resource-generation";
import { ApplicationModeSchema, type ApplicationMode } from "@/lib/opportunities/application-mode";
import {
  NO_FREE_LABOR_POLICY_VERSION,
  assertChallengeSafeguards,
} from "@/lib/challenges/no-free-labor";

const IdSchema = z.string().uuid();
const VersionSourceSchema = z.enum(["ai_generated", "human_edited", "approved"]);

/**
 * Resolves the signed-in user's company and throws if there isn't one —
 * every write below goes through this, so a missing/invalid session or a
 * cross-company id can never silently succeed.
 */
async function getCompanyIdForCurrentUser(permission: WorkspacePermission = "hiring_access") {
  const { user, membership } = await requireCurrentCompanyMember(permission);
  return { companyId: membership.companyId, userId: user.id, memberRole: membership.role, canPublish: canManagePublication(membership) };
}

async function assertCompanyVerified(companyId: string) {
  const db = getDb();
  const [company] = await db
    .select({ verified: schema.companies.verified })
    .from(schema.companies)
    .where(eq(schema.companies.id, companyId))
    .limit(1);
  if (!company?.verified) {
    throw new Error("Verify your company before publishing or inviting candidates.");
  }
}

async function assertOwnsOpportunity(opportunityId: string, companyId: string) {
  const db = getDb();
  const [opportunity] = await db
    .select()
    .from(schema.opportunities)
    .where(eq(schema.opportunities.id, opportunityId))
    .limit(1);
  if (!opportunity || opportunity.companyId !== companyId) {
    throw new Error("Not authorized for this opportunity.");
  }
  return opportunity;
}

/**
 * Turns each AI-named/company-named resource on a Challenge into a real
 * `challenge_resources` row — the fix for "the challenge mentions a file
 * that never actually exists". A resource whose format the pipeline can
 * synthesize gets real bytes uploaded to the private `challenge-resources`
 * bucket and `generationStatus: "ready"`; a real external link is recorded
 * as-is; anything else gets a row with `generationStatus: "requires_upload"`
 * — never silently dropped, never hidden from the employer.
 */
async function persistChallengeResources(versionId: string, files: Challenge["files"]) {
  if (files.length === 0) return;
  const db = getDb();
  const admin = createAdminClient();
  const rows: (typeof schema.challengeResources.$inferInsert)[] = [];

  for (const file of files) {
    const resourceType = file.resourceType ?? "file";
    const artifactKind = file.artifactKind ?? "document";

    if (resourceType === "link") {
      rows.push({
        challengeVersionId: versionId,
        name: file.name,
        resourceType: "link",
        artifactKind,
        externalUrl: file.externalUrl ?? null,
        description: file.description,
        generationStatus: file.externalUrl ? "ready" : "requires_upload",
      });
      continue;
    }

    let generated: Awaited<ReturnType<typeof generateResourceFile>>;
    try {
      generated = await generateResourceFile({ name: file.name, description: file.description, contentSpec: file.contentSpec });
    } catch (err) {
      // The renderer (e.g. Takumi for PDFs) threw instead of returning —
      // never invent bytes or pretend the resource is ready; mark it
      // honestly failed, same as an upload-error row below.
      console.error(`[persistChallengeResources] generation threw for "${file.name}":`, err instanceof Error ? err.message : err);
      rows.push({
        challengeVersionId: versionId,
        name: file.name,
        resourceType: "file",
        artifactKind,
        description: file.description,
        contentSpec: file.contentSpec ?? null,
        generationStatus: "failed",
      });
      continue;
    }
    if (!generated) {
      rows.push({
        challengeVersionId: versionId,
        name: file.name,
        resourceType: "file",
        artifactKind,
        description: file.description,
        contentSpec: file.contentSpec ?? null,
        generationStatus: "requires_upload",
      });
      continue;
    }

    const resourceId = crypto.randomUUID();
    const extension = file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? "";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${versionId}/${resourceId}-${safeName}`;
    const { error } = await admin.storage
      .from("challenge-resources")
      .upload(storagePath, generated.buffer, { contentType: generated.mimeType, upsert: false });

    rows.push({
      id: resourceId,
      challengeVersionId: versionId,
      name: file.name,
      resourceType: "file",
      artifactKind,
      mimeType: generated.mimeType,
      fileExtension: extension,
      storagePath: error ? null : storagePath,
      sizeBytes: generated.buffer.byteLength,
      description: file.description,
      contentSpec: file.contentSpec ?? null,
      generationStatus: error ? "failed" : "ready",
    });
    if (error) console.error(`[persistChallengeResources] upload failed for "${file.name}":`, error.message);
  }

  if (rows.length) await db.insert(schema.challengeResources).values(rows);
}

/** Every internIn challenge needs real substance before it can be
 * approved — no "no challenge" path. Checked against the Challenge object
 * itself, before anything is written. */
function assertChallengeSubstance(challenge: Challenge) {
  if (!challenge.scenario.trim()) throw new Error("This challenge has no scenario.");
  if (challenge.tasks.length === 0) throw new Error("This challenge has no tasks.");
  if (!challenge.submissionRequirements.some((r) => r.required)) {
    throw new Error("This challenge has no required submission requirement — every internIn challenge needs at least one real thing the candidate must hand in.");
  }
  if (challenge.rubric.length === 0) throw new Error("This challenge has no evaluation rubric.");
}

/** Checked after resources are persisted for a version — approval/publish
 * must not proceed while a required resource is missing, failed, or still
 * pending generation. */
async function assertChallengeResourcesReady(versionId: string) {
  const db = getDb();
  const resources = await db
    .select({ name: schema.challengeResources.name, generationStatus: schema.challengeResources.generationStatus })
    .from(schema.challengeResources)
    .where(eq(schema.challengeResources.challengeVersionId, versionId));
  const notReady = resources.filter((r) => r.generationStatus !== "ready");
  if (notReady.length > 0) {
    throw new Error(
      `These resources need attention before this challenge can be approved: ${notReady.map((r) => `"${r.name}" (${r.generationStatus})`).join(", ")}.`,
    );
  }
}

/**
 * R2 — applicationMode is never part of InternshipDraftSchema (that schema
 * doubles as the AI generateInternship structured-output contract —
 * gemma-provider.ts:68 — so the model must never be able to set it). It's a
 * separate, explicit company decision, validated on its own and defaulted
 * to the locked owner default here, matching the column default.
 */
export async function createOpportunityAction(internship: InternshipDraft, applicationMode: ApplicationMode = "optional_challenge") {
  const validated = InternshipDraftSchema.parse(internship);
  const validatedMode = ApplicationModeSchema.parse(applicationMode);
  const { companyId, userId } = await getCompanyIdForCurrentUser();
  const db = getDb();

  const [opportunity] = await db
    .insert(schema.opportunities)
    .values({
      companyId,
      role: validated.role,
      description: validated.description,
      duration: validated.duration,
      hoursPerWeek: validated.hoursPerWeek,
      location: validated.location,
      workMode: validated.workMode ?? null,
      applicationDeadline: validated.applicationDeadline ?? null,
      slots: validated.slots,
      skills: validated.skills,
      status: "draft",
      applicationMode: validatedMode,
    })
    .returning();

  await db.insert(schema.eventLog).values({
    entityType: "opportunity",
    entityId: opportunity.id,
    eventType: "opportunity_created",
    actorUserId: userId,
  });

  return opportunity.id as string;
}

/**
 * Every generation and every edit lands here as a new immutable
 * challenge_versions row — never an update to existing content fields.
 * This is what "keep the original AI output + edits + approved version"
 * actually means at the data layer.
 */
export async function saveChallengeVersionAction(
  opportunityId: string,
  challenge: Challenge,
  source: "ai_generated" | "human_edited" | "approved",
  editInstruction?: string,
) {
  const validatedOpportunityId = IdSchema.parse(opportunityId);
  const validatedChallenge = ChallengeSchema.parse(challenge);
  const validatedSource = VersionSourceSchema.parse(source);
  if (validatedChallenge.status === "published") {
    throw new Error("Publishing requires the dedicated publish action.");
  }
  if (validatedSource === "approved" && validatedChallenge.status !== "approved") {
    throw new Error("An approved version must have approved status.");
  }
  if (validatedChallenge.status === "approved") {
    assertChallengeSubstance(validatedChallenge);
    assertChallengeSafeguards({
      policyVersion: NO_FREE_LABOR_POLICY_VERSION,
      assessmentBasis: validatedChallenge.assessmentBasis,
      nonProductionConfirmed: validatedChallenge.nonProductionConfirmed === true,
      estimatedMinutes: validatedChallenge.estimatedMinutes,
      durationExceptionJustification: validatedChallenge.durationExceptionJustification,
      productionWorkRisk: validatedChallenge.productionWorkRisk,
      transformationApplied: validatedChallenge.transformationApplied,
    });
  }

  const { companyId, userId, canPublish } = await getCompanyIdForCurrentUser();
  if (validatedSource === "approved" && !canPublish) throw new Error("Ask a Workspace Admin to grant Hiring Access before approving a challenge.");
  await assertOwnsOpportunity(validatedOpportunityId, companyId);
  const db = getDb();

  let [challengeRow] = await db
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.opportunityId, validatedOpportunityId))
    .limit(1);

  if (!challengeRow) {
    // Initialize from the company's current credential defaults (docs/12,
    // Phase 4C §5) — a plain copy at creation time, never a live reference.
    // Changing the company default afterward must never mutate this or any
    // other already-created challenge; nothing here re-reads it later.
    const [company] = await db
      .select({ defaultCredentialPolicy: schema.companies.defaultCredentialPolicy, defaultRequireHumanConfirmation: schema.companies.defaultRequireHumanConfirmation })
      .from(schema.companies)
      .where(eq(schema.companies.id, companyId))
      .limit(1);
    [challengeRow] = await db
      .insert(schema.challenges)
      .values({
        opportunityId: validatedOpportunityId,
        status: validatedChallenge.status,
        credentialPolicy: company?.defaultCredentialPolicy ?? "internin_verified",
        requireHumanConfirmation: company?.defaultRequireHumanConfirmation ?? false,
      })
      .returning();
  }

  const existingVersions = await db
    .select({ id: schema.challengeVersions.id })
    .from(schema.challengeVersions)
    .where(eq(schema.challengeVersions.challengeId, challengeRow.id));
  const versionNumber = existingVersions.length + 1;

  const [version] = await db
    .insert(schema.challengeVersions)
    .values({
      challengeId: challengeRow.id,
      versionNumber,
      source: validatedSource,
      editInstruction: editInstruction ? z.string().trim().max(1000).parse(editInstruction) : null,
      title: validatedChallenge.title,
      scenario: validatedChallenge.scenario,
      estimatedMinutes: validatedChallenge.estimatedMinutes,
      estimatedDurationLabel: validatedChallenge.estimatedDurationLabel ?? null,
      safeguardPolicyVersion: NO_FREE_LABOR_POLICY_VERSION,
      assessmentBasis: validatedChallenge.assessmentBasis ?? null,
      productionWorkRisk: validatedChallenge.productionWorkRisk ?? null,
      productionWorkReason: validatedChallenge.productionWorkReason ?? null,
      transformationApplied: validatedChallenge.transformationApplied ?? null,
      originalIntentSummary: validatedChallenge.originalIntentSummary ?? null,
      nonProductionConfirmedByUserId:
        validatedSource === "approved" && validatedChallenge.nonProductionConfirmed === true ? userId : null,
      nonProductionConfirmedAt:
        validatedSource === "approved" && validatedChallenge.nonProductionConfirmed === true ? new Date() : null,
      durationExceptionJustification: validatedChallenge.durationExceptionJustification ?? null,
      skills: validatedChallenge.skills,
      tasks: validatedChallenge.tasks,
      deliverables: validatedChallenge.deliverables,
      files: validatedChallenge.files,
      rubric: validatedChallenge.rubric,
      submissionRequirements: validatedChallenge.submissionRequirements,
      createdByUserId: userId,
    })
    .returning();

  await persistChallengeResources(version.id, validatedChallenge.files);
  if (validatedChallenge.status === "approved") {
    await assertChallengeResourcesReady(version.id);
  }

  await db
    .update(schema.challenges)
    .set({ status: validatedChallenge.status, currentVersionId: version.id, updatedAt: new Date() })
    .where(eq(schema.challenges.id, challengeRow.id));

  await db.insert(schema.eventLog).values({
    entityType: "challenge",
    entityId: challengeRow.id,
    eventType: validatedSource === "approved" ? "challenge_approved" : "challenge_version_created",
    actorUserId: userId,
    metadata: { versionNumber, source: validatedSource },
  });
  if (validatedSource === "approved" && validatedChallenge.nonProductionConfirmed === true) {
    await db.insert(schema.eventLog).values({
      entityType: "challenge",
      entityId: challengeRow.id,
      eventType: "challenge_non_production_confirmed",
      actorUserId: userId,
      metadata: {
        versionId: version.id,
        versionNumber,
        assessmentBasis: validatedChallenge.assessmentBasis,
      },
    });
  }
  if (
    validatedSource === "approved" &&
    validatedChallenge.estimatedMinutes > 90 &&
    validatedChallenge.durationExceptionJustification
  ) {
    await db.insert(schema.eventLog).values({
      entityType: "challenge",
      entityId: challengeRow.id,
      eventType: "challenge_duration_exception_confirmed",
      actorUserId: userId,
      metadata: {
        versionId: version.id,
        versionNumber,
        estimatedMinutes: validatedChallenge.estimatedMinutes,
      },
    });
  }

  return { challengeId: challengeRow.id as string, versionId: version.id as string };
}

/**
 * R2 §4 — the single shared publish-readiness gate, used by BOTH real
 * publish entry points in this codebase (publishOpportunityAction, reached
 * from ChallengeBuilder, and saveInternshipAction's publish=true path,
 * reached from the manual Create/Edit Internship form — these are
 * independent code paths that must never disagree). `quick_apply` skips the
 * challenge requirement entirely; `optional_challenge`/`challenge_required`
 * both require a real approved challenge before publish (the two modes
 * differ only in whether completing it later is required, never in
 * publish-time readiness). Flips the challenge's own status to `published`
 * when one exists and isn't already — mirrors the exact checks
 * publishOpportunityAction always ran, just gated on mode first.
 */
async function ensureChallengeReadyForPublish(
  opportunityId: string,
  applicationMode: ApplicationMode,
  actorUserId: string,
  options: { allowLegacyAlreadyPublished?: boolean } = {},
) {
  if (applicationMode === "quick_apply") return;
  const db = getDb();
  const [challengeRow] = await db
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.opportunityId, opportunityId))
    .limit(1);
  if (!challengeRow) {
    throw new Error("Add and approve a work challenge before publishing this mode — or switch application mode to Quick Apply.");
  }
  if (challengeRow.status !== "approved" && challengeRow.status !== "published") {
    throw new Error("Approve the current challenge version before publishing.");
  }
  if (!challengeRow.currentVersionId) {
    throw new Error("This challenge has no current version to publish.");
  }
  const [currentVersion] = await db
    .select()
    .from(schema.challengeVersions)
    .where(eq(schema.challengeVersions.id, challengeRow.currentVersionId))
    .limit(1);
  if (!currentVersion) {
    throw new Error("This challenge's current version could not be found.");
  }
  assertChallengeSubstance({
    title: currentVersion.title,
    scenario: currentVersion.scenario,
    estimatedMinutes: currentVersion.estimatedMinutes,
    estimatedDurationLabel: currentVersion.estimatedDurationLabel,
    assessmentBasis: currentVersion.assessmentBasis,
    productionWorkRisk: currentVersion.productionWorkRisk,
    productionWorkReason: currentVersion.productionWorkReason,
    transformationApplied: currentVersion.transformationApplied,
    originalIntentSummary: currentVersion.originalIntentSummary,
    nonProductionConfirmed: Boolean(
      currentVersion.nonProductionConfirmedByUserId && currentVersion.nonProductionConfirmedAt,
    ),
    durationExceptionJustification: currentVersion.durationExceptionJustification,
    skills: currentVersion.skills,
    tasks: currentVersion.tasks,
    deliverables: currentVersion.deliverables,
    files: currentVersion.files,
    rubric: currentVersion.rubric,
    submissionRequirements: currentVersion.submissionRequirements,
    status: "approved",
  });
  assertChallengeSafeguards(
    {
      policyVersion: currentVersion.safeguardPolicyVersion,
      assessmentBasis: currentVersion.assessmentBasis,
      nonProductionConfirmed: Boolean(
        currentVersion.nonProductionConfirmedByUserId && currentVersion.nonProductionConfirmedAt,
      ),
      estimatedMinutes: currentVersion.estimatedMinutes,
      durationExceptionJustification: currentVersion.durationExceptionJustification,
      productionWorkRisk: currentVersion.productionWorkRisk,
      transformationApplied: currentVersion.transformationApplied,
    },
    {
      // Legacy bypass is deliberately narrower than "the opportunity row
      // says published": the exact legacy Challenge must already be live.
      // A merely approved legacy version still needs an R3 review before it
      // can cross the publication boundary.
      allowLegacyAlreadyPublished:
        options.allowLegacyAlreadyPublished === true && challengeRow.status === "published",
    },
  );
  await assertChallengeResourcesReady(challengeRow.currentVersionId);

  if (challengeRow.status !== "published") {
    await db
      .update(schema.challenges)
      .set({ status: "published", updatedAt: new Date() })
      .where(eq(schema.challenges.id, challengeRow.id));
    await db.insert(schema.eventLog).values({
      entityType: "challenge",
      entityId: challengeRow.id,
      eventType: "challenge_published",
      actorUserId,
    });
  }
}

export async function publishOpportunityAction(opportunityId: string) {
  const validatedOpportunityId = IdSchema.parse(opportunityId);
  const { companyId, userId, canPublish } = await getCompanyIdForCurrentUser();
  if (!canPublish) throw new Error("Ask a Workspace Admin to grant Hiring Access before publishing.");
  await assertCompanyVerified(companyId);
  const opportunity = await assertOwnsOpportunity(validatedOpportunityId, companyId);
  const db = getDb();

  await ensureChallengeReadyForPublish(validatedOpportunityId, opportunity.applicationMode, userId, {
    allowLegacyAlreadyPublished: opportunity.status === "published",
  });

  await db
    .update(schema.opportunities)
    .set({ status: "published", updatedAt: new Date() })
    .where(eq(schema.opportunities.id, validatedOpportunityId));

  await db.insert(schema.eventLog).values({
    entityType: "opportunity",
    entityId: validatedOpportunityId,
    eventType: "challenge_published",
    actorUserId: userId,
  });
}

/**
 * R2 §5/§7 — the canonical place to change an existing opportunity's
 * application mode after creation, reused by both the AI-wizard and
 * manual-form creation paths (neither owns mode editing itself). Switching
 * to quick_apply, or editing a still-draft opportunity to any mode, is
 * always safe — draft opportunities are re-gated at actual publish time.
 * Switching an already-published opportunity to optional/required must not
 * silently leave it advertising a Challenge it doesn't have.
 */
export async function updateApplicationModeAction(opportunityId: string, applicationMode: ApplicationMode) {
  const validatedId = IdSchema.parse(opportunityId);
  const validatedMode = ApplicationModeSchema.parse(applicationMode);
  const { companyId, userId, canPublish } = await getCompanyIdForCurrentUser();
  if (!canPublish) throw new Error("Ask a Workspace Admin to grant Hiring Access before changing how students apply.");
  const opportunity = await assertOwnsOpportunity(validatedId, companyId);

  if (opportunity.status === "published") {
    await ensureChallengeReadyForPublish(validatedId, validatedMode, userId, {
      allowLegacyAlreadyPublished: true,
    });
  }

  const db = getDb();
  await db
    .update(schema.opportunities)
    .set({ applicationMode: validatedMode, updatedAt: new Date() })
    .where(eq(schema.opportunities.id, validatedId));

  await db.insert(schema.eventLog).values({
    entityType: "opportunity",
    entityId: validatedId,
    eventType: "application_mode_updated",
    actorUserId: userId,
    metadata: { applicationMode: validatedMode },
  });
}

/** Ends the application window. Reversible in the data model (just a status flag), so no confirmation dialog is required. */
export async function closeOpportunityAction(opportunityId: string) {
  const validatedOpportunityId = IdSchema.parse(opportunityId);
  const { companyId, canPublish } = await getCompanyIdForCurrentUser();
  if (!canPublish) throw new Error("Ask a Workspace Admin to grant Hiring Access before closing an internship.");
  const opportunity = await assertOwnsOpportunity(validatedOpportunityId, companyId);
  if (opportunity.status !== "published") throw new Error("Only an open internship can be closed.");
  const db = getDb();

  await db
    .update(schema.opportunities)
    .set({ status: "closed", updatedAt: new Date() })
    .where(eq(schema.opportunities.id, validatedOpportunityId));
}

/** Copies the listing content into a brand-new draft — never the challenge, applicants, or offers, which stay tied to the original. */
export async function duplicateOpportunityAction(opportunityId: string) {
  const validatedOpportunityId = IdSchema.parse(opportunityId);
  const { companyId, userId } = await getCompanyIdForCurrentUser();
  const source = await assertOwnsOpportunity(validatedOpportunityId, companyId);
  const db = getDb();

  const [copy] = await db
    .insert(schema.opportunities)
    .values({
      companyId,
      role: `${source.role} (copy)`,
      description: source.description,
      duration: source.duration,
      hoursPerWeek: source.hoursPerWeek,
      location: source.location,
      workMode: source.workMode,
      slots: source.slots,
      skills: source.skills,
      status: "draft",
    })
    .returning();

  await db.insert(schema.eventLog).values({
    entityType: "opportunity",
    entityId: copy.id,
    eventType: "opportunity_created",
    actorUserId: userId,
    metadata: { duplicatedFrom: validatedOpportunityId },
  });

  return copy.id as string;
}

/**
 * Lets a company correct its own listing details — the fields captured at
 * creation time (location, work mode, slots, etc.) — for an internship of
 * any status. This is the only way location/workMode can be fixed on a
 * published or closed opportunity; the create wizard has no "edit" mode.
 */
export async function updateOpportunityDetailsAction(opportunityId: string, details: InternshipDraft) {
  const validatedOpportunityId = IdSchema.parse(opportunityId);
  const validated = InternshipDraftSchema.parse(details);
  const { companyId } = await getCompanyIdForCurrentUser();
  await assertOwnsOpportunity(validatedOpportunityId, companyId);
  const db = getDb();

  await db
    .update(schema.opportunities)
    .set({
      role: validated.role,
      description: validated.description,
      duration: validated.duration,
      hoursPerWeek: validated.hoursPerWeek,
      location: validated.location,
      workMode: validated.workMode ?? null,
      applicationDeadline: validated.applicationDeadline ?? null,
      slots: validated.slots,
      skills: validated.skills,
      updatedAt: new Date(),
    })
    .where(eq(schema.opportunities.id, validatedOpportunityId));
}

/** Every field the manual Create/Edit Internship form can set. Everything optional besides the true minimum a listing needs to exist. */
const InternshipFormSchema = z.object({
  role: z.string().trim().min(2).max(120),
  department: z.string().trim().max(120).nullable().optional(),
  shortDescription: z.string().trim().max(500).nullable().optional(),
  description: z.string().trim().min(1).max(6000),
  whatYouWillLearn: z.string().trim().max(3000).nullable().optional(),
  requirements: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  niceToHave: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  duration: z.string().trim().min(1).max(80),
  hoursPerWeek: z.number().int().min(1).max(60),
  location: z.string().trim().min(1).max(120).refine((v) => !isWorkModeLabel(v), NOT_A_WORK_MODE_LOCATION_MESSAGE),
  workMode: z.enum(["remote", "onsite", "hybrid"]).nullable().optional(),
  applicationDeadline: z.coerce.date().nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  slots: z.number().int().min(1).max(100),
  skills: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  requireCv: z.boolean().default(true),
  applicationQuestions: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  applicationMode: ApplicationModeSchema.default("optional_challenge"),
});
export type InternshipFormInput = z.infer<typeof InternshipFormSchema>;

/**
 * The manual-first Create/Edit Internship form's single save path — Save
 * draft and Publish both call this, `publish` just decides the resulting
 * status. Creates a new posting when `opportunityId` is omitted, otherwise
 * updates the caller's own existing one. A challenge is only required when
 * publishing a non-quick_apply mode (R2 §4) — this is a genuinely separate,
 * independent publish entry point from publishOpportunityAction
 * (ChallengeBuilder's own path), so it runs the exact same shared gate
 * rather than trusting the other path to have already checked.
 */
export async function saveInternshipAction(input: {
  opportunityId?: string;
  publish: boolean;
  form: InternshipFormInput;
}) {
  const validated = InternshipFormSchema.parse(input.form);
  const { companyId, userId, canPublish } = await getCompanyIdForCurrentUser();
  if (input.publish && !canPublish) {
    throw new Error("Ask a Workspace Admin to grant Hiring Access before publishing.");
  }
  if (input.publish) await assertCompanyVerified(companyId);
  const db = getDb();

  const values = {
    role: validated.role,
    department: validated.department || null,
    shortDescription: validated.shortDescription || null,
    description: validated.description,
    whatYouWillLearn: validated.whatYouWillLearn || null,
    requirements: validated.requirements,
    niceToHave: validated.niceToHave,
    duration: validated.duration,
    hoursPerWeek: validated.hoursPerWeek,
    location: validated.location,
    workMode: validated.workMode ?? null,
    applicationDeadline: validated.applicationDeadline ?? null,
    startDate: validated.startDate ?? null,
    slots: validated.slots,
    skills: validated.skills,
    requireCv: validated.requireCv,
    applicationQuestions: validated.applicationQuestions,
    applicationMode: validated.applicationMode,
  };

  if (input.opportunityId) {
    const validatedId = IdSchema.parse(input.opportunityId);
    const existing = await assertOwnsOpportunity(validatedId, companyId);
    const nowPublishing = input.publish && existing.status !== "published";
    if (input.publish) {
      await ensureChallengeReadyForPublish(validatedId, validated.applicationMode, userId, {
        allowLegacyAlreadyPublished: existing.status === "published",
      });
    }
    await db
      .update(schema.opportunities)
      .set({ ...values, status: input.publish ? "published" : existing.status, updatedAt: new Date() })
      .where(eq(schema.opportunities.id, validatedId));
    await db.insert(schema.eventLog).values({
      entityType: "opportunity",
      entityId: validatedId,
      eventType: nowPublishing ? "opportunity_published" : "opportunity_edited",
      actorUserId: userId,
    });
    return validatedId;
  }

  if (input.publish) {
    // No opportunity row exists yet to gate against — insert as a draft
    // first so ensureChallengeReadyForPublish (and any future challenge on
    // it) has a real opportunityId, exactly like the create-then-publish
    // wizard flow already does. A brand-new listing can never have an
    // approved challenge yet anyway (no challenge row exists at all), so
    // this only ever succeeds today for quick_apply — expected: a
    // non-quick_apply mode's challenge is a separate step after creation.
    const [draft] = await db.insert(schema.opportunities).values({ ...values, companyId, createdByUserId: userId, status: "draft" }).returning();
    await ensureChallengeReadyForPublish(draft.id, validated.applicationMode, userId);
    await db.update(schema.opportunities).set({ status: "published", updatedAt: new Date() }).where(eq(schema.opportunities.id, draft.id));
    await db.insert(schema.eventLog).values({
      entityType: "opportunity",
      entityId: draft.id,
      eventType: "opportunity_published",
      actorUserId: userId,
    });
    return draft.id as string;
  }

  const [opportunity] = await db
    .insert(schema.opportunities)
    .values({ ...values, companyId, createdByUserId: userId, status: "draft" })
    .returning();
  await db.insert(schema.eventLog).values({
    entityType: "opportunity",
    entityId: opportunity.id,
    eventType: "opportunity_created",
    actorUserId: userId,
  });
  return opportunity.id as string;
}

/** Permanently removes a draft that was never published — a published/closed listing keeps its history via close, never delete. */
export async function deleteOpportunityAction(opportunityId: string) {
  const validatedOpportunityId = IdSchema.parse(opportunityId);
  const { companyId, userId } = await getCompanyIdForCurrentUser();
  const opportunity = await assertOwnsOpportunity(validatedOpportunityId, companyId);
  if (opportunity.status !== "draft") throw new Error("Only a draft can be deleted.");
  const db = getDb();

  await db.delete(schema.opportunities).where(eq(schema.opportunities.id, validatedOpportunityId));

  await db.insert(schema.eventLog).values({
    entityType: "opportunity",
    entityId: validatedOpportunityId,
    eventType: "opportunity_deleted",
    actorUserId: userId,
  });
}

/**
 * R2 §13/§14/§15 — the one canonical server-side fairness check, called
 * from every action capable of progressing an application past its
 * required Challenge (shortlist, offer). Gates on a real FINAL submission
 * row existing (submissions.applicationId) — never on AI evaluation having
 * run (an OpenRouter/provider outage must never block hiring), never on
 * challengeStartedAt alone (a started-but-not-submitted session doesn't
 * clear it), and never on candidate-specific signals like CV strength — the
 * mode is opportunity-wide, so this reads only the real opportunity row.
 */
async function assertChallengeRequirementMet(applicationId: string, applicationMode: ApplicationMode, blockedActionClause: string) {
  if (applicationMode !== "challenge_required") return;
  const db = getDb();
  const [submission] = await db
    .select({ id: schema.submissions.id })
    .from(schema.submissions)
    .where(eq(schema.submissions.applicationId, applicationId))
    .limit(1);
  if (!submission) {
    throw new Error(`This internship requires a completed Challenge before ${blockedActionClause}.`);
  }
}

export async function shortlistApplicationAction(applicationId: string) {
  const validatedApplicationId = IdSchema.parse(applicationId);
  const { companyId, userId } = await getCompanyIdForCurrentUser("hiring_reviewer");
  const db = getDb();

  const [application] = await db
    .select({ id: schema.applications.id, opportunityCompanyId: schema.opportunities.companyId, applicationMode: schema.opportunities.applicationMode })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .where(eq(schema.applications.id, validatedApplicationId))
    .limit(1);
  if (!application || application.opportunityCompanyId !== companyId) {
    throw new Error("Not authorized for this application.");
  }
  await assertChallengeRequirementMet(validatedApplicationId, application.applicationMode, "the candidate can be shortlisted");

  await db
    .update(schema.applications)
    .set({ status: "shortlisted", updatedAt: new Date() })
    .where(eq(schema.applications.id, validatedApplicationId));

  await db.insert(schema.eventLog).values({
    entityType: "application",
    entityId: validatedApplicationId,
    eventType: "application_shortlisted",
    actorUserId: userId,
  });
}

/** Mirrors shortlistApplicationAction exactly — the other real decision a company can make on an application. */
export async function declineApplicationAction(applicationId: string) {
  const validatedApplicationId = IdSchema.parse(applicationId);
  const { companyId, userId } = await getCompanyIdForCurrentUser("hiring_reviewer");
  const db = getDb();

  const [application] = await db
    .select({ id: schema.applications.id, opportunityCompanyId: schema.opportunities.companyId })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .where(eq(schema.applications.id, validatedApplicationId))
    .limit(1);
  if (!application || application.opportunityCompanyId !== companyId) {
    throw new Error("Not authorized for this application.");
  }

  await db
    .update(schema.applications)
    .set({ status: "declined", updatedAt: new Date() })
    .where(eq(schema.applications.id, validatedApplicationId));

  await db.insert(schema.eventLog).values({
    entityType: "application",
    entityId: validatedApplicationId,
    eventType: "application_declined",
    actorUserId: userId,
  });
}

/**
 * The defining moment (docs/03 + docs/06): a company converts evidence into
 * an offer. Per the MVP monetization decision, this must visibly trigger the
 * QAR 499 placement fee — stubbed for v1 as an immediate "stubbed_paid"
 * state (no real payment processor), not silently deferred or skipped.
 */
export async function inviteToInternshipAction(applicationId: string) {
  const validatedApplicationId = IdSchema.parse(applicationId);
  const { companyId, userId } = await getCompanyIdForCurrentUser("hiring_reviewer");
  await assertCompanyVerified(companyId);
  const db = getDb();

  const [application] = await db
    .select({
      id: schema.applications.id,
      opportunityCompanyId: schema.opportunities.companyId,
      applicationMode: schema.opportunities.applicationMode,
      role: schema.opportunities.role,
      companyName: schema.companies.name,
      studentEmail: schema.users.email,
      studentName: schema.users.fullName,
    })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .innerJoin(schema.users, eq(schema.applications.studentId, schema.users.id))
    .where(eq(schema.applications.id, validatedApplicationId))
    .limit(1);
  if (!application || application.opportunityCompanyId !== companyId) {
    throw new Error("Not authorized for this application.");
  }
  await assertChallengeRequirementMet(validatedApplicationId, application.applicationMode, "you can send an offer");

  const [existingOffer] = await db
    .select()
    .from(schema.internshipOffers)
    .where(eq(schema.internshipOffers.applicationId, validatedApplicationId))
    .limit(1);
  if (existingOffer && existingOffer.status !== "declined") return existingOffer.id as string;

  const offer = existingOffer
    ? (
        await db
          .update(schema.internshipOffers)
          .set({ status: "pending", updatedAt: new Date() })
          .where(eq(schema.internshipOffers.id, existingOffer.id))
          .returning()
      )[0]
    : (
        await db
          .insert(schema.internshipOffers)
          .values({
            applicationId: validatedApplicationId,
            status: "pending",
            placementFeeStatus: "stubbed_paid",
          })
          .returning()
      )[0];

  await db
    .update(schema.applications)
    .set({ status: "invited", updatedAt: new Date() })
    .where(eq(schema.applications.id, validatedApplicationId));

  await db.insert(schema.eventLog).values({
    entityType: "application",
    entityId: validatedApplicationId,
    eventType: "internship_offer_created",
    actorUserId: userId,
    metadata: existingOffer
      ? { reopened: true }
      : { placementFeeStatus: offer.placementFeeStatus, placementFeeQar: 499 },
  });

  await sendNotificationEvent({
    name: "internship/offer.created",
    data: {
      studentEmail: application.studentEmail,
      studentName: application.studentName,
      companyName: application.companyName,
      role: application.role,
      applicationId: validatedApplicationId,
    },
  });

  return offer.id as string;
}

/** Restores a shortlisted or rejected application while keeping closed offer history for audit. */
export async function moveApplicationToReviewAction(applicationId: string) {
  const validatedApplicationId = IdSchema.parse(applicationId);
  const { companyId, userId } = await getCompanyIdForCurrentUser("hiring_reviewer");
  const db = getDb();

  const [application] = await db
    .select({ id: schema.applications.id, opportunityCompanyId: schema.opportunities.companyId })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .where(eq(schema.applications.id, validatedApplicationId))
    .limit(1);
  if (!application || application.opportunityCompanyId !== companyId) {
    throw new Error("Not authorized for this application.");
  }

  const [existingOffer] = await db
    .select({ id: schema.internshipOffers.id, status: schema.internshipOffers.status })
    .from(schema.internshipOffers)
    .where(eq(schema.internshipOffers.applicationId, validatedApplicationId))
    .limit(1);
  if (existingOffer?.status === "pending" || existingOffer?.status === "accepted") {
    throw new Error("Withdraw the active offer before moving this candidate back to review.");
  }

  await db
    .update(schema.applications)
    .set({ status: "applied", updatedAt: new Date() })
    .where(eq(schema.applications.id, validatedApplicationId));

  await db.insert(schema.eventLog).values({
    entityType: "application",
    entityId: validatedApplicationId,
    eventType: "application_moved_to_review",
    actorUserId: userId,
  });
}

/** Withdraws a pending offer — the company changed its mind before the student accepted. Never touches an already-accepted offer (that's a real placement, not reversible here). */
export async function withdrawOfferAction(applicationId: string) {
  const validatedApplicationId = IdSchema.parse(applicationId);
  const { companyId, memberRole, userId } = await getCompanyIdForCurrentUser();
  if (memberRole === "member") throw new Error("Only a company owner or admin can withdraw an offer.");
  const db = getDb();

  const [application] = await db
    .select({ id: schema.applications.id, opportunityCompanyId: schema.opportunities.companyId })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .where(eq(schema.applications.id, validatedApplicationId))
    .limit(1);
  if (!application || application.opportunityCompanyId !== companyId) {
    throw new Error("Not authorized for this application.");
  }

  const [offer] = await db
    .select()
    .from(schema.internshipOffers)
    .where(eq(schema.internshipOffers.applicationId, validatedApplicationId))
    .limit(1);
  if (!offer) throw new Error("There's no offer to withdraw.");
  if (offer.status !== "pending") throw new Error("Only a pending offer can be withdrawn.");

  await db.update(schema.internshipOffers).set({ status: "declined", updatedAt: new Date() }).where(eq(schema.internshipOffers.id, offer.id));

  await db
    .update(schema.applications)
    .set({ status: "shortlisted", updatedAt: new Date() })
    .where(eq(schema.applications.id, validatedApplicationId));

  await db.insert(schema.eventLog).values({
    entityType: "application",
    entityId: validatedApplicationId,
    eventType: "internship_offer_withdrawn",
    actorUserId: userId,
  });
}

async function assertOwnsOffer(offerId: string, companyId: string) {
  const db = getDb();
  const [offer] = await db
    .select({ offer: schema.internshipOffers, opportunityCompanyId: schema.opportunities.companyId })
    .from(schema.internshipOffers)
    .innerJoin(schema.applications, eq(schema.internshipOffers.applicationId, schema.applications.id))
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .where(eq(schema.internshipOffers.id, offerId))
    .limit(1);
  if (!offer || offer.opportunityCompanyId !== companyId) {
    throw new Error("Not authorized for this offer.");
  }
  return offer.offer;
}

/**
 * AI proposes, the company controls (docs/04): the generated plan is only
 * ever handed to this action after the manager has reviewed/edited it in the
 * builder UI — nothing here calls the AI itself. Requires an accepted offer;
 * one program per offer (`internship_offers.id` is unique on the table).
 */
export async function createInternshipProgramAction(offerId: string, program: InternshipProgram) {
  const validatedOfferId = IdSchema.parse(offerId);
  const validatedProgram = InternshipProgramSchema.parse(program);
  const { companyId, userId } = await getCompanyIdForCurrentUser("program_supervisor");
  const offer = await assertOwnsOffer(validatedOfferId, companyId);

  if (offer.status !== "accepted") {
    throw new Error("The candidate hasn't accepted this offer yet.");
  }

  const db = getDb();
  // Idempotent (Phase 6A §7): offer_id is unique on internship_programs, so
  // a retried/double-submitted create must return the existing program
  // rather than throwing a confusing duplicate error or racing the unique
  // constraint. internship_offers.id is also unique per application, so
  // "one accepted student -> one program" holds per offer, while a second
  // accepted student on the SAME opportunity gets their own offer id and
  // therefore their own program (Phase 6A §17 — no capacity=1 assumption).
  const [existingProgram] = await db
    .select({ id: schema.internshipPrograms.id })
    .from(schema.internshipPrograms)
    .where(eq(schema.internshipPrograms.offerId, validatedOfferId))
    .limit(1);
  if (existingProgram) return existingProgram.id as string;

  const [membership] = await db.select().from(schema.companyMembers).where(and(eq(schema.companyMembers.companyId, companyId), eq(schema.companyMembers.userId, userId))).limit(1);

  const [programRow] = await db
    .insert(schema.internshipPrograms)
    .values({
      offerId: validatedOfferId,
      internName: validatedProgram.internName,
      role: validatedProgram.role,
      durationWeeks: validatedProgram.durationWeeks,
      hoursPerWeek: validatedProgram.hoursPerWeek,
      status: "active",
    })
    .returning();

  await db.insert(schema.internshipWeeks).values(
    validatedProgram.weeks.map((w) => ({
      programId: programRow.id,
      weekNumber: w.week,
      title: w.title,
      objectives: w.objectives,
    })),
  );

  // The creator becomes the program's first (primary) supervisor — never
  // leave a brand-new program with literally nobody able to act on it,
  // and never require HR to pretend to be the supervisor separately
  // (Phase 6A §8). Reassigning/adding co-supervisors afterward is a
  // normal supervisor action, not special-cased here.
  if (membership) {
    await db.insert(schema.programSupervisorAssignments).values({ programId: programRow.id, companyMemberId: membership.id, isPrimary: true, assignedByUserId: userId });
  }

  await db.insert(schema.eventLog).values({
    entityType: "internship_program",
    entityId: programRow.id,
    eventType: "internship_program_created",
    actorUserId: userId,
  });

  return programRow.id as string;
}

const CopyAssistTaskSchema = z.enum(["draft_description", "improve_description", "suggest_requirements", "suggest_learning_outcomes"]);

/** One optional AI-assist call from the Create/Edit Internship form. Never required to save — see saveInternshipAction. */
export async function assistInternshipCopyAction(input: {
  task: z.infer<typeof CopyAssistTaskSchema>;
  role: string;
  shortDescription?: string;
  fullDescription?: string;
  requirements?: string[];
}) {
  await requireCurrentCompanyMember("hiring_access");
  const validated = {
    task: CopyAssistTaskSchema.parse(input.task),
    role: z.string().trim().min(1).max(120).parse(input.role || "this internship"),
    shortDescription: input.shortDescription ? z.string().trim().max(500).parse(input.shortDescription) : undefined,
    fullDescription: input.fullDescription ? z.string().trim().max(6000).parse(input.fullDescription) : undefined,
    requirements: input.requirements?.length ? z.array(z.string().trim().max(200)).max(20).parse(input.requirements) : undefined,
  };
  return InternshipCopyAssistSchema.parse(await aiProvider.assistInternshipCopy(validated));
}

// The old single-shot "Ask internIn" action (askHiringAssistantAction) was
// removed when the assistant moved to a streaming UI-message backend — see
// src/app/api/assistant/route.ts, which calls buildInternshipFacts/
// buildCompanyHiringFacts directly instead of going through a Server Action.

const ChallengeCredentialPolicySchema = z.object({
  opportunityId: IdSchema,
  credentialPolicy: z.enum(["off", "internin_verified", "company_endorsed"]),
  requireHumanConfirmation: z.boolean(),
  showCompanyLogo: z.boolean(),
});

/**
 * The definitive per-challenge credential policy (Phase 4C §2). Company-
 * wide defaults (companies.default_credential_policy) only ever apply at
 * challenge CREATION time (see saveChallengeVersionAction above) — this
 * action is the only way an existing challenge's own policy changes, and
 * changing the company default afterward never touches it.
 */
export async function updateChallengeCredentialPolicyAction(input: {
  opportunityId: string;
  credentialPolicy: "off" | "internin_verified" | "company_endorsed";
  requireHumanConfirmation: boolean;
  showCompanyLogo: boolean;
}) {
  const parsed = ChallengeCredentialPolicySchema.parse(input);
  const { companyId, userId } = await getCompanyIdForCurrentUser();
  await assertOwnsOpportunity(parsed.opportunityId, companyId);
  const db = getDb();

  const [challengeRow] = await db.select({ id: schema.challenges.id }).from(schema.challenges).where(eq(schema.challenges.opportunityId, parsed.opportunityId)).limit(1);
  if (!challengeRow) throw new Error("No challenge exists for this opportunity yet.");

  await db
    .update(schema.challenges)
    .set({
      credentialPolicy: parsed.credentialPolicy,
      requireHumanConfirmation: parsed.requireHumanConfirmation,
      // A logo only ever makes sense alongside real endorsement — never let
      // a stray true value visually imply endorsement on a plain
      // internin_verified (or off) credential (Phase 4C §4).
      showCompanyLogo: parsed.credentialPolicy === "company_endorsed" ? parsed.showCompanyLogo : false,
      updatedAt: new Date(),
    })
    .where(eq(schema.challenges.id, challengeRow.id));

  await db.insert(schema.eventLog).values({
    entityType: "challenge",
    entityId: challengeRow.id,
    eventType: "credential_policy_updated",
    actorUserId: userId,
    metadata: { credentialPolicy: parsed.credentialPolicy, requireHumanConfirmation: parsed.requireHumanConfirmation },
  });

  revalidatePath(`/company/opportunities/${parsed.opportunityId}`);
  return { success: true as const };
}
