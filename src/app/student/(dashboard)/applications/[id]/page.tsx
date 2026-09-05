import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3, ChevronRight, Clock3, FileText, FolderOpen, Lightbulb, ListChecks } from "lucide-react";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { ChallengeSubmissionForm } from "@/components/opportunities/challenge-submission-form";
import { ChallengeResourcesList } from "@/components/opportunities/challenge-resources-list";
import { SubmissionSummary } from "@/components/opportunities/submission-summary";
import { ExpandableText } from "@/components/opportunities/expandable-text";
import { OfferResponseButtons } from "@/components/opportunities/offer-response-buttons";
import { StartChallengeButton } from "@/components/opportunities/start-challenge-button";
import { ChallengeNotes } from "@/components/opportunities/challenge-notes";
import { RubricInline, RubricList } from "@/components/opportunities/rubric-list";
import { deriveGuidanceBullets, firstSentence, summarizeSubmissionRequirements, summarizeTaskTitles } from "@/lib/challenges/summaries";

const WORK_MODE_LABEL: Record<"remote" | "onsite" | "hybrid", string> = {
  remote: "Remote",
  onsite: "On-site",
  hybrid: "Hybrid",
};

/** One icon-circle + heading + body row, reused across the Start Challenge
 * card and (with different content) nowhere else — kept local since it's a
 * single-purpose layout primitive, not a shared design-system component. */
function IconRow({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal/10 text-teal-ink">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="font-medium text-navy">{title}</p>
        <div className="mt-0.5 text-sm leading-6 text-navy/64">{children}</div>
      </div>
    </div>
  );
}

