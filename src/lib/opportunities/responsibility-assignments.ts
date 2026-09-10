"use server";

import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const IdSchema = z.string().uuid();
const ResponsibilityTypeSchema = z.enum(["hiring_owner", "challenge_owner", "reviewer", "certificate_approver"]);
export type OpportunityResponsibilityType = z.infer<typeof ResponsibilityTypeSchema>;

/**
 * R1 §4/§5 — PRE-HIRE responsibility on a specific opportunity, distinct
 * from Phase 6A's programSupervisorAssignments (post-hire only, never
 * reused here). Pure check, exported for other credential/review actions
 * to call — no bypass for any permission, including workspace_admin: R1
 * §5 explicitly requires the assignment for company-certificate grant,
 * "do not allow company permission alone to grant endorsement everywhere."
 */
export async function hasOpportunityResponsibility(opportunityId: string, companyMemberId: string, type: OpportunityResponsibilityType): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: schema.opportunityResponsibilityAssignments.id })
    .from(schema.opportunityResponsibilityAssignments)
    .where(
      and(
        eq(schema.opportunityResponsibilityAssignments.opportunityId, opportunityId),
        eq(schema.opportunityResponsibilityAssignments.companyMemberId, companyMemberId),
        eq(schema.opportunityResponsibilityAssignments.responsibilityType, type),
      ),
    )
    .limit(1);
  return !!row;
}

async function assertOwnsOpportunityForResponsibility(opportunityId: string, companyId: string) {
  const db = getDb();
  const [row] = await db.select({ companyId: schema.opportunities.companyId }).from(schema.opportunities).where(eq(schema.opportunities.id, opportunityId)).limit(1);
  if (!row || row.companyId !== companyId) throw new Error("Not authorized for this opportunity.");
}

/**
 * Real company members + their current responsibility assignments for one
 * opportunity — backs the "People & responsibilities" panel (§6). Gated
 * by hiring_reviewer (viewing) — same base gate every credential/review
 * surface already uses.
 */
export async function getOpportunityResponsibilitiesAction(opportunityId: string) {
  const validatedOpportunityId = IdSchema.parse(opportunityId);
  const { membership } = await requireCurrentCompanyMember();
  await assertOwnsOpportunityForResponsibility(validatedOpportunityId, membership.companyId);

  const db = getDb();
  const members = await db
    .select({ id: schema.companyMembers.id, name: schema.users.fullName, email: schema.users.email })
    .from(schema.companyMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.companyMembers.userId))
    .where(eq(schema.companyMembers.companyId, membership.companyId));

  const assignments = await db
    .select({ companyMemberId: schema.opportunityResponsibilityAssignments.companyMemberId, responsibilityType: schema.opportunityResponsibilityAssignments.responsibilityType })
    .from(schema.opportunityResponsibilityAssignments)
    .where(eq(schema.opportunityResponsibilityAssignments.opportunityId, validatedOpportunityId));

  return { members, assignments };
}

/**
 * Assign/remove a responsibility — gated by hiring_access ("manages
 * postings and hiring", the same permission this app's own Settings copy
 * already uses for who manages hiring). Deliberately NOT gated by the
 * responsibility itself: managing WHO is a certificate_approver is a
 * hiring-management action; actually GRANTING a certificate is a
 * separate, stricter action gated in credentials/company-endorsement.ts.
 */
export async function assignOpportunityResponsibilityAction(opportunityId: string, companyMemberId: string, responsibilityType: OpportunityResponsibilityType) {
  const validatedOpportunityId = IdSchema.parse(opportunityId);
  const validatedMemberId = IdSchema.parse(companyMemberId);
  const validatedType = ResponsibilityTypeSchema.parse(responsibilityType);
  const { user, membership } = await requireCurrentCompanyMember("hiring_access");
  await assertOwnsOpportunityForResponsibility(validatedOpportunityId, membership.companyId);

  const db = getDb();
  const [targetMember] = await db.select({ companyId: schema.companyMembers.companyId }).from(schema.companyMembers).where(eq(schema.companyMembers.id, validatedMemberId)).limit(1);
  if (!targetMember || targetMember.companyId !== membership.companyId) throw new Error("That member isn't part of this company.");

  await db
    .insert(schema.opportunityResponsibilityAssignments)
    .values({ opportunityId: validatedOpportunityId, companyMemberId: validatedMemberId, responsibilityType: validatedType, assignedByUserId: user.id })
    .onConflictDoNothing();

  await db.insert(schema.eventLog).values({
    entityType: "opportunity",
    entityId: validatedOpportunityId,
    eventType: "opportunity_responsibility_assigned",
    actorUserId: user.id,
    metadata: { companyMemberId: validatedMemberId, responsibilityType: validatedType },
  });
}

export async function removeOpportunityResponsibilityAction(opportunityId: string, companyMemberId: string, responsibilityType: OpportunityResponsibilityType) {
  const validatedOpportunityId = IdSchema.parse(opportunityId);
  const validatedMemberId = IdSchema.parse(companyMemberId);
  const validatedType = ResponsibilityTypeSchema.parse(responsibilityType);
  const { user, membership } = await requireCurrentCompanyMember("hiring_access");
  await assertOwnsOpportunityForResponsibility(validatedOpportunityId, membership.companyId);

  const db = getDb();
  await db
    .delete(schema.opportunityResponsibilityAssignments)
    .where(
      and(
        eq(schema.opportunityResponsibilityAssignments.opportunityId, validatedOpportunityId),
        eq(schema.opportunityResponsibilityAssignments.companyMemberId, validatedMemberId),
        eq(schema.opportunityResponsibilityAssignments.responsibilityType, validatedType),
      ),
    );

  await db.insert(schema.eventLog).values({
    entityType: "opportunity",
    entityId: validatedOpportunityId,
    eventType: "opportunity_responsibility_removed",
    actorUserId: user.id,
    metadata: { companyMemberId: validatedMemberId, responsibilityType: validatedType },
  });
}
