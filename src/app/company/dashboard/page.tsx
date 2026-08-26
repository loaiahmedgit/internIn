import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { eq, inArray, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default async function CompanyDashboardPage() {
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
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-navy/60">
        This account isn&apos;t linked to a company yet.
      </div>
    );
  }

  const opportunities = await db
    .select()
    .from(schema.opportunities)
    .where(eq(schema.opportunities.companyId, membership.company.id));

  const applicantCounts = opportunities.length
    ? await db
        .select({ opportunityId: schema.applications.opportunityId, count: sql<number>`count(*)::int` })
        .from(schema.applications)
        .where(
          inArray(
            schema.applications.opportunityId,
            opportunities.map((o) => o.id),
          ),
        )
        .groupBy(schema.applications.opportunityId)
    : [];
  const countByOpportunity = new Map(applicantCounts.map((c) => [c.opportunityId, c.count]));
  const publishedCount = opportunities.filter((o) => o.status === "published").length;

  return (
    <div className="px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-teal-ink">Internships</p>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">
          {membership.company.name}
        </h1>
        {opportunities.length > 0 && (
          <p className="text-sm text-navy/50">
            <span className="font-semibold text-navy">{publishedCount}</span> published ·{" "}
            <span className="font-semibold text-navy">{opportunities.length}</span> total
          </p>
        )}
      </div>

      {opportunities.length === 0 ? (
        <div className="mt-16 max-w-md">
          <div className="flex size-14 items-center justify-center rounded-full bg-teal/10">
            <Sparkles className="size-6 text-teal" />
          </div>
          <h2 className="mt-6 text-lg font-semibold text-navy">No internships yet</h2>
          <p className="mt-2 text-sm text-navy/60">
            Describe the role to internIn&apos;s AI and get a structured listing plus a realistic work
            challenge in minutes.
          </p>
          <Button
            render={<Link href="/company/opportunities/new" />}
            nativeButton={false}
            size="lg"
            className="mt-8 bg-teal text-white hover:bg-teal/90"
          >
            <Sparkles className="mr-1.5 size-4" /> Create Internship
          </Button>
        </div>
      ) : (
        <div className="mt-10 max-w-2xl space-y-3">
          {opportunities.map((o) => {
            const applicantCount = countByOpportunity.get(o.id) ?? 0;
            return (
              <Link
                key={o.id}
                href={`/company/opportunities/${o.id}`}
                className="block rounded-xl border border-navy/12 bg-white p-5 transition-colors hover:border-teal/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-navy">{o.role}</p>
                    <p className="mt-1 text-sm text-navy/50">
                      {o.duration} · {o.hoursPerWeek}h/week · {o.location}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                      o.status === "published" ? "bg-teal/8 text-teal-ink" : "bg-gray-light text-navy/50"
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
                {applicantCount > 0 && (
                  <p className="mt-3 text-xs font-medium text-navy/60">
                    {applicantCount} {applicantCount === 1 ? "applicant" : "applicants"}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
