"use server";

import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { inngest } from "@/lib/inngest/client";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  ChallengeSchema,
  InternshipDraftSchema,
  InternshipProgramSchema,
  type InternshipDraft,
  type InternshipProgram,
  type Challenge,
} from "@/lib/ai";

const IdSchema = z.string().uuid();
const VersionSourceSchema = z.enum(["ai_generated", "human_edited", "approved"]);

/**
 * Resolves the signed-in user's company and throws if there isn't one —
 * every write below goes through this, so a missing/invalid session or a
 * cross-company id can never silently succeed.
 */
async function getCompanyIdForCurrentUser() {
  const { user, membership } = await requireCurrentCompanyMember();
  return { companyId: membership.companyId, userId: user.id, memberRole: membership.role };
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

  const { companyId, userId, memberRole } = await getCompanyIdForCurrentUser();
  if (validatedSource === "approved" && memberRole === "member") {
    throw new Error("Only a company owner or admin can approve a challenge.");
  }
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
  const { companyId, userId, memberRole } = await getCompanyIdForCurrentUser();
  if (memberRole === "member") throw new Error("Only a company owner or admin can publish a challenge.");
  await assertCompanyVerified(companyId);
  await assertOwnsOpportunity(validatedOpportunityId, companyId);
  const db = getDb();

  const [challengeRow] = await db
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.opportunityId, validatedOpportunityId))
    .limit(1);
  if (!challengeRow) throw new Error("No challenge to publish yet.");
  if (challengeRow.status !== "approved") {
    throw new Error("Approve the current challenge version before publishing.");
  }

  await db
    .update(schema.challenges)
    .set({ status: "published", updatedAt: new Date() })
    .where(eq(schema.challenges.id, challengeRow.id));
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
  const { companyId, memberRole } = await getCompanyIdForCurrentUser();
  if (memberRole === "member") throw new Error("Only a company owner or admin can close an internship.");
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

export async function shortlistApplicationAction(applicationId: string) {
  const validatedApplicationId = IdSchema.parse(applicationId);
  const { companyId, userId } = await getCompanyIdForCurrentUser();
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
  const { companyId, userId } = await getCompanyIdForCurrentUser();
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
  const { companyId, userId } = await getCompanyIdForCurrentUser();
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
  if (existingOffer) return existingOffer.id as string;

  const [offer] = await db
    .insert(schema.internshipOffers)
    .values({
      applicationId: validatedApplicationId,
      status: "pending",
      placementFeeStatus: "stubbed_paid",
    })
    .returning();

  await db
    .update(schema.applications)
    .set({ status: "invited", updatedAt: new Date() })
    .where(eq(schema.applications.id, validatedApplicationId));

  await db.insert(schema.eventLog).values({
    entityType: "application",
    entityId: validatedApplicationId,
    eventType: "internship_offer_created",
    actorUserId: userId,
    metadata: { placementFeeStatus: "stubbed_paid", placementFeeQar: 499 },
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
  const { companyId, userId } = await getCompanyIdForCurrentUser();
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
