import { notFound } from "next/navigation";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { ChallengeSubmissionForm } from "@/components/opportunities/challenge-submission-form";
import { ChallengeResourcesList } from "@/components/opportunities/challenge-resources-list";
import { SubmissionSummary } from "@/components/opportunities/submission-summary";
import { OfferResponseButtons } from "@/components/opportunities/offer-response-buttons";
import { StartChallengeButton } from "@/components/opportunities/start-challenge-button";

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
      companyName: schema.companies.name,
    })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(and(eq(schema.applications.id, id), eq(schema.applications.studentId, user.id)))
    .limit(1);

  if (!application) notFound();

  const [offer] = await db
    .select()
    .from(schema.internshipOffers)
    .where(eq(schema.internshipOffers.applicationId, application.id))
    .limit(1);

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

  const [challengeRow] = await db
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.opportunityId, application.opportunityId))
    .limit(1);

  const currentVersion = challengeRow?.currentVersionId
    ? (
        await db
          .select()
          .from(schema.challengeVersions)
          .where(eq(schema.challengeVersions.id, challengeRow.currentVersionId))
          .limit(1)
      )[0]
    : undefined;

  const [latestSubmission] = await db
    .select()
    .from(schema.submissions)
    .where(eq(schema.submissions.applicationId, application.id))
    .orderBy(desc(schema.submissions.submittedAt))
    .limit(1);

  const challengeResources = currentVersion
    ? await db
        .select()
        .from(schema.challengeResources)
        .where(eq(schema.challengeResources.challengeVersionId, currentVersion.id))
    : [];

  const submissionArtifactRows = latestSubmission
    ? await db
        .select()
        .from(schema.submissionArtifacts)
        .where(eq(schema.submissionArtifacts.submissionId, latestSubmission.id))
    : [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">
        {application.companyName} · {application.role}
      </p>

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
      ) : (
        <>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.04em] text-navy">
            {currentVersion.title}
          </h1>
          <p className="mt-2 text-sm text-navy/68">
            ~{currentVersion.estimatedMinutes} minutes
          </p>

          {challengeResources.length > 0 && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-navy">Resources provided</h2>
              <ChallengeResourcesList
                resources={challengeResources.map((r) => ({
                  id: r.id,
                  name: r.name,
                  artifactKind: r.artifactKind,
                  resourceType: r.resourceType as "file" | "link",
                  generationStatus: r.generationStatus as "pending" | "generating" | "ready" | "failed" | "requires_upload",
                }))}
              />
            </div>
          )}

          {!application.challengeStartedAt && !latestSubmission ? (
            <div className="mt-6 border border-navy/12 bg-white p-5">
              <p className="whitespace-pre-wrap text-navy/80">{currentVersion.scenario}</p>
              <p className="mt-4 text-sm text-navy/50">
                {currentVersion.tasks.length} tasks · ~{currentVersion.estimatedMinutes} minutes
              </p>
              <div className="mt-4">
                <StartChallengeButton applicationId={application.id} />
              </div>
            </div>
          ) : (
            <>
              <p className="mt-6 whitespace-pre-wrap text-navy/80">{currentVersion.scenario}</p>

              <h2 className="mt-8 text-lg font-semibold text-navy">Tasks</h2>
              <ul className="mt-3 space-y-3">
                {currentVersion.tasks.map((task) => (
                  <li key={task.id} className="border border-navy/12 bg-white p-4">
                    <p className="font-medium text-navy">{task.title}</p>
                    <p className="mt-1 text-sm text-navy/68">{task.description}</p>
                  </li>
                ))}
              </ul>
            </>
          )}

          {latestSubmission ? (
            <>
              <h2 className="mt-8 text-lg font-semibold text-navy">Submission</h2>
              <SubmissionSummary
                submission={{ status: latestSubmission.status, submittedAt: latestSubmission.submittedAt }}
                offer={offer ? { status: offer.status } : null}
                artifacts={submissionArtifactRows}
              />
            </>
          ) : application.challengeStartedAt ? (
            <>
              <h2 className="mt-8 text-lg font-semibold text-navy">Submission requirements</h2>
              <ChallengeSubmissionForm applicationId={application.id} requirements={currentVersion.submissionRequirements} />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
