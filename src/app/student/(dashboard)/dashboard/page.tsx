import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { StatusRail } from "@/components/dashboard/status-rail";
import { getOpportunitiesWithMatch } from "@/lib/opportunities/browse";

export default async function StudentDashboardPage() {
  const { user } = await requireCurrentStudent();
  const db = getDb();

  const [profile] = await db
    .select({ educationStage: schema.studentProfiles.educationStage })
    .from(schema.studentProfiles)
    .where(eq(schema.studentProfiles.userId, user.id))
    .limit(1);
  if (!profile?.educationStage) redirect("/student/onboarding");

  const applications = await db
    .select({
      id: schema.applications.id,
      opportunityId: schema.applications.opportunityId,
      status: schema.applications.status,
      role: schema.opportunities.role,
      companyName: schema.companies.name,
      skills: schema.opportunities.skills,
    })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(eq(schema.applications.studentId, user.id));

  const appliedOpportunityIds = new Set(applications.map((a) => a.opportunityId));
  const { opportunities, hasMatchData } = await getOpportunitiesWithMatch(user.id);
  const marketplace = opportunities.filter((o) => !appliedOpportunityIds.has(o.id));

  return (
    <div className="px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      {applications.length > 0 && (
        <div className="mb-14">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-teal-ink">Your applications</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">
              Track your progress.
            </h1>
            <p className="text-sm text-navy/50">
              <span className="font-semibold tabular-nums text-navy">{applications.length}</span>{" "}
              {applications.length === 1 ? "application" : "applications"}
            </p>
          </div>
          <div className="mt-10 max-w-2xl space-y-3">
            {applications.map((a) => (
              <Link
                key={a.id}
                href={`/student/applications/${a.id}`}
                className="block rounded-xl border border-navy/12 bg-white p-5 transition-colors hover:border-teal/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
              >
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
                  <StatusRail status={a.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs font-medium uppercase tracking-[0.12em] text-teal-ink">Opportunities</p>
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.04em] text-navy">
        {applications.length === 0 ? "Prove what you can do." : "More opportunities for you."}
      </h2>
      {!hasMatchData && (
        <p className="mt-2 text-sm text-navy/50">
          <Link href="/student/profile" className="text-teal-ink underline underline-offset-2">
            Add your skills and interests
          </Link>{" "}
          to see match scores.
        </p>
      )}

      {marketplace.length === 0 ? (
        <p className="mt-10 text-navy/68">
          {opportunities.length === 0
            ? "No published opportunities yet. Companies are still building challenges — check back soon."
            : "You've applied to every open opportunity — nice work. Check back soon for more."}
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {marketplace.map((o) => (
            <Link
              key={o.id}
              href={`/opportunities/${o.id}`}
              className="block rounded-xl border border-navy/12 bg-white p-5 transition-colors hover:border-teal/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">{o.companyName}</p>
                {o.matchScore !== undefined && (
                  <span className="shrink-0 rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal-ink">
                    {o.matchScore}% match
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-lg font-semibold text-navy">{o.role}</p>
              <p className="mt-2 text-sm text-navy/68">
                {o.duration} · {o.hoursPerWeek}h/week · {o.location}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {o.skills.slice(0, 3).map((s) => (
                  <span key={s} className="rounded-full bg-gray-light px-2 py-0.5 text-xs text-navy/60">
                    {s}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
