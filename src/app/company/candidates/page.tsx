import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, inArray, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Users } from "lucide-react";

export default async function CompanyCandidatesPage() {
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
    .select({ id: schema.opportunities.id, role: schema.opportunities.role })
    .from(schema.opportunities)
    .where(eq(schema.opportunities.companyId, membership.company.id));
  const opportunityIds = opportunities.map((o) => o.id);
  const roleById = new Map(opportunities.map((o) => [o.id, o.role]));

  const applications = opportunityIds.length
    ? await db
        .select({
          id: schema.applications.id,
          opportunityId: schema.applications.opportunityId,
          status: schema.applications.status,
          studentName: schema.users.fullName,
        })
        .from(schema.applications)
        .innerJoin(schema.users, eq(schema.applications.studentId, schema.users.id))
        .where(inArray(schema.applications.opportunityId, opportunityIds))
    : [];
  const applicationIds = applications.map((a) => a.id);

  const submissions = applicationIds.length
    ? await db
        .select({
          id: schema.submissions.id,
          applicationId: schema.submissions.applicationId,
          submittedAt: schema.submissions.submittedAt,
        })
        .from(schema.submissions)
        .where(inArray(schema.submissions.applicationId, applicationIds))
        .orderBy(desc(schema.submissions.submittedAt))
    : [];
  const latestSubmissionByApplication = new Map<string, { id: string; submittedAt: Date }>();
  for (const s of submissions) {
    if (!latestSubmissionByApplication.has(s.applicationId)) {
      latestSubmissionByApplication.set(s.applicationId, s);
    }
  }

  const pending = applications
    .filter((a) => a.status === "applied" && latestSubmissionByApplication.has(a.id))
    .map((a) => ({
      ...a,
      role: roleById.get(a.opportunityId) ?? "",
      submission: latestSubmissionByApplication.get(a.id)!,
    }))
    .sort((a, b) => a.submission.submittedAt.getTime() - b.submission.submittedAt.getTime());

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-teal-ink">Candidates</p>
      <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">Candidates to review</h1>
      <p className="mt-2 max-w-2xl text-sm text-navy/60">
        Challenge submissions waiting for a decision — shortlist, invite, or pass.
      </p>

      {pending.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nothing to review right now"
          description="Once a candidate submits a Challenge, it'll show up here for you to evaluate."
        />
      ) : (
        <Card className="mt-8 rounded-xl border border-navy/10 shadow-none ring-0">
          <CardContent className="divide-y divide-navy/8 px-6">
            {pending.map((p) => (
              <Link
                key={p.id}
                href={`/company/submissions/${p.submission.id}`}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy">{p.studentName}</p>
                  <p className="mt-0.5 truncate text-xs text-navy/50">{p.role}</p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  Awaiting review
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
