"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { getCurrentUser, requireCurrentCompanyMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Download/upload authorization for the two private buckets
 * (challenge-resources, submission-artifacts). No signed URL is ever
 * persisted — one is minted here, per request, only after re-checking
 * ownership/membership server-side, mirroring the same authorization
 * shape as the equivalent table RLS policies (belt and suspenders: the
 * app's own privileged DB connection bypasses RLS, so this check is the
 * real gate).
 */

const IdSchema = z.string().uuid();
const FileNameSchema = z.string().trim().min(1).max(255);
const SIGNED_URL_TTL_SECONDS = 60;

async function currentAppUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated.");
  return user;
}

async function isCompanyMemberOf(userId: string, companyId: string): Promise<boolean> {
  const db = getDb();
  const [membership] = await db
    .select({ id: schema.companyMembers.id })
    .from(schema.companyMembers)
    .where(and(eq(schema.companyMembers.userId, userId), eq(schema.companyMembers.companyId, companyId)))
    .limit(1);
  return Boolean(membership);
}

async function loadChallengeResourceContext(resourceId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      resource: schema.challengeResources,
      opportunityId: schema.challenges.opportunityId,
      companyId: schema.opportunities.companyId,
    })
    .from(schema.challengeResources)
    .innerJoin(schema.challengeVersions, eq(schema.challengeResources.challengeVersionId, schema.challengeVersions.id))
    .innerJoin(schema.challenges, eq(schema.challengeVersions.challengeId, schema.challenges.id))
    .innerJoin(schema.opportunities, eq(schema.challenges.opportunityId, schema.opportunities.id))
    .where(eq(schema.challengeResources.id, resourceId))
    .limit(1);
  if (!row) throw new Error("Resource not found.");
  return row;
}

/** Real, downloadable challenge resource — used by the student's active
 * challenge workspace and the Explore Sheet's post-application view, and
 * by the company challenge builder. */
export async function getChallengeResourceDownloadUrlAction(resourceId: string) {
  const validatedId = IdSchema.parse(resourceId);
  const user = await currentAppUser();
  const { resource, opportunityId, companyId } = await loadChallengeResourceContext(validatedId);

  const isMember = await isCompanyMemberOf(user.id, companyId);
  if (!isMember) {
    const db = getDb();
    const [application] = await db
      .select({ id: schema.applications.id })
      .from(schema.applications)
      .where(and(eq(schema.applications.opportunityId, opportunityId), eq(schema.applications.studentId, user.id)))
      .limit(1);
    if (!application) throw new Error("Not authorized for this resource.");
  }

  if (resource.resourceType === "link") {
    if (!resource.externalUrl) throw new Error("This resource has no link yet.");
    return { url: resource.externalUrl, name: resource.name };
  }
  if (resource.generationStatus !== "ready" || !resource.storagePath) {
    throw new Error("This resource isn't available yet — check back once the employer uploads it.");
  }
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("challenge-resources").createSignedUrl(resource.storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw new Error("Couldn't generate a download link.");
  return { url: data.signedUrl, name: resource.name };
}

/** A real submitted artifact — owning student or the opportunity's company only. */
export async function getSubmissionArtifactDownloadUrlAction(artifactId: string) {
  const validatedId = IdSchema.parse(artifactId);
  const user = await currentAppUser();
  const db = getDb();
  const [row] = await db
    .select({
      artifact: schema.submissionArtifacts,
      studentId: schema.applications.studentId,
      companyId: schema.opportunities.companyId,
    })
    .from(schema.submissionArtifacts)
    .innerJoin(schema.submissions, eq(schema.submissionArtifacts.submissionId, schema.submissions.id))
    .innerJoin(schema.applications, eq(schema.submissions.applicationId, schema.applications.id))
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .where(eq(schema.submissionArtifacts.id, validatedId))
    .limit(1);
  if (!row) throw new Error("Artifact not found.");

  const isOwner = row.studentId === user.id;
  if (!isOwner && !(await isCompanyMemberOf(user.id, row.companyId))) {
    throw new Error("Not authorized for this submission artifact.");
  }

  const artifact = row.artifact;
  if (artifact.externalUrl) return { url: artifact.externalUrl, label: artifact.label };
  if (artifact.textContent !== null) return { text: artifact.textContent, label: artifact.label };
  if (!artifact.storagePath) throw new Error("This artifact has no content.");

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("submission-artifacts").createSignedUrl(artifact.storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw new Error("Couldn't generate a download link.");
  return { url: data.signedUrl, label: artifact.label };
}

/** Company-only — upload/replace a resource that failed to generate or
 * needs a real asset (image/video/etc). Returns a signed upload URL/token;
 * the browser uploads directly, then calls finalizeChallengeResourceUploadAction. */
export async function getChallengeResourceUploadUrlAction(resourceId: string, fileName: string) {
  const validatedId = IdSchema.parse(resourceId);
  const validatedFileName = FileNameSchema.parse(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
  const { membership } = await requireCurrentCompanyMember();
  const { resource, companyId } = await loadChallengeResourceContext(validatedId);
  if (membership.companyId !== companyId) throw new Error("Not authorized for this resource.");

  const admin = createAdminClient();
  const path = `${resource.challengeVersionId}/${crypto.randomUUID()}-${validatedFileName}`;
  const { data, error } = await admin.storage.from("challenge-resources").createSignedUploadUrl(path);
  if (error || !data) throw new Error("Couldn't create an upload URL.");
  return { signedUrl: data.signedUrl, token: data.token, path };
}

/** Persists the result of a completed upload — the actual bytes were
 * already verified by Storage itself (the signed upload URL only accepts a
 * real PUT to that exact path); this just records what's really there. */
export async function finalizeChallengeResourceUploadAction(input: { resourceId: string; path: string; mimeType: string; sizeBytes: number }) {
  const validatedId = IdSchema.parse(input.resourceId);
  const { membership } = await requireCurrentCompanyMember();
  const { companyId } = await loadChallengeResourceContext(validatedId);
  if (membership.companyId !== companyId) throw new Error("Not authorized for this resource.");

  const db = getDb();
  await db
    .update(schema.challengeResources)
    .set({
      storagePath: input.path,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      generationStatus: "ready",
      externalUrl: null,
    })
    .where(eq(schema.challengeResources.id, validatedId));
}
