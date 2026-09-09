import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, Calendar, ChevronRight, User2 } from "lucide-react";
import { eq, and, inArray, desc, asc, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { computeProgramProgress } from "@/lib/company/program-progress";
import { formatRecentDate } from "@/lib/format-date";
import { StudentTaskItem, type StudentTask } from "@/components/opportunities/student-task-item";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "work", label: "My Work" },
  { key: "timeline", label: "Timeline" },
  { key: "checkins", label: "Check-ins" },
  { key: "feedback", label: "Feedback" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const MS_PER_DAY = 86_400_000;

/** Real event types this program/task/offer chain ever actually logs — student-facing wording only, never fabricated activity. */
function timelineLabel(eventType: string, metadata: unknown, taskTitleById: Map<string, string>, entityId: string): string {
  const meta = (metadata ?? {}) as Record<string, unknown>;
  switch (eventType) {
    case "offer_accepted":
      return "You accepted this internship offer";
    case "internship_program_created":
      return "Your internship program was set up";
    case "internship_program_completed":
      return "Your internship was marked complete";
    case "program_supervisor_assigned":
      return "A supervisor was assigned";
    case "program_supervisor_reassigned":
      return "Your supervisor changed";
    case "program_supervisor_removed":
      return "A supervisor assignment was removed";
    case "supervisor_feedback_added":
      return "Your supervisor left feedback";
    case "internship_task_created":
      return `New task added: ${taskTitleById.get(entityId) ?? "a task"}`;
    case "internship_task_status_changed": {
      const status = typeof meta.status === "string" ? meta.status.replace(/_/g, " ") : "updated";
      return `${taskTitleById.get(entityId) ?? "A task"} — ${status}`;
    }
    case "internship_task_evidence_updated":
      return `You added evidence to ${taskTitleById.get(entityId) ?? "a task"}`;
    default:
      return eventType.replace(/_/g, " ");
  }
}

export default async function StudentProgramWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { programId } = await params;
  const query = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === query.tab) ? (query.tab as TabKey) : "overview";
  const { user } = await requireCurrentStudent();
  const db = getDb();

  const [row] = await db
    .select({
      program: schema.internshipPrograms,
      offerId: schema.internshipOffers.id,
      applicationId: schema.applications.id,
      studentId: schema.applications.studentId,
      companyName: schema.companies.name,
      opportunityStartDate: schema.opportunities.startDate,
    })
    .from(schema.internshipPrograms)
    .innerJoin(schema.internshipOffers, eq(schema.internshipPrograms.offerId, schema.internshipOffers.id))
    .innerJoin(schema.applications, eq(schema.internshipOffers.applicationId, schema.applications.id))
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(eq(schema.internshipPrograms.id, programId))
    .limit(1);

  // Ownership check — never trust the URL param alone (§21/§31: cross-student denial server-side).
  if (!row || row.studentId !== user.id) notFound();
  const { program } = row;

  const weeks = await db.select().from(schema.internshipWeeks).where(eq(schema.internshipWeeks.programId, program.id)).orderBy(asc(schema.internshipWeeks.weekNumber));
  const weekIds = weeks.map((w) => w.id);
  const tasks = weekIds.length ? await db.select().from(schema.internshipTasks).where(inArray(schema.internshipTasks.weekId, weekIds)) : [];
  const tasksByWeek = new Map<string, typeof tasks>();
  for (const t of tasks) tasksByWeek.set(t.weekId, [...(tasksByWeek.get(t.weekId) ?? []), t]);
  const taskTitleById = new Map(tasks.map((t) => [t.id, t.title]));

  const [supervisorRow] = await db
    .select({ name: schema.users.fullName })
    .from(schema.programSupervisorAssignments)
    .innerJoin(schema.companyMembers, eq(schema.companyMembers.id, schema.programSupervisorAssignments.companyMemberId))
    .innerJoin(schema.users, eq(schema.users.id, schema.companyMembers.userId))
    .where(and(eq(schema.programSupervisorAssignments.programId, program.id), eq(schema.programSupervisorAssignments.isPrimary, true)))
    .limit(1);

  const feedback = await db
    .select({ entry: schema.supervisorFeedback, authorName: schema.users.fullName })
    .from(schema.supervisorFeedback)
    .innerJoin(schema.users, eq(schema.supervisorFeedback.authorUserId, schema.users.id))
    .where(eq(schema.supervisorFeedback.programId, program.id))
    .orderBy(desc(schema.supervisorFeedback.createdAt));
  const weekNumberById = new Map(weeks.map((w) => [w.id, w.weekNumber]));

  const [verifiedExperience] = program.status === "completed"
    ? await db.select().from(schema.verifiedExperience).where(eq(schema.verifiedExperience.programId, program.id)).limit(1)
    : [];

  const taskIds = tasks.map((t) => t.id);
  const timelineEntityIds = [program.id, row.offerId, ...taskIds];
  const timeline = await db
    .select({ id: schema.eventLog.id, entityType: schema.eventLog.entityType, entityId: schema.eventLog.entityId, eventType: schema.eventLog.eventType, metadata: schema.eventLog.metadata, createdAt: schema.eventLog.createdAt })
    .from(schema.eventLog)
    .where(or(...timelineEntityIds.map((id) => eq(schema.eventLog.entityId, id))))
    .orderBy(desc(schema.eventLog.createdAt))
    .limit(30);

  const progress = computeProgramProgress(program, weeks, tasks);
  const currentWeek = weeks.find((w) => w.weekNumber === progress.currentWeekNumber);
  const currentWeekTasks = currentWeek ? tasksByWeek.get(currentWeek.id) ?? [] : [];
  const blockedTasks = tasks.filter((t) => t.status === "blocked");
  const nextUp = currentWeekTasks.find((t) => t.status === "pending" || t.status === "in_progress");

  // Display-only date estimate — never persisted, never mutates the
  // originating opportunity (Phase 6B §2: start/end shown, but no program
  // date columns exist and none are added this phase; the listing's own
  // startDate is only ever a source/default for display).
  const estimatedStart = row.opportunityStartDate ?? program.createdAt;
  const estimatedEnd = new Date(estimatedStart.getTime() + program.durationWeeks * 7 * MS_PER_DAY);

  const readOnly = program.status === "completed";

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 sm:px-10 sm:py-14">
      <Link href="/student/internships" className="inline-flex items-center gap-1 text-sm text-navy/55 hover:text-navy">
        <ArrowLeft className="size-3.5" aria-hidden="true" /> All internships
      </Link>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-teal-ink">{row.companyName}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy">{program.role}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-navy/60">
          <span className="inline-flex items-center gap-1.5">
            <Briefcase className="size-3.5" aria-hidden="true" />
            <span className="capitalize">{program.status}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-3.5" aria-hidden="true" />
            {formatRecentDate(estimatedStart)} – {formatRecentDate(estimatedEnd)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <User2 className="size-3.5" aria-hidden="true" />
            {supervisorRow?.name ?? "Supervisor not assigned yet"}
          </span>
        </div>
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-navy/10">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "overview" ? `/student/internships/${program.id}` : `/student/internships/${program.id}?tab=${t.key}`}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${tab === t.key ? "border-teal text-teal-ink" : "border-transparent text-navy/50 hover:text-navy"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <div className="mt-6 space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-navy/10 bg-white p-3">
              <p className="text-xs text-navy/50">Progress</p>
              <p className="mt-1 text-lg font-semibold text-navy">
                {progress.tasksDone}/{progress.tasksTotal}
              </p>
              <p className="text-xs text-navy/45">tasks done</p>
            </div>
            <div className="rounded-lg border border-navy/10 bg-white p-3">
              <p className="text-xs text-navy/50">Current week</p>
              <p className="mt-1 text-lg font-semibold text-navy">{progress.currentWeekNumber} of {program.durationWeeks}</p>
            </div>
            <div className="rounded-lg border border-navy/10 bg-white p-3">
              <p className="text-xs text-navy/50">Blocked</p>
              <p className="mt-1 text-lg font-semibold text-navy">{progress.blockedCount}</p>
            </div>
            <div className="rounded-lg border border-navy/10 bg-white p-3">
              <p className="text-xs text-navy/50">Status</p>
              <p className="mt-1 text-lg font-semibold capitalize text-navy">{progress.severity.replace(/_/g, " ")}</p>
            </div>
          </div>

          {currentWeek && (
            <div className="rounded-xl border border-navy/10 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Current focus — Week {currentWeek.weekNumber}</p>
              <p className="mt-1 font-medium text-navy">{currentWeek.title}</p>
              {nextUp && <p className="mt-2 text-sm text-navy/65">Next up: {nextUp.title}</p>}
            </div>
          )}

          {blockedTasks.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Needs attention</p>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {blockedTasks.map((t) => (
                  <li key={t.id}>{t.title}</li>
                ))}
              </ul>
            </div>
          )}

          {feedback.length > 0 && (
            <div className="rounded-xl border border-navy/10 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Recent supervisor feedback</p>
              <p className="mt-1.5 text-sm text-navy/80">&ldquo;{feedback[0].entry.feedback}&rdquo;</p>
              <p className="mt-1 text-xs text-navy/40">— {feedback[0].authorName}</p>
            </div>
          )}

          {verifiedExperience && (
            <div className="rounded-xl border border-teal/30 bg-teal/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-ink">Verified Experience</p>
              <p className="mt-1 text-sm text-navy/75">
                Your completed internship record is ready.{" "}
                <Link href={`/student/applications/${row.applicationId}`} className="inline-flex items-center gap-0.5 font-medium text-teal-ink hover:underline">
                  View <ChevronRight className="size-3" aria-hidden="true" />
                </Link>
              </p>
            </div>
          )}
        </div>
      )}

      {tab === "work" && (
        <div className="mt-6 space-y-4">
          {readOnly && (
            <p className="rounded-lg border border-navy/10 bg-gray-light/60 px-3 py-2 text-sm text-navy/60">
              This internship is complete — work is now a read-only record.
            </p>
          )}
          {weeks.length === 0 ? (
            <p className="text-sm text-navy/50">No weeks set up yet.</p>
          ) : (
            weeks.map((w) => (
              <div key={w.id} className="rounded-xl border border-navy/10 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Week {w.weekNumber}</p>
                <p className="mt-1 font-medium text-navy">{w.title}</p>
                {w.objectives.length > 0 && (
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-navy/65">
                    {w.objectives.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                )}
                {(tasksByWeek.get(w.id) ?? []).length > 0 ? (
                  <ul className="mt-3 border-t border-navy/8">
                    {(tasksByWeek.get(w.id) ?? []).map((t) => (
                      <StudentTaskItem key={t.id} task={t as StudentTask} readOnly={readOnly} />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-navy/45">No tasks yet.</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "timeline" && (
        <div className="mt-6">
          {timeline.length === 0 ? (
            <p className="text-sm text-navy/50">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {timeline.map((e) => (
                <li key={e.id} className="border-l-2 border-teal/30 pl-3">
                  <p className="text-sm text-navy/80">{timelineLabel(e.eventType, e.metadata, taskTitleById, e.entityId)}</p>
                  <p className="text-xs text-navy/40">{formatRecentDate(e.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "checkins" && (
        <div className="mt-6 rounded-xl border border-navy/10 bg-gray-light/40 p-6 text-center">
          <p className="text-sm text-navy/60">Check-ins aren&apos;t available yet. Coming soon.</p>
        </div>
      )}

      {tab === "feedback" && (
        <div className="mt-6">
          {feedback.length === 0 ? (
            <p className="text-sm text-navy/50">No feedback yet.</p>
          ) : (
            <div className="space-y-3">
              {feedback.map((f) => (
                <div key={f.entry.id} className="rounded-xl border border-navy/10 bg-white p-4">
                  <p className="text-xs text-navy/40">
                    {f.authorName}
                    {f.entry.weekId ? ` · Week ${weekNumberById.get(f.entry.weekId)}` : ""} · {formatRecentDate(f.entry.createdAt)}
                  </p>
                  <p className="mt-1.5 text-sm text-navy/80">{f.entry.feedback}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
