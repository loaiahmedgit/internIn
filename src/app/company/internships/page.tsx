import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { eq, inArray, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Sparkles } from "lucide-react";

const STATUS_LABEL: Record<string, string> = { draft: "Draft", published: "Published", closed: "Closed" };
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  published: "default",
  closed: "outline",
};

export default async function CompanyInternshipsPage() {
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
        .where(inArray(schema.applications.opportunityId, opportunities.map((o) => o.id)))
        .groupBy(schema.applications.opportunityId)
    : [];
  const countByOpportunity = new Map(applicantCounts.map((c) => [c.opportunityId, c.count]));
  const publishedCount = opportunities.filter((o) => o.status === "published").length;

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-teal-ink">Internships</p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">All internships</h1>
          {opportunities.length > 0 && (
            <p className="mt-2 text-sm text-navy/50">
              <span className="font-semibold text-navy">{publishedCount}</span> published ·{" "}
              <span className="font-semibold text-navy">{opportunities.length}</span> total
            </p>
          )}
        </div>
        <Button render={<Link href="/company/opportunities/new" />} nativeButton={false} className="bg-teal text-white hover:bg-teal/90">
          <Sparkles className="size-4" /> Create internship
        </Button>
      </div>

      {opportunities.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Create your first internship"
          description="Describe what your team needs help with and internIn will help structure the role and a realistic work challenge."
          ctaLabel="Create internship"
          ctaHref="/company/opportunities/new"
        />
      ) : (
        <Card className="mt-8 rounded-xl border border-navy/10 shadow-none ring-0">
          <CardContent className="divide-y divide-navy/8 px-6">
            {opportunities.map((o) => {
              const applicantCount = countByOpportunity.get(o.id) ?? 0;
              return (
                <Link
                  key={o.id}
                  href={`/company/opportunities/${o.id}`}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-navy">{o.role}</p>
                      <Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-navy/50">
                      {o.duration} · {o.hoursPerWeek}h/week · {o.location}
                      {applicantCount > 0 ? ` · ${applicantCount} applicant${applicantCount === 1 ? "" : "s"}` : ""}
                    </p>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
