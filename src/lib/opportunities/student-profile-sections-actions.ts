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
