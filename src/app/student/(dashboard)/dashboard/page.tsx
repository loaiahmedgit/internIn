import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { StatusRail } from "@/components/dashboard/status-rail";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

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
      status: schema.applications.status,
      role: schema.opportunities.role,
      companyName: schema.companies.name,
      skills: schema.opportunities.skills,
    })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(eq(schema.applications.studentId, user.id));

  return (
    <div className="px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-teal-ink">Your applications</p>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">Track your progress.</h1>
        {applications.length > 0 && (
          <p className="text-sm text-navy/50">
            <span className="font-semibold tabular-nums text-navy">{applications.length}</span>{" "}
            {applications.length === 1 ? "application" : "applications"}
          </p>
        )}
      </div>

      {applications.length === 0 ? (
        <div className="mt-16 max-w-md">
          <div className="flex size-14 items-center justify-center rounded-full bg-teal/10">
            <Sparkles className="size-6 text-teal" />
          </div>
          <h2 className="mt-6 text-lg font-semibold text-navy">No applications yet</h2>
          <p className="mt-2 text-sm text-navy/60">
            Find a real work challenge and start proving what you can do — no CV required.
          </p>
          <Button
            render={<Link href="/opportunities" />}
            nativeButton={false}
            size="lg"
            className="mt-8 bg-teal text-white hover:bg-teal/90"
          >
            Browse opportunities
          </Button>
        </div>
      ) : (
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
      )}
    </div>
  );
}
