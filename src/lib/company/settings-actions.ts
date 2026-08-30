"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { hasPermission, WORKSPACE_PERMISSIONS } from "./permissions";

const optionalUrl = z.union([
  z.literal(""),
  z
    .url()
    .refine(
      (s) => ["http:", "https:"].includes(new URL(s).protocol),
      "Use an HTTP or HTTPS address.",
    ),
]);
const General = z.object({
  name: z.string().trim().min(2).max(150),
  website: optionalUrl,
  officeLocations: z.string().trim().max(500),
  industry: z.string().trim().max(150),
  contactEmail: z.union([z.literal(""), z.email()]),
});
export type SettingsResult = { success?: string; error?: string };

export async function saveCompanySettings(
  tab: string,
  _state: SettingsResult,
  form: FormData,
): Promise<SettingsResult> {
  try {
    const { user, membership } = await requireCurrentCompanyMember(
      tab === "notifications" ? null : "workspace_admin",
    );
    const db = getDb();
    if (tab === "general") {
      const parsed = General.safeParse(Object.fromEntries(form));
      if (!parsed.success)
        return {
          error: parsed.error.issues
            .map((i) => `${String(i.path[0])}: ${i.message}`)
            .join(" "),
        };
      await db
        .update(schema.companies)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(schema.companies.id, membership.companyId));
    } else if (tab === "branding") {
      const logoUrl = optionalUrl.parse(form.get("logoUrl"));
      await db
        .update(schema.companies)
        .set({ logoUrl: logoUrl || null, updatedAt: new Date() })
        .where(eq(schema.companies.id, membership.companyId));
    } else if (tab === "privacy") {
      await db
        .update(schema.companies)
        .set({
          evidenceAiEnabled: form.get("evidenceAiEnabled") === "on",
          updatedAt: new Date(),
        })
        .where(eq(schema.companies.id, membership.companyId));
    } else if (tab === "notifications") {
      await db
        .update(schema.companyMembers)
        .set({
          submissionNotifications: form.get("submissionNotifications") === "on",
          offerNotifications: form.get("offerNotifications") === "on",
          updatedAt: new Date(),
        })
        .where(eq(schema.companyMembers.id, membership.id));
    } else return { error: "Choose a valid settings section." };
    await db
      .insert(schema.eventLog)
      .values({
        entityType: "company",
        entityId: membership.companyId,
        eventType: `settings_${tab}_updated`,
        actorUserId: user.id,
      });
    revalidatePath("/company", "layout");
    return { success: "Changes saved." };
  } catch (error) {
    return {
      error:
        error instanceof z.ZodError
          ? "Enter a valid HTTP or HTTPS logo URL."
          : error instanceof Error
            ? error.message
            : "Could not save changes. Try again.",
    };
  }
}

export async function saveTeamAccess(
  _state: SettingsResult,
  form: FormData,
): Promise<SettingsResult> {
  try {
    const { user, membership } =
      await requireCurrentCompanyMember("workspace_admin");
    const memberId = z.uuid().parse(form.get("memberId"));
    const permissions = z
      .array(z.enum(WORKSPACE_PERMISSIONS))
      .min(1, "Select at least one access permission.")
      .parse(form.getAll("permissions"));
    const db = getDb();
    await db.transaction(async (tx) => {
      await tx
        .select({ id: schema.companies.id })
        .from(schema.companies)
        .where(eq(schema.companies.id, membership.companyId))
        .for("update");
      const members = await tx
        .select()
        .from(schema.companyMembers)
        .where(eq(schema.companyMembers.companyId, membership.companyId));
      const actor = members.find((m) => m.id === membership.id);
      const target = members.find((m) => m.id === memberId);
      if (!actor || !hasPermission(actor, "workspace_admin"))
        throw new Error("Administrator access is required.");
      if (!target)
        throw new Error("This member does not belong to your workspace.");
      if (target.role === "owner")
        throw new Error("The workspace owner's access cannot be removed.");
      if (
        !permissions.includes("workspace_admin") &&
        !members.some(
          (m) => m.id !== target.id && hasPermission(m, "workspace_admin"),
        )
      )
        throw new Error("Keep at least one workspace administrator.");
      await tx
        .update(schema.companyMembers)
        .set({
          permissions,
          role: permissions.includes("workspace_admin") ? "admin" : "member",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.companyMembers.id, memberId),
            eq(schema.companyMembers.companyId, membership.companyId),
          ),
        );
      await tx
        .insert(schema.eventLog)
        .values({
          entityType: "company",
          entityId: membership.companyId,
          actorUserId: user.id,
          eventType: "member_access_updated",
          metadata: { memberId, permissions },
        });
    });
    revalidatePath("/company", "layout");
    return { success: "Access updated." };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not update access.",
    };
  }
}
