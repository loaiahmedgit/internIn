"use server";

import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { canManagePublication, type WorkspacePermission } from "@/lib/company/permissions";
import { inngest } from "@/lib/inngest/client";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  ChallengeSchema,
  InternshipDraftSchema,
  InternshipProgramSchema,
  InternshipCopyAssistSchema,
  InternshipAssistantAnswerSchema,
  aiProvider,
  type InternshipDraft,
  type InternshipProgram,
  type Challenge,
} from "@/lib/ai";
import { buildInternshipFacts } from "@/lib/company/internship-facts";

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

export async function createOpportunityAction(internship: InternshipDraft) {
  const validated = InternshipDraftSchema.parse(internship);
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
    [challengeRow] = await db
      .insert(schema.challenges)
      .values({ opportunityId: validatedOpportunityId, status: validatedChallenge.status })
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
      skills: validatedChallenge.skills,
      tasks: validatedChallenge.tasks,
      deliverables: validatedChallenge.deliverables,
      files: validatedChallenge.files,
      rubric: validatedChallenge.rubric,
      createdByUserId: userId,
    })
    .returning();

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

  return { challengeId: challengeRow.id as string, versionId: version.id as string };
}

export async function publishOpportunityAction(opportunityId: string) {
  const validatedOpportunityId = IdSchema.parse(opportunityId);
  const { companyId, userId, canPublish } = await getCompanyIdForCurrentUser();
  if (!canPublish) throw new Error("Ask a Workspace Admin to grant Hiring Access before publishing.");
  await assertCompanyVerified(companyId);
  await assertOwnsOpportunity(validatedOpportunityId, companyId);
  const db = getDb();

  // A challenge is optional, not a publish gate — an internship can go live
  // with no challenge and have one added later from its Challenge tab. If
  // one exists, though, it must actually be approved first; publishing a
  // still-ai_generated challenge would put unreviewed AI content in front
  // of real applicants.
  const [challengeRow] = await db
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.opportunityId, validatedOpportunityId))
    .limit(1);
  if (challengeRow && challengeRow.status !== "approved") {
    throw new Error("Approve the current challenge version before publishing.");
  }

  if (challengeRow) {
    await db
      .update(schema.challenges)
      .set({ status: "published", updatedAt: new Date() })
      .where(eq(schema.challenges.id, challengeRow.id));
  }
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
export const InternshipFormSchema = z.object({
  role: z.string().trim().min(2).max(120),
  department: z.string().trim().max(120).nullable().optional(),
  shortDescription: z.string().trim().max(500).nullable().optional(),
  description: z.string().trim().min(1).max(6000),
  whatYouWillLearn: z.string().trim().max(3000).nullable().optional(),
  requirements: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  niceToHave: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  duration: z.string().trim().min(1).max(80),
  hoursPerWeek: z.number().int().min(1).max(60),
  location: z.string().trim().min(1).max(120),
  workMode: z.enum(["remote", "onsite", "hybrid"]).nullable().optional(),
  applicationDeadline: z.coerce.date().nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  slots: z.number().int().min(1).max(100),
  skills: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  requireCv: z.boolean().default(true),
  applicationQuestions: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
});
export type InternshipFormInput = z.infer<typeof InternshipFormSchema>;

/**
 * The manual-first Create/Edit Internship form's single save path — Save
 * draft and Publish both call this, `publish` just decides the resulting
 * status. Creates a new posting when `opportunityId` is omitted, otherwise
 * updates the caller's own existing one. A challenge is never required
 * here; that's a separate, optional step from the internship's Challenge
 * tab.
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
  };

  if (input.opportunityId) {
    const validatedId = IdSchema.parse(input.opportunityId);
    const existing = await assertOwnsOpportunity(validatedId, companyId);
    const nowPublishing = input.publish && existing.status !== "published";
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

  const [opportunity] = await db
    .insert(schema.opportunities)
    .values({ ...values, companyId, createdByUserId: userId, status: input.publish ? "published" : "draft" })
    .returning();
  await db.insert(schema.eventLog).values({
    entityType: "opportunity",
    entityId: opportunity.id,
    eventType: input.publish ? "opportunity_published" : "opportunity_created",
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

export async function shortlistApplicationAction(applicationId: string) {
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

  await inngest.send({
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
  const [existingProgram] = await db
    .select({ id: schema.internshipPrograms.id })
    .from(schema.internshipPrograms)
    .where(eq(schema.internshipPrograms.offerId, validatedOfferId))
    .limit(1);
  if (existingProgram) throw new Error("A program already exists for this offer.");

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

/**
 * The contextual "Ask internIn" panel's one real capability: answer a
 * question about THIS internship, grounded entirely in buildInternshipFacts
 * — the model never sees anything else about the company or its data.
 */
export async function askInternshipAssistantAction(opportunityId: string, question: string) {
  const validatedId = IdSchema.parse(opportunityId);
  const validatedQuestion = z.string().trim().min(1).max(500).parse(question);
  const { companyId } = await getCompanyIdForCurrentUser("hiring_reviewer");
  const facts = await buildInternshipFacts(validatedId, companyId);
  const result = await aiProvider.answerInternshipQuestion({ question: validatedQuestion, facts });
  return InternshipAssistantAnswerSchema.parse(result).answer;
}
