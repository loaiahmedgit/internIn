"use server";

import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { inngest } from "@/lib/inngest/client";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

async function getCompanyContext(opportunityId: string) {
  const db = getDb();
  const [opportunity] = await db
    .select({ role: schema.opportunities.role, companyId: schema.opportunities.companyId })
    .from(schema.opportunities)
    .where(eq(schema.opportunities.id, opportunityId))
    .limit(1);
  const members = await db
    .select({ email: schema.users.email })
    .from(schema.companyMembers)
    .innerJoin(schema.users, eq(schema.companyMembers.userId, schema.users.id))
    .where(eq(schema.companyMembers.companyId, opportunity.companyId));
  return { role: opportunity.role, companyEmails: members.map((m) => m.email) };
}

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

const OpportunityIdSchema = z.string().uuid();

/**
 * Toggles a bookmark on an opportunity for the current student. Returns the
 * resulting saved state so the client can reconcile its optimistic update.
 */
export async function toggleSaveOpportunityAction(opportunityId: string): Promise<boolean> {
  const { user } = await requireCurrentStudent();
  const validatedOpportunityId = OpportunityIdSchema.parse(opportunityId);
  const db = getDb();

  const [existing] = await db
    .select({ id: schema.savedOpportunities.id })
    .from(schema.savedOpportunities)
    .where(
      and(
        eq(schema.savedOpportunities.studentId, user.id),
        eq(schema.savedOpportunities.opportunityId, validatedOpportunityId),
      ),
    )
    .limit(1);

  if (existing) {
    await db.delete(schema.savedOpportunities).where(eq(schema.savedOpportunities.id, existing.id));
    return false;
  }

  await db.insert(schema.savedOpportunities).values({ studentId: user.id, opportunityId: validatedOpportunityId });
  return true;
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

const FileNameSchema = z.string().trim().min(1).max(200);

/**
 * Returns a short-lived signed upload URL scoped to this student's own
 * application, plus the public URL the file will be reachable at once
 * uploaded (used as the submission's artifact link — same field a pasted
 * URL would populate). Bucket is public: these are synthetic-challenge
 * submissions, not real company data, so a durable public link is a
 * reasonable tradeoff against signed-read-URL expiry/regeneration.
 */
export async function getSubmissionUploadUrlAction(applicationId: string, fileName: string) {
  const { user } = await requireCurrentStudent();
  const application = await assertOwnsApplication(applicationId, user.id);
  const validatedFileName = FileNameSchema.parse(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const path = `${application.id}/${crypto.randomUUID()}-${validatedFileName}`;

  const { data, error } = await supabase.storage.from("submission-artifacts").createSignedUploadUrl(path);
  if (error) throw new Error("Couldn't prepare an upload URL.");

  const { data: publicUrlData } = supabase.storage.from("submission-artifacts").getPublicUrl(path);

  return { signedUrl: data.signedUrl, token: data.token, path, publicUrl: publicUrlData.publicUrl };
}

/**
 * CVs are real personal documents, unlike synthetic challenge submissions —
 * this bucket is private, no public URL is ever generated. Only this
 * student's own path prefix can be uploaded to or read back.
 */
export async function getCvUploadUrlAction(fileName: string) {
  const { user } = await requireCurrentStudent();
  const validatedFileName = FileNameSchema.parse(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const path = `${user.id}/${crypto.randomUUID()}-${validatedFileName}`;

  const { data, error } = await supabase.storage.from("student-cvs").createSignedUploadUrl(path);
  if (error) throw new Error("Couldn't prepare an upload URL.");

  return { signedUrl: data.signedUrl, token: data.token, path };
}

/**
 * Downloads the uploaded CV, extracts its text, and asks the AI provider
 * for skills/interests it can find — returns them for the student to
 * review, never writes them to the profile itself. That happens only when
 * the student explicitly saves via updateStudentProfileAction.
 */
export async function extractCvAction(path: string) {
  const { user } = await requireCurrentStudent();
  const validatedPath = z.string().min(1).max(500).parse(path);
  if (!validatedPath.startsWith(`${user.id}/`)) {
    throw new Error("Not authorized for this file.");
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { data: fileBlob, error } = await supabase.storage.from("student-cvs").download(validatedPath);
  if (error || !fileBlob) throw new Error("Couldn't read the uploaded file.");

  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const { text } = await parser.getText();
  if (!text || text.trim().length < 20) {
    throw new Error("Couldn't read any text from that PDF. Try a different file.");
  }

  const { extractResumeInfoAction } = await import("@/lib/ai/actions");
  return extractResumeInfoAction(text);
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

  const { role, companyEmails } = await getCompanyContext(application.opportunityId);
  if (companyEmails.length > 0) {
    await inngest.send({
      name: "submission/received",
      data: { companyEmails, studentName: user.fullName, role, submissionId: submission.id },
    });
  }

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

  const { role, companyEmails } = await getCompanyContext(application.opportunityId);
  if (companyEmails.length > 0) {
    await inngest.send({
      name: "internship_offer/responded",
      data: {
        companyEmails,
        studentName: user.fullName,
        role,
        decision,
        opportunityId: application.opportunityId,
      },
    });
  }
}

const StudentProfileInputSchema = z.object({
  educationStage: z.enum(["high_school", "university", "graduate", "vocational", "other"]).optional(),
  university: z.string().trim().max(200).optional(),
  major: z.string().trim().max(200).optional(),
  graduationYear: z.number().int().min(1950).max(2100).optional(),
  location: z.string().trim().max(200).optional(),
  interests: z.array(z.string().trim().min(1).max(60)).max(30),
  opportunityTypes: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  skills: z.array(z.string().trim().min(1).max(60)).max(30),
  availability: z.string().trim().max(200).optional(),
  cvUrl: z.string().trim().url().max(2000).optional().or(z.literal("")),
  cvFileKey: z.string().max(500).optional(),
});

export async function updateStudentProfileAction(input: z.infer<typeof StudentProfileInputSchema>) {
  const { user } = await requireCurrentStudent();
  const validated = StudentProfileInputSchema.parse(input);
  const db = getDb();

  await db
    .update(schema.studentProfiles)
    .set({
      educationStage: validated.educationStage ?? null,
      university: validated.university || null,
      major: validated.major || null,
      graduationYear: validated.graduationYear ?? null,
      location: validated.location || null,
      interests: validated.interests,
      opportunityTypes: validated.opportunityTypes ?? [],
      skills: validated.skills,
      availability: validated.availability || null,
      cvUrl: validated.cvUrl || null,
      cvFileKey: validated.cvFileKey || null,
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
