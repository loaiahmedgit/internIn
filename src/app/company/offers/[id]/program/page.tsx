import { notFound } from "next/navigation";
import { eq, asc, inArray, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { InternshipTaskList } from "@/components/opportunities/internship-task-list";
import { AddFeedbackForm } from "@/components/opportunities/add-feedback-form";
import { CompleteProgramButton } from "@/components/opportunities/complete-program-button";

export default async function InternshipProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { membership } = await requireCurrentCompanyMember("program_supervisor");
  const db = getDb();

  const [row] = await db
    .select({
      program: schema.internshipPrograms,
      opportunityCompanyId: schema.opportunities.companyId,
    })
    .from(schema.internshipPrograms)
    .innerJoin(schema.internshipOffers, eq(schema.internshipPrograms.offerId, schema.internshipOffers.id))
    .innerJoin(schema.applications, eq(schema.internshipOffers.applicationId, schema.applications.id))
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .where(eq(schema.internshipPrograms.offerId, id))
    .limit(1);

  if (!row || row.opportunityCompanyId !== membership.companyId) notFound();

  const { program } = row;

  const weeks = await db
    .select()
    .from(schema.internshipWeeks)
    .where(eq(schema.internshipWeeks.programId, program.id))
    .orderBy(asc(schema.internshipWeeks.weekNumber));

  const weekIds = weeks.map((w) => w.id);
  const tasks = weekIds.length
    ? await db.select().from(schema.internshipTasks).where(inArray(schema.internshipTasks.weekId, weekIds))
    : [];
  const tasksByWeek = new Map<string, typeof tasks>();
  for (const task of tasks) {
    tasksByWeek.set(task.weekId, [...(tasksByWeek.get(task.weekId) ?? []), task]);
  }

  const feedback = await db
    .select({ entry: schema.supervisorFeedback, authorName: schema.users.fullName })
    .from(schema.supervisorFeedback)
    .innerJoin(schema.users, eq(schema.supervisorFeedback.authorUserId, schema.users.id))
    .where(eq(schema.supervisorFeedback.programId, program.id))
    .orderBy(desc(schema.supervisorFeedback.createdAt));

  const weekTitleById = new Map(weeks.map((w) => [w.id, w.weekNumber]));

  const [verifiedExperience] = await db
    .select()
    .from(schema.verifiedExperience)
    .where(eq(schema.verifiedExperience.programId, program.id))
    .limit(1);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Internship Program</p>
      <h1 className="mt-1 text-2xl font-bold text-navy">
        {program.internName} — {program.role}
      </h1>
      <p className="mt-1 text-sm text-navy/60">
        {program.durationWeeks} weeks · {program.hoursPerWeek}h/week ·{" "}
        <span className="capitalize">{program.status}</span>
      </p>

      <div className="mt-8 space-y-3">
        {weeks.map((w) => (
          <div key={w.id} className="border border-navy/12 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Week {w.weekNumber}</p>
            <p className="mt-1 font-medium text-navy">{w.title}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-navy/80">
              {w.objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
            <InternshipTaskList weekId={w.id} tasks={tasksByWeek.get(w.id) ?? []} />
          </div>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy/50">Supervisor feedback</h2>
        {feedback.length > 0 && (
          <div className="mt-3 space-y-3">
            {feedback.map((f) => (
              <div key={f.entry.id} className="rounded-lg border border-gray-cool/60 bg-white p-3">
                <p className="text-xs text-navy/40">
                  {f.authorName}
                  {f.entry.weekId ? ` · Week ${weekTitleById.get(f.entry.weekId)}` : ""}
                </p>
                <p className="mt-1 text-sm text-navy/80">{f.entry.feedback}</p>
              </div>
            ))}
          </div>
        )}
        <AddFeedbackForm
          programId={program.id}
          weeks={weeks.map((w) => ({ id: w.id, weekNumber: w.weekNumber }))}
        />
      </div>

      <div className="mt-10 border-t border-navy/12 pt-8">
        {verifiedExperience ? (
          <div className="border border-teal/30 bg-teal/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-ink">Verified Experience</p>
            <h2 className="mt-1 text-lg font-bold text-navy">
              {program.role}, {program.durationWeeks} weeks — Verified
            </h2>
            <p className="mt-4 text-xs font-semibold uppercase text-navy/50">Work completed</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-navy/80">
              {verifiedExperience.workCompleted.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs font-semibold uppercase text-navy/50">Skills demonstrated</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {verifiedExperience.skillsDemonstrated.map((s) => (
                <span key={s} className="rounded-full bg-white px-2.5 py-1 text-xs text-navy/68">
                  {s}
                </span>
              ))}
            </div>
          </div>
        ) : program.status === "active" ? (
          <CompleteProgramButton programId={program.id} internName={program.internName} />
        ) : null}
      </div>
    </div>
  );
}
