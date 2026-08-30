import { createClient } from "@/lib/supabase/server";
import { getDb, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { hasPermission, type WorkspacePermission } from "@/lib/company/permissions";
import { cache } from "react";

/**
 * The only place application code should read "who is signed in and what
 * are they allowed to touch." A `company_members` row existing is not
 * itself authorization — every one of these functions is a query scoped by
 * the current session, and callers are expected to use them (not query
 * companies/opportunities/etc. directly) before returning any data.
 */

export const getCurrentUser = cache(async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const db = getDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.authUserId, authUser.id))
    .limit(1);
  return user ?? null;
});

export async function requireCurrentCompanyMember(permission: WorkspacePermission | null = "hiring_reviewer") {
  const user = await getCurrentUser();
  if (!user || user.role !== "company") throw new Error("Not signed in as a company user.");

  const db = getDb();
  const [membership] = await db
    .select()
    .from(schema.companyMembers)
    .where(eq(schema.companyMembers.userId, user.id))
    .limit(1);
  if (!membership) throw new Error("This account isn't linked to a company.");
  if (permission && !hasPermission(membership, permission)) throw new Error("You do not have access to this workspace feature. Ask a workspace administrator.");

  return { user, membership };
}

/** Throws unless the current session belongs to a member of `companyId`. */
export async function requireCompanyMember(companyId: string, permission: WorkspacePermission | null = "hiring_reviewer") {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");

  const db = getDb();
  const [membership] = await db
    .select()
    .from(schema.companyMembers)
    .where(and(eq(schema.companyMembers.companyId, companyId), eq(schema.companyMembers.userId, user.id)))
    .limit(1);

  if (!membership) throw new Error("Not a member of this company.");
  if (permission && !hasPermission(membership, permission)) throw new Error("You do not have access to this workspace feature. Ask a workspace administrator.");
  return { user, membership };
}

/** Throws unless the current session is the student who owns `studentUserId`'s data. */
export async function requireSelf(studentUserId: string) {
  const user = await getCurrentUser();
  if (!user || user.id !== studentUserId) throw new Error("Not authorized.");
  return user;
}

export async function requireCurrentStudent() {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") throw new Error("Not signed in as a student.");
  return { user };
}
