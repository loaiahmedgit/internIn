import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { CompanyPageContainer, CompanyPageHeader } from "@/components/company/page-shell";
import { BadgeCheck } from "lucide-react";

export default async function CompanySettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const db = getDb();
  const [membership] = await db
    .select({ company: schema.companies })
    .from(schema.companyMembers)
    .innerJoin(schema.companies, eq(schema.companyMembers.companyId, schema.companies.id))
    .where(eq(schema.companyMembers.userId, user.id))
    .limit(1);

  if (!membership) {
    return (
      <CompanyPageContainer>
        <p className="text-center text-navy/60">This account isn&apos;t linked to a company yet.</p>
      </CompanyPageContainer>
    );
  }
  const { company } = membership;

  return (
    <CompanyPageContainer>
      <CompanyPageHeader eyebrow="Company workspace" title="Workspace settings" description="Your company's real, current details." />

      <dl className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-navy/10 bg-white p-6 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-navy/45">Company name</dt>
          <dd className="mt-1 flex items-center gap-1.5 text-sm text-navy">
            {company.name}
            {company.verified && <BadgeCheck className="size-4 text-teal-ink" aria-label="Verified company" />}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-navy/45">Website</dt>
          <dd className="mt-1 text-sm text-navy">
            {company.website ? (
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-teal-ink hover:underline">
                {company.website}
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-navy/45">Industry</dt>
          <dd className="mt-1 text-sm text-navy">{company.industry ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-navy/45">Company size</dt>
          <dd className="mt-1 text-sm text-navy">{company.size ?? "—"}</dd>
        </div>
      </dl>
    </CompanyPageContainer>
  );
}
