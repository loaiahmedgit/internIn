import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { computeProgramProgress } from "@/lib/company/program-progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { GraduationCap } from "lucide-react";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  "On track": "default",
  "Not started": "secondary",
  "Behind schedule": "destructive",
  Completed: "outline",
};

export default async function CompanyInternsPage() {
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
    .select({ id: schema.opportunities.id })
    .from(schema.opportunities)
    .where(eq(schema.opportunities.companyId, membership.company.id));
  const opportunityIds = opportunities.map((o) => o.id);

  const applications = opportunityIds.length
    ? await db
        .select({ id: schema.applications.id })
        .from(schema.applications)
        .where(inArray(schema.applications.opportunityId, opportunityIds))
    : [];
  const applicationIds = applications.map((a) => a.id);

  const offers = applicationIds.length
    ? await db.select().from(schema.internshipOffers).where(inArray(schema.internshipOffers.applicationId, applicationIds))
    : [];
  const offerIds = offers.map((o) => o.id);

  const programs = offerIds.length
    ? await db.select().from(schema.internshipPrograms).where(inArray(schema.internshipPrograms.offerId, offerIds))
    : [];
  const programIds = programs.map((p) => p.id);

  const weeks = programIds.length
    ? await db.select().from(schema.internshipWeeks).where(inArray(schema.internshipWeeks.programId, programIds))
    : [];
  const weekIds = weeks.map((w) => w.id);
  const tasks = weekIds.length
    ? await db.select().from(schema.internshipTasks).where(inArray(schema.internshipTasks.weekId, weekIds))
    : [];

  const rows = programs
    .map((program) => {
      const programWeeks = weeks.filter((w) => w.programId === program.id);
      const programWeekIds = new Set(programWeeks.map((w) => w.id));
      const programTasks = tasks.filter((t) => programWeekIds.has(t.weekId));
      const progress = computeProgramProgress(program, programWeeks, programTasks);
      return {
        program,
        progress,
        statusLabel: program.status === "completed" ? "Completed" : progress.statusLabel,
      };
    })
    .sort((a, b) => {
      if (a.program.status !== b.program.status) return a.program.status === "active" ? -1 : 1;
      return a.statusLabel === "Behind schedule" ? -1 : 1;
    });

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-teal-ink">Interns</p>
      <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">All interns</h1>
      <p className="mt-2 max-w-2xl text-sm text-navy/60">Every internship program, active and completed.</p>

      {rows.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No interns yet"
          description="Once you invite a candidate and they accept, their internship program will show up here."
        />
      ) : (
        <Card className="mt-8 rounded-xl border border-navy/10 shadow-none ring-0">
          <CardContent className="divide-y divide-navy/8 px-6">
            {rows.map(({ program, progress, statusLabel }) => (
              <Link
                key={program.id}
                href={`/company/offers/${program.offerId}/program`}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-navy">{program.internName}</p>
                    <Badge variant={STATUS_VARIANT[statusLabel]}>{statusLabel}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-navy/50">
                    {program.role} · Week {progress.currentWeekNumber} of {program.durationWeeks} · Tasks{" "}
                    {progress.tasksDone}/{progress.tasksTotal}
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
