import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { AssistantWorkspace } from "@/components/opportunities/assistant-workspace";

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { membership } = await requireCurrentCompanyMember();
  const query = await searchParams;
  const db = getDb();

  const opportunities = await db
    .select({ id: schema.opportunities.id, role: schema.opportunities.role })
    .from(schema.opportunities)
    .where(eq(schema.opportunities.companyId, membership.companyId));

  const requestedId = typeof query.opportunity === "string" ? query.opportunity : "all";
  const opportunityId = requestedId !== "all" && opportunities.some((o) => o.id === requestedId) ? requestedId : null;

  const opportunityOptions = opportunities.map((o) => ({ value: o.id, label: o.role }));

  return (
    <div className="h-full min-h-0">
      <AssistantWorkspace key={opportunityId ?? "all"} opportunityOptions={opportunityOptions} opportunityId={opportunityId} />
    </div>
  );
}
