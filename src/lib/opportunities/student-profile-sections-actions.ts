"use server";

import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * CRUD for the profile's list-type sections (experience, education,
 * portfolio, certifications, contact links) — see src/db/schema.ts's
 * comment above these five tables for the shared shape/RLS rationale.
 * Every write re-derives ownership itself (never trusts a client-supplied
 * studentId), matching student-actions.ts's own stated convention — RLS is
 * defense in depth, not the only check.
 */

const FileNameSchema = z.string().trim().min(1).max(200);

// --- Experience --------------------------------------------------------------

const ExperienceInputSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(200),
  organization: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).optional(),
  startDate: z.string().trim().max(20).optional(),
  endDate: z.string().trim().max(20).optional(),
  isCurrent: z.boolean().optional(),
  description: z.string().trim().max(2000).optional(),
});

export async function upsertExperienceAction(input: z.infer<typeof ExperienceInputSchema>) {
  const { user } = await requireCurrentStudent();
  const v = ExperienceInputSchema.parse(input);
  const db = getDb();

  const values = {
    type: v.type,
    title: v.title,
    organization: v.organization,
    location: v.location || null,
    startDate: v.startDate || null,
    endDate: v.isCurrent ? null : v.endDate || null,
    isCurrent: v.isCurrent ?? false,
    description: v.description || null,
    updatedAt: new Date(),
  };

  if (v.id) {
    await db.update(schema.studentExperience).set(values).where(and(eq(schema.studentExperience.id, v.id), eq(schema.studentExperience.studentId, user.id)));
  } else {
    await db.insert(schema.studentExperience).values({ studentId: user.id, ...values });
  }
}

export async function deleteExperienceAction(id: string) {
  const { user } = await requireCurrentStudent();
  const db = getDb();
  await db.delete(schema.studentExperience).where(and(eq(schema.studentExperience.id, id), eq(schema.studentExperience.studentId, user.id)));
}

// --- Education (multi-entry) --------------------------------------------------

const EducationInputSchema = z.object({
  id: z.string().uuid().optional(),
  level: z.enum(["high_school", "university", "graduate", "vocational", "other"]).optional(),
  institution: z.string().trim().min(1).max(200),
  fieldOfStudy: z.string().trim().max(200).optional(),
  graduationYear: z.number().int().min(1950).max(2100).optional(),
  location: z.string().trim().max(200).optional(),
});

export async function upsertEducationAction(input: z.infer<typeof EducationInputSchema>) {
  const { user } = await requireCurrentStudent();
  const v = EducationInputSchema.parse(input);
  const db = getDb();

  const values = {
    level: v.level ?? null,
    institution: v.institution,
    fieldOfStudy: v.fieldOfStudy || null,
    graduationYear: v.graduationYear ?? null,
    location: v.location || null,
    updatedAt: new Date(),
  };

  if (v.id) {
    await db.update(schema.studentEducation).set(values).where(and(eq(schema.studentEducation.id, v.id), eq(schema.studentEducation.studentId, user.id)));
  } else {
    await db.insert(schema.studentEducation).values({ studentId: user.id, ...values });
  }

  // Keep student_profiles' legacy flat education fields (used by the
  // header/rail identity text and onboarding routing) in sync with this
  // entry, so there's no separate "edit education" form living in the Edit
  // Profile sheet — this multi-entry section is now the one place that
  // edits education at all.
  await db
    .update(schema.studentProfiles)
    .set({
      educationStage: v.level ?? null,
      university: v.institution,
      major: v.fieldOfStudy || null,
      graduationYear: v.graduationYear ?? null,
      updatedAt: new Date(),
    })
    .where(eq(schema.studentProfiles.userId, user.id));
}

export async function deleteEducationAction(id: string) {
  const { user } = await requireCurrentStudent();
  const db = getDb();
  await db.delete(schema.studentEducation).where(and(eq(schema.studentEducation.id, id), eq(schema.studentEducation.studentId, user.id)));
}

// --- Portfolio -----------------------------------------------------------------

const PortfolioInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  itemType: z.string().trim().max(60).optional(),
  description: z.string().trim().max(2000).optional(),
  thumbnailUrl: z.string().trim().url().max(2000).optional().or(z.literal("")),
  externalUrl: z.string().trim().url().max(2000).optional().or(z.literal("")),
  repositoryUrl: z.string().trim().url().max(2000).optional().or(z.literal("")),
  attachmentUrl: z.string().trim().url().max(2000).optional().or(z.literal("")),
  skills: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  dateLabel: z.string().trim().max(40).optional(),
});

export async function upsertPortfolioItemAction(input: z.infer<typeof PortfolioInputSchema>) {
  const { user } = await requireCurrentStudent();
  const v = PortfolioInputSchema.parse(input);
  const db = getDb();

  const values = {
    title: v.title,
    itemType: v.itemType || null,
    description: v.description || null,
    thumbnailUrl: v.thumbnailUrl || null,
    externalUrl: v.externalUrl || null,
    repositoryUrl: v.repositoryUrl || null,
    attachmentUrl: v.attachmentUrl || null,
    skills: v.skills ?? [],
    dateLabel: v.dateLabel || null,
    updatedAt: new Date(),
  };

  if (v.id) {
    await db.update(schema.studentPortfolioItems).set(values).where(and(eq(schema.studentPortfolioItems.id, v.id), eq(schema.studentPortfolioItems.studentId, user.id)));
  } else {
    await db.insert(schema.studentPortfolioItems).values({ studentId: user.id, ...values });
  }
}

