import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { hasPermission } from "./permissions";

/** Evaluated at delivery time, so revoked access and changed preferences take effect. */
export async function hiringNotificationRecipients(
  opportunityId: string,
  kind: "submission" | "offer",
) {
  const rows = await getDb()
    .select({ member: schema.companyMembers, email: schema.users.email })
    .from(schema.opportunities)
    .innerJoin(
      schema.companyMembers,
      eq(schema.companyMembers.companyId, schema.opportunities.companyId),
    )
    .innerJoin(schema.users, eq(schema.users.id, schema.companyMembers.userId))
    .where(eq(schema.opportunities.id, opportunityId));
  return [
    ...new Set(
      rows
        .filter(
          ({ member }) =>
            hasPermission(member, "hiring_reviewer") &&
            (kind === "submission"
              ? member.submissionNotifications
              : member.offerNotifications),
        )
        .map((r) => r.email),
    ),
  ];
}
