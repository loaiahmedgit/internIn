"use server";

import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { z } from "zod";

const IdSchema = z.string().uuid();
const NoteBodySchema = z.string().trim().min(1).max(4000);

/** Real private note, owned by the company that owns the application — never visible to the student. */
export async function addCandidateNoteAction(applicationId: string, body: string) {
  const validatedId = IdSchema.parse(applicationId);
  const validatedBody = NoteBodySchema.parse(body);
  const { user, membership } = await requireCurrentCompanyMember();
  const db = getDb();

  const [application] = await db
    .select({ id: schema.applications.id, opportunityCompanyId: schema.opportunities.companyId })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .where(eq(schema.applications.id, validatedId))
    .limit(1);
  if (!application || application.opportunityCompanyId !== membership.companyId) {
    throw new Error("Not authorized for this application.");
  }

  await db.insert(schema.candidateNotes).values({
    applicationId: validatedId,
    authorUserId: user.id,
    body: validatedBody,
  });
}