export async function deletePortfolioItemAction(id: string) {
  const { user } = await requireCurrentStudent();
  const db = getDb();
  await db.delete(schema.studentPortfolioItems).where(and(eq(schema.studentPortfolioItems.id, id), eq(schema.studentPortfolioItems.studentId, user.id)));
}

/** Signed upload URL + the (public, since this bucket is public) resulting
 * URL for a portfolio thumbnail — same pattern as getCvUploadUrlAction. */
export async function getPortfolioThumbnailUploadUrlAction(fileName: string) {
  const { user } = await requireCurrentStudent();
  const validatedFileName = FileNameSchema.parse(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");

  const supabase = createAdminClient();
  const path = `${user.id}/${crypto.randomUUID()}-${validatedFileName}`;

  const { data, error } = await supabase.storage.from("student-portfolio").createSignedUploadUrl(path);
  if (error) throw new Error("Couldn't prepare an upload URL.");
  const { data: publicUrlData } = supabase.storage.from("student-portfolio").getPublicUrl(path);

  return { signedUrl: data.signedUrl, token: data.token, path, publicUrl: publicUrlData.publicUrl };
}

/** Signed upload URL for a portfolio item's optional attachment (a research
 * PDF, a writing sample) — same public bucket/pattern as the thumbnail, just
 * a different path prefix and (via the bucket's own allow-list) also PDF. */
export async function getPortfolioAttachmentUploadUrlAction(fileName: string) {
  const { user } = await requireCurrentStudent();
  const validatedFileName = FileNameSchema.parse(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");

  const supabase = createAdminClient();
  const path = `${user.id}/attachment-${crypto.randomUUID()}-${validatedFileName}`;

  const { data, error } = await supabase.storage.from("student-portfolio").createSignedUploadUrl(path);
  if (error) throw new Error("Couldn't prepare an upload URL.");
  const { data: publicUrlData } = supabase.storage.from("student-portfolio").getPublicUrl(path);

  return { signedUrl: data.signedUrl, token: data.token, path, publicUrl: publicUrlData.publicUrl };
}

// --- Certifications --------------------------------------------------------------

const CertificationInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  issuer: z.string().trim().min(1).max(200),
  issueDate: z.string().trim().max(20).optional(),
  expiryDate: z.string().trim().max(20).optional(),
  credentialUrl: z.string().trim().url().max(2000).optional().or(z.literal("")),
  credentialId: z.string().trim().max(200).optional(),
});

export async function upsertCertificationAction(input: z.infer<typeof CertificationInputSchema>) {
  const { user } = await requireCurrentStudent();
  const v = CertificationInputSchema.parse(input);
  const db = getDb();

  const values = {
    name: v.name,
    issuer: v.issuer,
    issueDate: v.issueDate || null,
    expiryDate: v.expiryDate || null,
    credentialUrl: v.credentialUrl || null,
    credentialId: v.credentialId || null,
    updatedAt: new Date(),
  };

  if (v.id) {
    await db.update(schema.studentCertifications).set(values).where(and(eq(schema.studentCertifications.id, v.id), eq(schema.studentCertifications.studentId, user.id)));
  } else {
    await db.insert(schema.studentCertifications).values({ studentId: user.id, ...values });
  }
}

export async function deleteCertificationAction(id: string) {
  const { user } = await requireCurrentStudent();
  const db = getDb();
  await db.delete(schema.studentCertifications).where(and(eq(schema.studentCertifications.id, id), eq(schema.studentCertifications.studentId, user.id)));
}

// --- Contact & links -----------------------------------------------------------

const LinkInputSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(60),
  // Not strictly z.string().url() — this field also holds a phone number
  // or email address (see "Email"/"Phone" as valid link labels), not just
  // http(s) URLs.
  url: z.string().trim().min(1).max(2000),
});

export async function upsertProfileLinkAction(input: z.infer<typeof LinkInputSchema>) {
  const { user } = await requireCurrentStudent();
  const v = LinkInputSchema.parse(input);
  const db = getDb();

  const values = { label: v.label, url: v.url, updatedAt: new Date() };

  if (v.id) {
    await db.update(schema.studentProfileLinks).set(values).where(and(eq(schema.studentProfileLinks.id, v.id), eq(schema.studentProfileLinks.studentId, user.id)));
  } else {
    await db.insert(schema.studentProfileLinks).values({ studentId: user.id, ...values });
  }
}

export async function deleteProfileLinkAction(id: string) {
  const { user } = await requireCurrentStudent();
  const db = getDb();
  await db.delete(schema.studentProfileLinks).where(and(eq(schema.studentProfileLinks.id, id), eq(schema.studentProfileLinks.studentId, user.id)));
}

