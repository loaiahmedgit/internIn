"use server";

import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

/**
 * Student-side counterpart to src/lib/opportunities/actions.ts. Same rule:
 * every write re-derives "is this actually the signed-in student's data"
 * itself, never trusts a client-supplied id alone.
 */

export async function applyToOpportunityAction(opportunityId: string) {
  const { user } = await requireCurrentStudent();
  const db = getDb();

  const [opportunity] = await db
    .select()
    .from(schema.opportunities)
    .where(eq(schema.opportunities.id, opportunityId))
    .limit(1);
  if (!opportunity || opportunity.status !== "published") {
    throw new Error("This opportunity isn't open for applications.");
  }

  const [existing] = await db
    .select()
    .from(schema.applications)
    .where(
      and(eq(schema.applications.opportunityId, opportunityId), eq(schema.applications.studentId, user.id)),
    )
    .limit(1);
  if (existing) return existing.id as string;

  const [application] = await db
    .insert(schema.applications)
    .values({ opportunityId, studentId: user.id, status: "applied" })
    .returning();

  await db.insert(schema.eventLog).values({
    entityType: "application",
    entityId: application.id,
    eventType: "application_created",
    actorUserId: user.id,
  });

  return application.id as string;
}

async function assertOwnsApplication(applicationId: string, studentUserId: string) {
  const db = getDb();
  const [application] = await db
    .select()
    .from(schema.applications)
    .where(eq(schema.applications.id, applicationId))
    .limit(1);
  if (!application || application.studentId !== studentUserId) {
    throw new Error("Not authorized for this application.");
  }
  return application;
}

export async function submitChallengeAction(input: {
  applicationId: string;
  notes: string;
  artifactUrl?: string;
}) {
  const { user } = await requireCurrentStudent();
  const db = getDb();
  const application = await assertOwnsApplication(input.applicationId, user.id);

  const [challengeRow] = await db
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.opportunityId, application.opportunityId))
    .limit(1);
  if (!challengeRow || challengeRow.status !== "published" || !challengeRow.currentVersionId) {
    throw new Error("This challenge isn't published yet.");
  }

  const artifacts = input.artifactUrl
    ? [{ name: "Submission link", url: input.artifactUrl }]
    : [];

  const [submission] = await db
    .insert(schema.submissions)
    .values({
      applicationId: application.id,
      challengeVersionId: challengeRow.currentVersionId,
      artifacts,
      notes: input.notes,
      status: "submitted",
    })
    .returning();

  await db.insert(schema.eventLog).values({
    entityType: "submission",
    entityId: submission.id,
    eventType: "submission_received",
    actorUserId: user.id,
  });

  return submission.id as string;
}

export async function respondToOfferAction(applicationId: string, decision: "accepted" | "declined") {
  const { user } = await requireCurrentStudent();
  const db = getDb();
  const application = await assertOwnsApplication(applicationId, user.id);

  const [offer] = await db
    .select()
    .from(schema.internshipOffers)
    .where(eq(schema.internshipOffers.applicationId, application.id))
    .limit(1);
  if (!offer) throw new Error("No internship offer to respond to.");
  if (offer.status !== "pending") throw new Error("This offer has already been responded to.");

  await db
    .update(schema.internshipOffers)
    .set({ status: decision, updatedAt: new Date() })
    .where(eq(schema.internshipOffers.id, offer.id));

  if (decision === "declined") {
    await db
      .update(schema.applications)
      .set({ status: "declined", updatedAt: new Date() })
      .where(eq(schema.applications.id, application.id));
  }

  await db.insert(schema.eventLog).values({
    entityType: "internship_offer",
    entityId: offer.id,
    eventType: decision === "accepted" ? "offer_accepted" : "offer_declined",
    actorUserId: user.id,
  });
}

const StudentProfileInputSchema = z.object({
  university: z.string().trim().max(200).optional(),
  major: z.string().trim().max(200).optional(),
  graduationYear: z.number().int().min(1950).max(2100).optional(),
  interests: z.array(z.string().trim().min(1).max(60)).max(30),
  skills: z.array(z.string().trim().min(1).max(60)).max(30),
  availability: z.string().trim().max(200).optional(),
  cvUrl: z.string().trim().url().max(2000).optional().or(z.literal("")),
});

export async function updateStudentProfileAction(input: z.infer<typeof StudentProfileInputSchema>) {
  const { user } = await requireCurrentStudent();
  const validated = StudentProfileInputSchema.parse(input);
  const db = getDb();

  await db
    .update(schema.studentProfiles)
    .set({
      university: validated.university || null,
      major: validated.major || null,
      graduationYear: validated.graduationYear ?? null,
      interests: validated.interests,
      skills: validated.skills,
      availability: validated.availability || null,
      cvUrl: validated.cvUrl || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.studentProfiles.userId, user.id));

  await db.insert(schema.eventLog).values({
    entityType: "student_profile",
    entityId: user.id,
    eventType: "profile_updated",
    actorUserId: user.id,
  });
}
