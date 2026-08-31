import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { CompanyPageContainer } from "@/components/company/page-shell";
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

  const opportunityOptions = [{ value: "all", label: "All hiring" }, ...opportunities.map((o) => ({ value: o.id, label: o.role }))];

  return (
    <CompanyPageContainer>
      <AssistantWorkspace key={opportunityId ?? "all"} opportunityOptions={opportunityOptions} opportunityId={opportunityId} />
    </CompanyPageContainer>
  );
}