export default async function ApplicationWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireCurrentStudent();
  const db = getDb();

  const [application] = await db
    .select({
      id: schema.applications.id,
      opportunityId: schema.applications.opportunityId,
      challengeStartedAt: schema.applications.challengeStartedAt,
      role: schema.opportunities.role,
      location: schema.opportunities.location,
      workMode: schema.opportunities.workMode,
      companyName: schema.companies.name,
    })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(and(eq(schema.applications.id, id), eq(schema.applications.studentId, user.id)))
    .limit(1);

  if (!application) notFound();

  // Independent of each other (each depends only on application.id /
  // opportunityId, already known) — fetched together instead of as three
  // serial round trips.
  const [[offer], [challengeRow], [latestSubmission]] = await Promise.all([
    db.select().from(schema.internshipOffers).where(eq(schema.internshipOffers.applicationId, application.id)).limit(1),
    db.select().from(schema.challenges).where(eq(schema.challenges.opportunityId, application.opportunityId)).limit(1),
    db.select().from(schema.submissions).where(eq(schema.submissions.applicationId, application.id)).orderBy(desc(schema.submissions.submittedAt)).limit(1),
  ]);

  const program =
    offer?.status === "accepted"
      ? (
          await db
            .select()
            .from(schema.internshipPrograms)
            .where(eq(schema.internshipPrograms.offerId, offer.id))
            .limit(1)
        )[0]
      : undefined;

  const programWeeks = program
    ? await db
        .select()
        .from(schema.internshipWeeks)
        .where(eq(schema.internshipWeeks.programId, program.id))
        .orderBy(asc(schema.internshipWeeks.weekNumber))
    : [];

  const programWeekIds = programWeeks.map((w) => w.id);
  const programTasks = programWeekIds.length
    ? await db.select().from(schema.internshipTasks).where(inArray(schema.internshipTasks.weekId, programWeekIds))
    : [];
  const tasksByWeek = new Map<string, typeof programTasks>();
  for (const task of programTasks) {
    tasksByWeek.set(task.weekId, [...(tasksByWeek.get(task.weekId) ?? []), task]);
  }

  const programFeedback = program
    ? await db
        .select({ entry: schema.supervisorFeedback, authorName: schema.users.fullName })
        .from(schema.supervisorFeedback)
        .innerJoin(schema.users, eq(schema.supervisorFeedback.authorUserId, schema.users.id))
        .where(eq(schema.supervisorFeedback.programId, program.id))
        .orderBy(desc(schema.supervisorFeedback.createdAt))
    : [];
  const weekNumberById = new Map(programWeeks.map((w) => [w.id, w.weekNumber]));

  const verifiedExperience =
    program?.status === "completed"
      ? (
          await db
            .select()
            .from(schema.verifiedExperience)
            .where(eq(schema.verifiedExperience.programId, program.id))
            .limit(1)
        )[0]
      : undefined;

  // currentVersion (→ challengeResources, a real dependency chain) and
  // submissionArtifactRows depend on different upstream rows already
  // fetched above (challengeRow / latestSubmission) — independent of each
  // other, so they run together instead of serially.
  const [[currentVersion, challengeResources], submissionArtifactRows] = await Promise.all([
    (async () => {
      const version = challengeRow?.currentVersionId
        ? (await db.select().from(schema.challengeVersions).where(eq(schema.challengeVersions.id, challengeRow.currentVersionId)).limit(1))[0]
        : undefined;
      const resources = version ? await db.select().from(schema.challengeResources).where(eq(schema.challengeResources.challengeVersionId, version.id)) : [];
      return [version, resources] as const;
    })(),
    latestSubmission
      ? db.select().from(schema.submissionArtifacts).where(eq(schema.submissionArtifacts.submissionId, latestSubmission.id))
      : Promise.resolve([]),
  ]);

  const challengeStatus: "to_do" | "in_progress" | "submitted" | "reviewed" = latestSubmission
    ? latestSubmission.status === "reviewed"
      ? "reviewed"
      : "submitted"
    : application.challengeStartedAt
      ? "in_progress"
      : "to_do";
  const CHALLENGE_STATUS_LABEL: Record<typeof challengeStatus, { label: string; style: string }> = {
    to_do: { label: "Not started", style: "bg-gray-light text-navy/60" },
    in_progress: { label: "In progress", style: "bg-teal/10 text-teal-ink" },
    submitted: { label: "Submitted", style: "bg-blue-50 text-blue-700" },
    reviewed: { label: "Reviewed", style: "bg-teal/10 text-teal-ink" },
  };

  // Presentational-only (no state) — computed once, referenced twice below:
  // once in the mobile-only interleaved position (between Overview and
  // Tasks), once in the desktop-only right column. Two independent flex
  // columns can't share content at different DOM positions per breakpoint
  // any other way without CSS Grid rows coupling the two columns' heights
  // together (the exact bug being fixed here).
  const resourcesCard = challengeResources.length > 0 && (
    <section className="rounded-2xl border border-black/[0.04] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)]">
      <div className="flex items-center gap-2">
        <FolderOpen className="size-4 text-teal-ink" aria-hidden="true" />
        <h2 className="text-base font-semibold text-navy">Resources</h2>
      </div>
      <p className="mt-0.5 text-xs text-navy/50">Use the resources below to complete the challenge.</p>
      <div className="mt-2">
        <ChallengeResourcesList
          resources={challengeResources.map((r) => ({
            id: r.id,
            name: r.name,
            artifactKind: r.artifactKind,
            resourceType: r.resourceType as "file" | "link",
            generationStatus: r.generationStatus as "pending" | "generating" | "ready" | "failed" | "requires_upload",
            sizeBytes: r.sizeBytes,
          }))}
        />
      </div>
    </section>
  );

  const evaluationCard = currentVersion && currentVersion.rubric.length > 0 && (
    <section className="rounded-2xl border border-black/[0.04] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)]">
      <div className="flex items-center gap-2">
        <BarChart3 className="size-4 text-teal-ink" aria-hidden="true" />
        <h2 className="text-base font-semibold text-navy">Evaluation criteria</h2>
      </div>
      <div className="mt-2">
        <RubricList rubric={currentVersion.rubric} />
      </div>
    </section>
  );

  return (
    <div className="mx-auto max-w-[min(94vw,1440px)] px-6 pt-6 pb-10 sm:px-10 sm:pt-7 sm:pb-14 lg:px-12">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-navy/45">
        <Link href="/student/applications" className="hover:text-navy/70 hover:underline">Applications</Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span className="text-navy/55">{application.companyName}</span>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span className={currentVersion ? "truncate text-navy/55" : "truncate text-navy/60"}>{application.role}</span>
        {currentVersion && (
          <>
            <ChevronRight className="size-3.5" aria-hidden="true" />
            <span className="truncate text-navy/60">
              {application.challengeStartedAt || latestSubmission ? currentVersion.title : "Start Challenge"}
            </span>
          </>
        )}
      </nav>

      {offer && (
        <div className="mt-6 border border-teal/30 bg-teal/5 p-5">
          {offer.status === "pending" ? (
            <>
              <p className="font-medium text-navy">
                {application.companyName} has invited you to an internship!
              </p>
              <p className="mt-1 text-sm text-navy/68">
                Review the role and let them know if you&apos;d like to accept.
              </p>
              <OfferResponseButtons applicationId={application.id} />
            </>
          ) : offer.status === "accepted" ? (
            <p className="font-medium text-navy">
              You accepted this internship offer from {application.companyName}.
            </p>
          ) : (
            <p className="font-medium text-navy">
              You declined this internship offer from {application.companyName}.
            </p>
          )}
        </div>
      )}

      {verifiedExperience && (
        <div className="mt-6 border border-teal/30 bg-teal/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-ink">Verified Experience</p>
          <h2 className="mt-1 text-lg font-bold text-navy">
            {application.companyName} — {application.role}, {program?.durationWeeks} weeks — Verified
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
      )}

      {program && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-navy">Your internship program</h2>
          <p className="mt-1 text-sm text-navy/68">
            {program.durationWeeks} weeks · {program.hoursPerWeek}h/week
          </p>
          <div className="mt-4 space-y-3">
            {programWeeks.map((w) => (
              <div key={w.id} className="border border-navy/12 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Week {w.weekNumber}</p>
                <p className="mt-1 font-medium text-navy">{w.title}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-navy/68">
                  {w.objectives.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
                {(tasksByWeek.get(w.id) ?? []).length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-navy/12 pt-3">
                    {(tasksByWeek.get(w.id) ?? []).map((t) => (
                      <li key={t.id} className="flex items-center justify-between text-sm">
                        <span className={t.status === "done" ? "text-navy/40 line-through" : "text-navy/80"}>
                          {t.title}
                        </span>
                        <span className="rounded-full bg-gray-light px-2 py-0.5 text-xs capitalize text-navy/68">
                          {t.status.replace(/_/g, " ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {programFeedback.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-navy/50">Feedback</h3>
              <div className="mt-3 space-y-3">
                {programFeedback.map((f) => (
                  <div key={f.entry.id} className="border border-navy/12 bg-white p-3">
                    <p className="text-xs text-navy/40">
                      {f.authorName}
                      {f.entry.weekId ? ` · Week ${weekNumberById.get(f.entry.weekId)}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-navy/80">{f.entry.feedback}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!currentVersion ? (
        <p className="mt-6 text-navy/68">
          This Challenge isn&apos;t published yet — check back soon.
        </p>
      ) : !application.challengeStartedAt && !latestSubmission ? (
        <div className="mx-auto mt-6 max-w-[800px] rounded-2xl border border-black/[0.04] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)] sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-base font-semibold text-teal-ink">
              {application.companyName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-navy">{application.companyName}</p>
              <p className="text-sm text-navy/58">{application.role}</p>
            </div>
          </div>

          <h1 className="mt-5 text-balance text-3xl font-bold tracking-[-0.02em] text-navy">{currentVersion.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-navy/56">
            <span className="flex items-center gap-1.5"><Clock3 className="size-4" aria-hidden="true" />{currentVersion.estimatedDurationLabel ?? `~${currentVersion.estimatedMinutes} minutes`}</span>
            <span className="flex items-center gap-1.5"><ListChecks className="size-4" aria-hidden="true" />{currentVersion.tasks.length} {currentVersion.tasks.length === 1 ? "task" : "tasks"}</span>
            <span className="rounded-full bg-gray-light px-2.5 py-0.5 text-xs font-medium text-navy/55">Not started</span>
          </div>

          <p className="mt-4 text-[15px] leading-6 text-navy/70">{firstSentence(currentVersion.scenario)}</p>

          <hr className="my-5 border-navy/8" />
          <IconRow icon={FileText} title="What you'll do">
            {summarizeTaskTitles(currentVersion.tasks)}
          </IconRow>

          <hr className="my-5 border-navy/8" />
          <IconRow icon={FileText} title="What you'll submit">
            {summarizeSubmissionRequirements(currentVersion.submissionRequirements)}
          </IconRow>

          {currentVersion.rubric.length > 0 && (
            <>
              <hr className="my-5 border-navy/8" />
              <IconRow icon={BarChart3} title="How it will be evaluated">
                <RubricInline rubric={currentVersion.rubric} />
              </IconRow>
            </>
          )}

          <hr className="my-5 border-navy/8" />
          <div className="flex flex-col items-center gap-2.5">
            <StartChallengeButton applicationId={application.id} className="h-12 px-8 text-base" />
            <Link href="/student/opportunities" className="text-sm text-navy/50 hover:text-navy hover:underline">
              View internship
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(420px,1fr)] lg:items-start">
          {/* LEFT column — its own independent vertical stack. Nothing in
              the right column can ever push these cards down, and vice
              versa: the two columns share no grid row. */}
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-base font-semibold text-teal-ink">
                  {application.companyName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-navy/70">{application.companyName}</p>
                  <p className="text-sm text-navy/55">
                    {application.role}
                    {application.location ? ` · ${application.location}` : ""}
                    {application.workMode ? ` · ${WORK_MODE_LABEL[application.workMode]}` : ""}
                  </p>
                </div>
              </div>

              <h1 className="mt-2 text-balance text-3xl font-bold tracking-[-0.02em] text-navy sm:text-4xl">{currentVersion.title}</h1>
              <p className="mt-1 text-sm leading-6 text-navy/60">{firstSentence(currentVersion.scenario)}</p>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-navy/56">
                <span className="flex items-center gap-1.5"><Clock3 className="size-4" aria-hidden="true" />{currentVersion.estimatedDurationLabel ?? `~${currentVersion.estimatedMinutes} minutes`}</span>
                <span className="flex items-center gap-1.5"><ListChecks className="size-4" aria-hidden="true" />{currentVersion.tasks.length} {currentVersion.tasks.length === 1 ? "task" : "tasks"}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CHALLENGE_STATUS_LABEL[challengeStatus].style}`}>
                  {CHALLENGE_STATUS_LABEL[challengeStatus].label}
                </span>
              </div>
            </div>

            <section className="rounded-2xl border border-black/[0.04] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)]">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-teal-ink" aria-hidden="true" />
                <h2 className="text-base font-semibold text-navy">Challenge overview</h2>
              </div>
              <div className="mt-2">
                <ExpandableText text={currentVersion.scenario} />
              </div>
            </section>

            {/* Mobile-only: Resources + Evaluation interleaved here, between
                Overview and Tasks. Hidden on desktop, where the same cards
                render once in the right column below. */}
            {(resourcesCard || evaluationCard) && (
              <div className="flex flex-col gap-4 lg:hidden">
                {resourcesCard}
                {evaluationCard}
              </div>
            )}

            <section className="rounded-2xl border border-black/[0.04] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ListChecks className="size-4 text-teal-ink" aria-hidden="true" />
                  <h2 className="text-base font-semibold text-navy">Tasks</h2>
                </div>
                <span className="shrink-0 text-xs text-navy/45">
                  {currentVersion.tasks.length} {currentVersion.tasks.length === 1 ? "task" : "tasks"} · {currentVersion.estimatedDurationLabel ?? `~${currentVersion.estimatedMinutes} minutes`} total
                </span>
              </div>
              <div className="mt-2 divide-y divide-navy/8">
                {currentVersion.tasks.map((task, index) => (
                  <div key={task.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal/10 text-xs font-semibold text-teal-ink">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-navy">{task.title}</p>
                        <span className="shrink-0 text-xs text-navy/40">~{Math.round(currentVersion.estimatedMinutes / currentVersion.tasks.length)}min</span>
                      </div>
                      <p className="mt-0.5 text-sm leading-6 text-navy/60">{task.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-black/[0.04] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)]">
              <div className="flex items-center gap-2">
                <Lightbulb className="size-4 text-teal-ink" aria-hidden="true" />
                <h2 className="text-base font-semibold text-navy">What to keep in mind</h2>
              </div>
              <ul className="mt-2 space-y-1.5">
                {deriveGuidanceBullets(currentVersion.rubric, currentVersion.submissionRequirements).map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-sm leading-6 text-navy/68">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal-ink" aria-hidden="true" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>

            {latestSubmission && (
              <section>
                <h2 className="text-base font-semibold text-navy">Your submission</h2>
                <SubmissionSummary
                  submission={{ status: latestSubmission.status, submittedAt: latestSubmission.submittedAt }}
                  offer={offer ? { status: offer.status } : null}
                  artifacts={submissionArtifactRows}
                  deliverables={currentVersion.submissionRequirements.map((r) => r.label)}
                />
              </section>
            )}
          </div>

          {/* RIGHT column — its own independent vertical stack. On mobile
              only Submission + Private notes render here (Resources/
              Evaluation are hidden here and shown in their mobile-only
              position in the left column above instead). */}
          <div className="flex flex-col gap-4">
            <div className="hidden lg:flex lg:flex-col lg:gap-4">
              {resourcesCard}
              {evaluationCard}
            </div>

            {!latestSubmission && (
              <ChallengeSubmissionForm applicationId={application.id} requirements={currentVersion.submissionRequirements} />
            )}

            <div className="border-t border-navy/8 pt-3">
              <ChallengeNotes applicationId={application.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
