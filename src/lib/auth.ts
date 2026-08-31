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

type CompanyMembershipResult =
  | {
      ok: true;
      user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
      membership: typeof schema.companyMembers.$inferSelect;
      companyName: string;
    }
  | { ok: false; reason: "signed_out" | "not_linked" };

/**
 * The current company user's own membership + company name, looked up
 * ONCE per request no matter how many Server Components in the tree ask
 * for it (React `cache()`) — the company layout, every page.tsx, and any
 * nested component can all call this without adding a duplicate
 * `company_members` round trip. Never throws; callers decide how to react
 * to `ok: false` (redirect, inline message, or throw via the `require*`
 * wrappers below), so this stays safe to call from places that want to
 * degrade gracefully (e.g. the layout's "workspace access required" view).
 */
export const getCurrentCompanyMembership = cache(async (): Promise<CompanyMembershipResult> => {
  const user = await getCurrentUser();
  if (!user || user.role !== "company") return { ok: false, reason: "signed_out" };

  const db = getDb();
  const [row] = await db
    .select({ membership: schema.companyMembers, companyName: schema.companies.name })
    .from(schema.companyMembers)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.companyMembers.companyId))
    .where(eq(schema.companyMembers.userId, user.id))
    .limit(1);
  if (!row) return { ok: false, reason: "not_linked" };

  return { ok: true, user, membership: row.membership, companyName: row.companyName };
});

export async function requireCurrentCompanyMember(permission: WorkspacePermission | null = "hiring_reviewer") {
  const result = await getCurrentCompanyMembership();
  if (!result.ok) {
    throw new Error(result.reason === "signed_out" ? "Not signed in as a company user." : "This account isn't linked to a company.");
  }
  if (permission && !hasPermission(result.membership, permission)) throw new Error("You do not have access to this workspace feature. Ask a workspace administrator.");

  return { user: result.user, membership: result.membership, companyName: result.companyName };
}

/**
 * Throws unless the current session belongs to a member of `companyId`.
 * Cached per companyId so multiple callers scoped to the same company
 * within one request (e.g. a page.tsx and a data helper it calls) share
 * one query instead of each re-checking membership independently.
 */
const getMembershipForCompany = cache(async (companyId: string) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");

  const db = getDb();
  const [membership] = await db
    .select()
    .from(schema.companyMembers)
    .where(and(eq(schema.companyMembers.companyId, companyId), eq(schema.companyMembers.userId, user.id)))
    .limit(1);

  if (!membership) throw new Error("Not a member of this company.");
  return { user, membership };
});

export async function requireCompanyMember(companyId: string, permission: WorkspacePermission | null = "hiring_reviewer") {
  const { user, membership } = await getMembershipForCompany(companyId);
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