// --- Profile identity (photo, banner, about/location/availability, skills,
// preferences) — small, focused, PARTIAL updates. student_profiles is a
// single row per student, so unlike the list tables above these actions
// only .set() the columns their own section owns, never the whole row —
// that's what let the old single giant form clobber unrelated fields on
// every save, and is exactly the architecture problem being fixed here. ---

/** Avatar/banner upload URL — same public bucket/pattern as the portfolio
 * thumbnail, just a different path prefix. */
export async function getProfileMediaUploadUrlAction(fileName: string, kind: "avatar" | "banner") {
  const { user } = await requireCurrentStudent();
  const validatedFileName = FileNameSchema.parse(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
  const validatedKind = z.enum(["avatar", "banner"]).parse(kind);

  const supabase = createAdminClient();
  const path = `${user.id}/${validatedKind}-${crypto.randomUUID()}-${validatedFileName}`;

  const { data, error } = await supabase.storage.from("student-portfolio").createSignedUploadUrl(path);
  if (error) throw new Error("Couldn't prepare an upload URL.");
  const { data: publicUrlData } = supabase.storage.from("student-portfolio").getPublicUrl(path);

  return { signedUrl: data.signedUrl, token: data.token, path, publicUrl: publicUrlData.publicUrl };
}

const MediaInputSchema = z.object({
  avatarUrl: z.string().trim().url().max(2000).nullable().optional(),
  bannerUrl: z.string().trim().url().max(2000).nullable().optional(),
});

/** Sets whichever of avatar/banner is provided; omitting a field leaves it
 * untouched, passing null clears it (remove photo/remove banner). */
export async function updateStudentMediaAction(input: z.infer<typeof MediaInputSchema>) {
  const { user } = await requireCurrentStudent();
  const v = MediaInputSchema.parse(input);
  const db = getDb();

  const values: Record<string, unknown> = { updatedAt: new Date() };
  if ("avatarUrl" in v) values.avatarUrl = v.avatarUrl ?? null;
  if ("bannerUrl" in v) values.bannerUrl = v.bannerUrl ?? null;

  await db.update(schema.studentProfiles).set(values).where(eq(schema.studentProfiles.userId, user.id));
}

const IdentityInputSchema = z.object({
  bio: z.string().trim().max(600).optional(),
  location: z.string().trim().max(200).optional(),
  availability: z.string().trim().max(200).optional(),
});

/** About/location/availability — the Edit Profile sheet's actual scope. */
export async function updateStudentIdentityAction(input: z.infer<typeof IdentityInputSchema>) {
  const { user } = await requireCurrentStudent();
  const v = IdentityInputSchema.parse(input);
  const db = getDb();

  await db
    .update(schema.studentProfiles)
    .set({
      bio: v.bio || null,
      location: v.location || null,
      availability: v.availability || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.studentProfiles.userId, user.id));
}

const SkillsInputSchema = z.array(z.string().trim().min(1).max(60)).max(30);

export async function updateStudentSkillsAction(skills: z.infer<typeof SkillsInputSchema>) {
  const { user } = await requireCurrentStudent();
  const v = SkillsInputSchema.parse(skills);
  const db = getDb();
  await db.update(schema.studentProfiles).set({ skills: v, updatedAt: new Date() }).where(eq(schema.studentProfiles.userId, user.id));
}

const PreferencesInputSchema = z.object({
  interests: z.array(z.string().trim().min(1).max(60)).max(30),
  opportunityTypes: z.array(z.string().trim().min(1).max(60)).max(10),
});

export async function updateStudentPreferencesAction(input: z.infer<typeof PreferencesInputSchema>) {
  const { user } = await requireCurrentStudent();
  const v = PreferencesInputSchema.parse(input);
  const db = getDb();
  await db
    .update(schema.studentProfiles)
    .set({ interests: v.interests, opportunityTypes: v.opportunityTypes, updatedAt: new Date() })
    .where(eq(schema.studentProfiles.userId, user.id));
}

/** Sets the CV after a plain upload (no AI extraction — this is the Resume
 * rail card's own self-contained upload, kept separate from onboarding's
 * "extract skills/interests from your CV" flow so it never silently
 * mutates skills/interests the student didn't touch). */
export async function updateStudentCvFileAction(cvFileKey: string) {
  const { user } = await requireCurrentStudent();
  const v = z.string().trim().min(1).max(500).parse(cvFileKey);
  if (!v.startsWith(`${user.id}/`)) throw new Error("Not authorized for this file.");
  const db = getDb();
  await db.update(schema.studentProfiles).set({ cvFileKey: v, cvUrl: null, updatedAt: new Date() }).where(eq(schema.studentProfiles.userId, user.id));
}

/** Clears the CV — the Resume rail card's own "Remove" action. */
export async function removeStudentCvAction() {
  const { user } = await requireCurrentStudent();
  const db = getDb();
  await db.update(schema.studentProfiles).set({ cvUrl: null, cvFileKey: null, updatedAt: new Date() }).where(eq(schema.studentProfiles.userId, user.id));
}
