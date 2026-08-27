import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { StatusRail } from "@/components/dashboard/status-rail";
import { getOpportunitiesWithMatch } from "@/lib/opportunities/browse";

function CompanyAvatar({ name }: { name: string }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal/10 text-sm font-semibold text-teal-ink">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function StatTile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-navy/10 bg-white px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-navy/40">{label}</p>
      <p className={`mt-1.5 text-3xl font-semibold tabular-nums tracking-[-0.02em] ${accent ? "text-teal-ink" : "text-navy"}`}>
        {value}
      </p>
    </div>
  );
}

export default async function StudentDashboardPage() {
  const { user } = await requireCurrentStudent();
  const db = getDb();

  const [profile] = await db
    .select({
      educationStage: schema.studentProfiles.educationStage,
      skills: schema.studentProfiles.skills,
      cvFileKey: schema.studentProfiles.cvFileKey,
    })
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

  const profileStatus = profile.skills.length > 0 && profile.cvFileKey ? "Complete" : "In progress";

  return (
    <div className="px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-teal-ink">Dashboard</p>
      <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">
        Welcome back, {user.fullName.split(" ")[0]}.
      </h1>

      <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
        <StatTile label="Applications" value={String(applications.length)} accent />
        <StatTile label="Open roles" value={String(opportunities.length)} />
        <StatTile label="Profile" value={profileStatus} />
      </div>

      {applications.length > 0 && (
        <div className="mt-14">
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-navy">Your applications</h2>
          <div className="mt-5 max-w-2xl space-y-3">
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
                    <StatusRail status={a.status} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-14">
        <h2 className="text-xl font-semibold tracking-[-0.02em] text-navy">
          {applications.length === 0 ? "Prove what you can do" : "More opportunities for you"}
        </h2>
        {!hasMatchData && (
          <p className="mt-1.5 text-sm text-navy/50">
            <Link href="/student/profile" className="text-teal-ink underline underline-offset-2">
              Add your skills and interests
            </Link>{" "}
            to see match scores.
          </p>
        )}

        {marketplace.length === 0 ? (
          <p className="mt-6 text-navy/68">
            {opportunities.length === 0
              ? "No published opportunities yet. Companies are still building challenges — check back soon."
              : "You've applied to every open opportunity — nice work. Check back soon for more."}
          </p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {marketplace.map((o) => (
              <Link
                key={o.id}
                href={`/opportunities/${o.id}`}
                className="block rounded-xl border border-navy/10 bg-white p-5 shadow-[0_1px_2px_rgba(33,50,72,0.04)] transition-shadow hover:shadow-[0_8px_24px_rgba(33,50,72,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
              >
                <div className="flex items-start gap-3">
                  <CompanyAvatar name={o.companyName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">{o.companyName}</p>
                      {o.matchScore !== undefined && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                            o.matchScore >= 50
                              ? "bg-teal text-white"
                              : o.matchScore > 0
                                ? "bg-teal/10 text-teal-ink"
                                : "bg-gray-light text-navy/50"
                          }`}
                        >
                          {o.matchScore}%
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-lg font-semibold text-navy">{o.role}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-navy/68">
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
    </div>
  );
}
