import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";

export default async function CompanyOpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { membership } = await requireCurrentCompanyMember();
  const db = getDb();

  const [opportunity] = await db
    .select()
    .from(schema.opportunities)
    .where(and(eq(schema.opportunities.id, id), eq(schema.opportunities.companyId, membership.companyId)))
    .limit(1);

  if (!opportunity) notFound();

  const applications = await db
    .select({
      applicationId: schema.applications.id,
      applicationStatus: schema.applications.status,
      studentName: schema.users.fullName,
    })
    .from(schema.applications)
    .innerJoin(schema.users, eq(schema.applications.studentId, schema.users.id))
    .where(eq(schema.applications.opportunityId, opportunity.id));

  const rows = await Promise.all(
    applications.map(async (a) => {
      const [submission] = await db
        .select()
        .from(schema.submissions)
        .where(eq(schema.submissions.applicationId, a.applicationId))
        .orderBy(desc(schema.submissions.submittedAt))
        .limit(1);
      return { ...a, submission };
    }),
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Candidates</p>
          <h1 className="mt-1 text-2xl font-bold text-navy">{opportunity.role}</h1>
        </div>
        {rows.filter((r) => r.submission).length >= 2 && (
          <Link
            href={`/company/opportunities/${opportunity.id}/compare`}
            className="text-sm font-medium text-teal-ink underline underline-offset-2"
          >
            Compare candidates
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 text-navy/60">No applications yet.</p>
      ) : (
        <div className="mt-8 space-y-3">
          {rows.map((r) => (
            <div
              key={r.applicationId}
              className="flex items-center justify-between rounded-lg border border-gray-cool/60 bg-white p-4"
            >
              <div>
                <p className="font-medium text-navy">{r.studentName}</p>
                <p className="text-sm text-navy/50 capitalize">{r.applicationStatus}</p>
              </div>
              {r.submission ? (
                <Link
                  href={`/company/submissions/${r.submission.id}`}
                  className="text-sm font-medium text-teal-ink underline underline-offset-2"
                >
                  View evidence
                </Link>
              ) : (
                <span className="text-sm text-navy/40">No submission yet</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
