import Link from "next/link";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { computeMatchScore } from "@/lib/matching";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { STUDENT_NAV_ITEMS } from "@/lib/dashboard-nav";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const db = getDb();
  const opportunities = await db
    .select({
      id: schema.opportunities.id,
      role: schema.opportunities.role,
      duration: schema.opportunities.duration,
      hoursPerWeek: schema.opportunities.hoursPerWeek,
      location: schema.opportunities.location,
      skills: schema.opportunities.skills,
      companyName: schema.companies.name,
    })
    .from(schema.opportunities)
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(eq(schema.opportunities.status, "published"));

  const currentUser = await getCurrentUser();
  const studentProfile =
    currentUser?.role === "student"
      ? (
          await db
            .select({ skills: schema.studentProfiles.skills, interests: schema.studentProfiles.interests })
            .from(schema.studentProfiles)
            .where(eq(schema.studentProfiles.userId, currentUser.id))
            .limit(1)
        )[0]
      : undefined;

  const hasMatchData = Boolean(
    studentProfile && (studentProfile.skills.length > 0 || studentProfile.interests.length > 0),
  );
  const withMatch = opportunities.map((o) => ({
    ...o,
    matchScore: hasMatchData
      ? computeMatchScore(studentProfile!.skills, studentProfile!.interests, o.skills)
      : undefined,
  }));
  if (hasMatchData) withMatch.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));

  const isStudent = currentUser?.role === "student";

  const list =
    withMatch.length === 0 ? (
      <p className="mt-12 text-navy/68">
        No published opportunities yet. Companies are still building challenges — check back soon.
      </p>
    ) : (
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {withMatch.map((o) => (
          <Link
            key={o.id}
            href={`/opportunities/${o.id}`}
            className="block rounded-xl border border-navy/12 bg-white p-6 transition-colors hover:border-teal/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">{o.companyName}</p>
              {o.matchScore !== undefined && (
                <span className="shrink-0 rounded-full bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal-ink">
                  {o.matchScore}% match
                </span>
              )}
            </div>
            <p className="mt-1.5 text-lg font-semibold text-navy">{o.role}</p>
            <p className="mt-2 text-sm text-navy/68">
              {o.duration} · {o.hoursPerWeek}h/week · {o.location}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {o.skills.slice(0, 4).map((s) => (
                <span key={s} className="rounded-full bg-gray-light px-2.5 py-1 text-xs text-navy/68">
                  {s}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    );

  const heading = (
    <>
      <p className="text-xs font-medium tracking-[0.12em] text-teal-ink uppercase">Opportunities</p>
      <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">
        Prove what you can do.
      </h1>
      {isStudent && !hasMatchData && (
        <p className="mt-2 text-sm text-navy/50">
          <Link href="/student/profile" className="text-teal-ink underline underline-offset-2">
            Add your skills and interests
          </Link>{" "}
          to see match scores.
        </p>
      )}
    </>
  );

  if (isStudent && currentUser) {
    return (
      <DashboardShell eyebrow="Student" displayName={currentUser.fullName} navItems={STUDENT_NAV_ITEMS}>
        <div className="px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
          {heading}
          {list}
        </div>
      </DashboardShell>
    );
  }

  const dashboardHref = currentUser ? (currentUser.role === "company" ? "/company/dashboard" : "/student/dashboard") : null;

  return (
    <div className="flex min-h-full flex-col">
      <Navbar dashboardHref={dashboardHref} />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-5 py-20 sm:px-8">
          {heading}
          {list}
        </div>
      </main>
      <Footer />
    </div>
  );
}
