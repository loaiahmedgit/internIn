import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { CompanyPageContainer, CompanyPageHeader } from "@/components/company/page-shell";

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", member: "Member" };

export default async function CompanyProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const db = getDb();
  const [membership] = await db
    .select({
      role: schema.companyMembers.role,
      jobTitle: schema.companyMembers.jobTitle,
      memberSince: schema.companyMembers.createdAt,
      companyName: schema.companies.name,
    })
    .from(schema.companyMembers)
    .innerJoin(schema.companies, eq(schema.companyMembers.companyId, schema.companies.id))
    .where(eq(schema.companyMembers.userId, user.id))
    .limit(1);

  return (
    <CompanyPageContainer>
      <CompanyPageHeader eyebrow="Account" title="Profile" description="Your identity on internIn." />

      <div className="mt-6 flex items-center gap-4 rounded-xl border border-navy/10 bg-white p-6">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-teal/10 text-xl font-semibold text-teal-ink">
          {user.fullName.charAt(0).toUpperCase() || "?"}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-navy">{user.fullName}</p>
          <p className="text-sm text-navy/60">{user.email}</p>
        </div>
      </div>

      {membership && (
        <dl className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-navy/10 bg-white p-6 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-navy/45">Company</dt>
            <dd className="mt-1 text-sm text-navy">{membership.companyName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-navy/45">Role</dt>
            <dd className="mt-1 text-sm text-navy">{ROLE_LABEL[membership.role] ?? membership.role}</dd>
          </div>
          {membership.jobTitle && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-navy/45">Title</dt>
              <dd className="mt-1 text-sm text-navy">{membership.jobTitle}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase tracking-wide text-navy/45">Member since</dt>
            <dd className="mt-1 text-sm text-navy">
              {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(membership.memberSince)}
            </dd>
          </div>
        </dl>
      )}
    </CompanyPageContainer>
  );
}
