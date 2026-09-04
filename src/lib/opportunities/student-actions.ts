"use server";

import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { inngest } from "@/lib/inngest/client";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { classifyApplicationSource } from "@/lib/opportunities/application-source";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUBMISSION_ARTIFACT_KINDS, SUBMISSION_INPUT_MODES } from "@/lib/challenges/submission-model";

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

export async function applyToOpportunityAction(opportunityId: string, referrer?: string) {
  const { user } = await requireCurrentStudent();
  const db = getDb();

  const [row] = await db
    .select({ opportunity: schema.opportunities, companyWebsite: schema.companies.website })
    .from(schema.opportunities)
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(eq(schema.opportunities.id, opportunityId))
    .limit(1);
  if (!row || row.opportunity.status !== "published") {
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

  const source = classifyApplicationSource({
    referrer,
    siteHost: "internin.app",
    companyWebsite: row.companyWebsite,
  });

  const [application] = await db
    .insert(schema.applications)
    .values({ opportunityId, studentId: user.id, status: "applied", source })
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

/**
 * Marks the moment the student actually chose to start the work — this is
 * what separates "to do" from "in progress" on /student/challenges. Never
 * called implicitly on page view.
 */
export async function startChallengeAction(applicationId: string) {
  const { user } = await requireCurrentStudent();
  const db = getDb();
  const application = await assertOwnsApplication(applicationId, user.id);

  if (!application.challengeStartedAt) {
    await db
      .update(schema.applications)
      .set({ challengeStartedAt: new Date() })
      .where(eq(schema.applications.id, applicationId));
  }
}

const SubmissionArtifactInputSchema = z
  .object({
    requirementId: z.string().trim().min(1).max(100).optional(),
    inputMode: z.enum(SUBMISSION_INPUT_MODES),
    artifactKind: z.enum(SUBMISSION_ARTIFACT_KINDS),
    label: z.string().trim().max(160).optional(),
    // file / multiple_files — a real object already uploaded to this application's own storage prefix.
    storagePath: z.string().trim().min(1).max(500).optional(),
    originalFilename: z.string().trim().max(255).optional(),
    // url
    externalUrl: z.string().trim().url().max(2000).optional(),
    // text
    textContent: z.string().trim().max(20_000).optional(),
  })
  .strict();
type SubmissionArtifactInput = z.infer<typeof SubmissionArtifactInputSchema>;

const SubmitChallengeInputSchema = z.object({
  applicationId: z.string().uuid(),
  artifacts: z.array(SubmissionArtifactInputSchema).max(30),
  notes: z.string().trim().max(5000).optional(),
});

/** A non-empty string is never proof a file requirement is satisfied — this
 * confirms the object actually exists in the student's own storage prefix,
 * has a real non-zero size, and matches the requirement's accepted
 * formats/size limit, using Storage's own listing (not the client's claim). */
async function verifySubmittedFileArtifact(params: {
  applicationId: string;
  storagePath: string;
  acceptedFormats?: string[];
  maxFileSizeBytes?: number;
  storageIndex: Map<string, { size: number; mimetype: string | null }>;
}): Promise<{ size: number; mimetype: string | null }> {
  const { applicationId, storagePath, acceptedFormats, maxFileSizeBytes, storageIndex } = params;
  if (!storagePath.startsWith(`${applicationId}/`) || storagePath.includes("..")) {
    throw new Error("This file doesn't belong to your submission.");
  }
  const stat = storageIndex.get(storagePath);
  if (!stat) throw new Error("This file couldn't be found — it may not have finished uploading. Try re-uploading it.");
  if (stat.size <= 0) throw new Error("This file is empty.");
  if (maxFileSizeBytes && stat.size > maxFileSizeBytes) {
    throw new Error(`This file is larger than the ${Math.round(maxFileSizeBytes / (1024 * 1024))} MB limit.`);
  }
  if (acceptedFormats && acceptedFormats.length > 0) {
    const extension = (storagePath.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? "").toLowerCase();
    if (!acceptedFormats.some((format) => format.toLowerCase() === extension)) {
      throw new Error(`This file type isn't accepted here — expected ${acceptedFormats.join(", ")}.`);
    }
  }
  return stat;
}

/** Same principle for URL requirements — parsed and validated server-side,
 * never trusted as a bare non-empty string. A provider-restricted
 * requirement (a code repository, a Figma link) rejects any other host. */
function verifySubmittedUrlArtifact(url: string, providers?: string[]) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (parsed.protocol !== "https:") throw new Error("Links must use https://.");
  if (providers && providers.length > 0) {
    const host = parsed.hostname.toLowerCase();
    const allowed = providers.some((provider) => host === provider.toLowerCase() || host.endsWith(`.${provider.toLowerCase()}`));
    if (!allowed) throw new Error(`This link must be from: ${providers.join(", ")}.`);
  }
}

/**
 * Rewritten from the ground up: a student can no longer submit with an
 * empty/missing required deliverable, a fake storage path, a file of the
 * wrong type/size, or a URL from a disallowed provider. Every required
 * submissionRequirement on the challenge's current version is checked
 * against real, verified artifacts before anything is written.
 */
export async function submitChallengeAction(input: z.infer<typeof SubmitChallengeInputSchema>) {
  const validated = SubmitChallengeInputSchema.parse(input);
  const { user } = await requireCurrentStudent();
  const db = getDb();
  const application = await assertOwnsApplication(validated.applicationId, user.id);

  if (!application.challengeStartedAt) {
    throw new Error("Start the challenge before submitting.");
  }

  const [existingSubmission] = await db
    .select({ id: schema.submissions.id })
    .from(schema.submissions)
    .where(eq(schema.submissions.applicationId, application.id))
    .limit(1);
  if (existingSubmission) throw new Error("You've already submitted this challenge.");

  const [challengeRow] = await db
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.opportunityId, application.opportunityId))
    .limit(1);
  if (!challengeRow || challengeRow.status !== "published" || !challengeRow.currentVersionId) {
    throw new Error("This challenge isn't published yet.");
  }
  const [version] = await db
    .select()
    .from(schema.challengeVersions)
    .where(eq(schema.challengeVersions.id, challengeRow.currentVersionId))
    .limit(1);
  if (!version) throw new Error("This challenge's current version could not be found.");

  // One real listing of everything this application has actually uploaded —
  // every file-artifact check below is verified against THIS, not the
  // client's claimed path/size.
  const admin = createAdminClient();
  const { data: listing } = await admin.storage.from("submission-artifacts").list(application.id, { limit: 100 });
  const storageIndex = new Map(
    (listing ?? []).map((item) => [
      `${application.id}/${item.name}`,
      { size: Number(item.metadata?.size ?? 0), mimetype: (item.metadata?.mimetype as string | undefined) ?? null },
    ]),
  );

  const artifactsByRequirement = new Map<string, SubmissionArtifactInput[]>();
  for (const artifact of validated.artifacts) {
    const key = artifact.requirementId ?? "";
    artifactsByRequirement.set(key, [...(artifactsByRequirement.get(key) ?? []), artifact]);
  }

  const verifiedRows: (typeof schema.submissionArtifacts.$inferInsert)[] = [];

  for (const requirement of version.submissionRequirements) {
    const candidates = artifactsByRequirement.get(requirement.id) ?? [];
    let validCount = 0;

    for (const artifact of candidates) {
      try {
        if (requirement.inputMode === "file" || requirement.inputMode === "multiple_files") {
          if (!artifact.storagePath) continue;
          const stat = await verifySubmittedFileArtifact({
            applicationId: application.id,
            storagePath: artifact.storagePath,
            acceptedFormats: requirement.acceptedFormats,
            maxFileSizeBytes: requirement.maxFileSizeBytes,
            storageIndex,
          });
          verifiedRows.push({
            submissionId: "", // filled in once the submission row exists, below
            requirementId: requirement.id,
            inputMode: requirement.inputMode,
            artifactKind: requirement.artifactKind,
            label: artifact.label || requirement.label,
            originalFilename: artifact.originalFilename ?? null,
            mimeType: stat.mimetype,
            sizeBytes: stat.size,
            storagePath: artifact.storagePath,
          });
          validCount++;
        } else if (requirement.inputMode === "url") {
          if (!artifact.externalUrl) continue;
          verifySubmittedUrlArtifact(artifact.externalUrl, requirement.providers);
          verifiedRows.push({
            submissionId: "",
            requirementId: requirement.id,
            inputMode: "url",
            artifactKind: requirement.artifactKind,
            label: artifact.label || requirement.label,
            externalUrl: artifact.externalUrl,
          });
          validCount++;
        } else if (requirement.inputMode === "text") {
          const text = artifact.textContent?.trim();
          if (!text) continue;
          verifiedRows.push({
            submissionId: "",
            requirementId: requirement.id,
            inputMode: "text",
            artifactKind: requirement.artifactKind,
            label: artifact.label || requirement.label,
            textContent: text,
          });
          validCount++;
        }
      } catch (error) {
        // A required requirement's bad artifact is a real submit-time
        // failure the student must see and fix. An optional one just
        // doesn't count — it's not fatal to the whole submission.
        if (requirement.required) throw error;
      }
    }

    if (requirement.required) {
      const minCount = requirement.inputMode === "multiple_files" ? (requirement.minFiles ?? 1) : 1;
      if (validCount < minCount) {
        throw new Error(`Missing required submission: "${requirement.label}".`);
      }
    }
    if (requirement.inputMode === "multiple_files" && requirement.maxFiles && validCount > requirement.maxFiles) {
      throw new Error(`"${requirement.label}" allows at most ${requirement.maxFiles} files.`);
    }
  }

  const [submission] = await db
    .insert(schema.submissions)
    .values({
      applicationId: application.id,
      challengeVersionId: challengeRow.currentVersionId,
      notes: validated.notes ?? "",
      status: "submitted",
    })
    .returning();

  if (verifiedRows.length > 0) {
    await db.insert(schema.submissionArtifacts).values(verifiedRows.map((row) => ({ ...row, submissionId: submission.id })));
  }

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
