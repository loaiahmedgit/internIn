import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { StatusRail } from "@/components/dashboard/status-rail";

function CompanyAvatar({ name }: { name: string }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal/10 text-sm font-semibold text-teal-ink">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default async function StudentApplicationsPage() {
  const { user } = await requireCurrentStudent();
  const db = getDb();

  const applications = await db
    .select({
      id: schema.applications.id,
      status: schema.applications.status,
      role: schema.opportunities.role,
      companyName: schema.companies.name,
      skills: schema.opportunities.skills,
    })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(eq(schema.applications.studentId, user.id));

  const applicationIds = applications.map((a) => a.id);
  const submissions = applicationIds.length
    ? await db
        .select({ applicationId: schema.submissions.applicationId })
        .from(schema.submissions)
        .where(inArray(schema.submissions.applicationId, applicationIds))
    : [];
  const offers = applicationIds.length
    ? await db
        .select({ applicationId: schema.internshipOffers.applicationId })
        .from(schema.internshipOffers)
        .where(inArray(schema.internshipOffers.applicationId, applicationIds))
    : [];
  const submittedIds = new Set(submissions.map((s) => s.applicationId));
  const offeredIds = new Set(offers.map((o) => o.applicationId));

  return (
    <div className="px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-teal-ink">Applications</p>
      <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">Your applications</h1>

      {applications.length === 0 ? (
        <p className="mt-8 text-navy/68">
          You haven&apos;t applied to anything yet.{" "}
          <Link href="/student/opportunities" className="text-teal-ink underline underline-offset-2">
            Browse open opportunities
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 max-w-2xl space-y-3">
          {applications.map((a) => (
            <Link
              key={a.id}
              href={`/student/applications/${a.id}`}
              className="flex items-start gap-4 rounded-xl border border-navy/10 bg-white p-5 shadow-[0_1px_2px_rgba(33,50,72,0.04)] transition-shadow hover:shadow-[0_8px_24px_rgba(33,50,72,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
            >
              <CompanyAvatar name={a.companyName} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">{a.companyName}</p>
                <p className="mt-1 text-lg font-semibold text-navy">{a.role}</p>
                {a.skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.skills.map((skill) => (
                      <span key={skill} className="rounded-full bg-gray-light px-2 py-0.5 text-xs text-navy/60">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3">
                  <StatusRail status={a.status} hasSubmission={submittedIds.has(a.id)} hasOffer={offeredIds.has(a.id)} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
