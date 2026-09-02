import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { getOpportunitiesWithMatch, getPublishedChallengeInfo, countCreatedWithinMs } from "@/lib/opportunities/browse";
import { getSavedOpportunityIds } from "@/lib/opportunities/saved";
import { getChallengeState } from "@/lib/opportunities/challenge-state";
import { getApplicationStageIndex } from "@/lib/opportunities/application-stage";
import { getProfileCompletion } from "@/lib/profile-completion";
import { relativeTime } from "@/lib/relative-time";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { StudentPageHeader } from "@/components/dashboard/student-page-header";
import { ArrowRight, ChevronRight } from "lucide-react";

function StatCell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-navy/40">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-lg font-semibold tabular-nums tracking-[-0.01em] text-navy">{value}</span>
        {hint && <span className="truncate text-xs text-navy/45">{hint}</span>}
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
      university: schema.studentProfiles.university,
      major: schema.studentProfiles.major,
      graduationYear: schema.studentProfiles.graduationYear,
      location: schema.studentProfiles.location,
      skills: schema.studentProfiles.skills,
      interests: schema.studentProfiles.interests,
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
      challengeStartedAt: schema.applications.challengeStartedAt,
      createdAt: schema.applications.createdAt,
      updatedAt: schema.applications.updatedAt,
      role: schema.opportunities.role,
      companyName: schema.companies.name,
    })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(eq(schema.applications.studentId, user.id));

  const applicationIds = applications.map((a) => a.id);
  const submissions = applicationIds.length
    ? await db
        .select({ id: schema.submissions.id, applicationId: schema.submissions.applicationId })
        .from(schema.submissions)
        .where(inArray(schema.submissions.applicationId, applicationIds))
    : [];
  const submissionIds = submissions.map((s) => s.id);
  const evidenceRows = submissionIds.length
    ? await db
        .select({ submissionId: schema.candidateEvidence.submissionId })
        .from(schema.candidateEvidence)
        .where(inArray(schema.candidateEvidence.submissionId, submissionIds))
    : [];
  const evidencedSubmissionIds = new Set(evidenceRows.map((e) => e.submissionId));
  const offers = applicationIds.length
    ? await db
        .select({ id: schema.internshipOffers.id, applicationId: schema.internshipOffers.applicationId, status: schema.internshipOffers.status })
        .from(schema.internshipOffers)
        .where(inArray(schema.internshipOffers.applicationId, applicationIds))
    : [];

  const submissionByApplicationId = new Map(
    submissions.map((s) => [s.applicationId, { hasEvidence: evidencedSubmissionIds.has(s.id) }]),
  );
  const offerByApplicationId = new Map(offers.map((o) => [o.applicationId, o]));
  const applicationByOpportunityId = new Map(applications.map((a) => [a.opportunityId, a]));
  const appliedOpportunityIds = new Set(applications.map((a) => a.opportunityId));

  const [{ opportunities, hasMatchData }, publishedChallengeInfo, savedIds] = await Promise.all([
    getOpportunitiesWithMatch(user.id),
    getPublishedChallengeInfo(),
    getSavedOpportunityIds(user.id),
  ]);

  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = countCreatedWithinMs(opportunities, oneWeekMs);

  const inReviewCount = applications.filter((a) => {
    const idx = getApplicationStageIndex({
      status: a.status,
      hasSubmission: submissionByApplicationId.has(a.id),
      hasOffer: offerByApplicationId.has(a.id),
    });
    return idx === 1 || idx === 2;
  }).length;

  const applicationsWithChallengeState = applications.map((a) => ({
    application: a,
    challengeState: getChallengeState({
      challengePublished: publishedChallengeInfo.has(a.opportunityId),
      application: a,
      submission: submissionByApplicationId.get(a.id),
    }),
  }));

  const activeChallengesCount = applicationsWithChallengeState.filter(
    (x) => x.challengeState.kind === "to_do" || x.challengeState.kind === "in_progress",
  ).length;

  const profileCompletion = getProfileCompletion(profile);

  // "Continue where you left off": an active internship outranks an active
  // challenge, which outranks nothing at all — never manufactured.
  const acceptedOffer = offers.find((o) => o.status === "accepted");
  const inProgressChallenge = applicationsWithChallengeState.find((x) => x.challengeState.kind === "in_progress");
  const toDoChallenge = applicationsWithChallengeState.find((x) => x.challengeState.kind === "to_do");
  const continueItem = inProgressChallenge ?? toDoChallenge;

  let activeProgramSummary:
    | { role: string; companyName: string; applicationId: string; currentWeek: number; totalWeeks: number }
    | undefined;
  if (acceptedOffer) {
    const [program] = await db
      .select({ id: schema.internshipPrograms.id, durationWeeks: schema.internshipPrograms.durationWeeks })
      .from(schema.internshipPrograms)
      .where(eq(schema.internshipPrograms.offerId, acceptedOffer.id))
      .limit(1);
    const application = applications.find((a) => a.id === acceptedOffer.applicationId);
    if (program && application) {
      const weeks = await db
        .select({ id: schema.internshipWeeks.id, weekNumber: schema.internshipWeeks.weekNumber })
        .from(schema.internshipWeeks)
        .where(eq(schema.internshipWeeks.programId, program.id));
      const weekIds = weeks.map((w) => w.id);
      const tasks = weekIds.length
        ? await db.select({ weekId: schema.internshipTasks.weekId, status: schema.internshipTasks.status }).from(schema.internshipTasks).where(inArray(schema.internshipTasks.weekId, weekIds))
        : [];
      // Real current week: derived from actual task completion, not fabricated —
      // the first week that isn't fully done, or the last week if everything is.
      const sortedWeeks = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber);
      const firstIncomplete = sortedWeeks.find((w) => tasks.some((t) => t.weekId === w.id && t.status !== "done"));
      const currentWeek = firstIncomplete?.weekNumber ?? sortedWeeks[sortedWeeks.length - 1]?.weekNumber ?? 1;

      activeProgramSummary = {
        role: application.role,
        companyName: application.companyName,
        applicationId: application.id,
        currentWeek,
        totalWeeks: program.durationWeeks,
      };
    }
  }

  // Recommended: opportunities the student hasn't already applied to — the
  // applied+active case is covered by "Continue where you left off" instead,
  // so the same role never shows twice with two different meanings.
  const notApplied = opportunities.filter((o) => !appliedOpportunityIds.has(o.id));
  const recommended = (hasMatchData ? notApplied : [...notApplied].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())).slice(0, 6);

  const savedOpportunities = opportunities.filter((o) => savedIds.has(o.id)).slice(0, 3);

  // Real status changes only — createdAt/updatedAt more than a minute apart
  // means something actually moved, not just the insert timestamp.
  const recentUpdates = applications
    .filter((a) => a.updatedAt.getTime() - a.createdAt.getTime() > 60_000)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 3);

  let nextStep: { title: string; description: string; ctaLabel: string; href: string } | undefined;
  if (profileCompletion.percent < 100) {
    nextStep = {
      title: `Your profile is ${profileCompletion.percent}% complete`,
      description: `Add your ${profileCompletion.missing[0]?.toLowerCase() ?? "remaining details"} to improve recommendations.`,
      ctaLabel: "Complete profile",
      href: "/student/profile",
    };
  } else if (applications.length === 0) {
    nextStep = {
      title: "Ready to get started?",
      description: "Browse open opportunities and apply to your first role.",
      ctaLabel: "Browse opportunities",
      href: "/student/opportunities",
    };
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <StudentPageHeader
        eyebrow="For You"
        title="For You"
        description="Internships matched to your interests and experience."
      />

      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-navy/10 bg-navy/10 sm:grid-cols-4">
        <StatCell
          label="Applications"
          value={String(applications.length)}
          hint={inReviewCount > 0 ? `${inReviewCount} in review` : undefined}
        />
        <StatCell
          label="Open opportunities"
          value={String(opportunities.length)}
          hint={newThisWeek > 0 ? `${newThisWeek} new this week` : undefined}
        />
        <StatCell label="Active challenges" value={String(activeChallengesCount)} />
        <StatCell label="Profile completion" value={`${profileCompletion.percent}%`} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="@container min-w-0">
          {(activeProgramSummary || continueItem) && (
            <div className="rounded-xl border border-teal/30 bg-teal/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-ink">Continue where you left off</p>
              {activeProgramSummary ? (
                <>
                  <h2 className="mt-1.5 text-lg font-semibold text-navy">
                    {activeProgramSummary.companyName} — {activeProgramSummary.role}
                  </h2>
                  <p className="mt-1 text-sm text-navy/60">
                    Week {activeProgramSummary.currentWeek} of {activeProgramSummary.totalWeeks}
                  </p>
                  <Link
                    href={`/student/applications/${activeProgramSummary.applicationId}`}
                    className="mt-4 inline-flex rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal/90"
                  >
                    Go to your internship
                  </Link>
                </>
              ) : continueItem ? (
                <>
                  <h2 className="mt-1.5 text-lg font-semibold text-navy">
                    {continueItem.application.companyName} — {continueItem.application.role}
                  </h2>
                  <p className="mt-1 text-sm text-navy/60">
                    {continueItem.challengeState.kind === "in_progress" ? "Challenge in progress" : "Challenge not started yet"}
                  </p>
                  <Link
                    href={`/student/applications/${continueItem.application.id}`}
                    className="mt-4 inline-flex rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal/90"
                  >
                    {continueItem.challengeState.kind === "in_progress" ? "Continue challenge" : "Start challenge"}
                  </Link>
                </>
              ) : null}
            </div>
          )}

          <div className={activeProgramSummary || continueItem ? "mt-10" : ""}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-navy">Recommended opportunities</h2>
                <p className="mt-1 text-sm text-navy/60">Companies care about what you can do. Show them.</p>
              </div>
              <Link
                href="/student/opportunities"
                className="flex shrink-0 items-center gap-1 text-sm font-medium text-teal-ink hover:underline"
              >
                View all opportunities
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>

            {recommended.length === 0 ? (
              <p className="mt-6 text-navy/68">
                {opportunities.length === 0
                  ? "No published opportunities yet. Companies are still building challenges — check back soon."
                  : "You've applied to everything that's currently open — nice work. Check back soon for more."}
              </p>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-5 @2xl:grid-cols-2 @6xl:grid-cols-3">
                {recommended.map((o) => (
                  <OpportunityCard
                    key={o.id}
                    opportunity={o}
                    skills={o.skills}
                    saved={savedIds.has(o.id)}
                    estimatedMinutes={publishedChallengeInfo.get(o.id)?.estimatedMinutes}
                    matchScore={o.matchScore}
                    challengeState={getChallengeState({
                      challengePublished: publishedChallengeInfo.has(o.id),
                      application: applicationByOpportunityId.get(o.id),
                      submission: undefined,
                    })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          {nextStep && (
            <div className="rounded-xl border border-navy/10 bg-white p-5">
              <p className="text-sm font-semibold text-navy">Next step</p>
              <p className="mt-2 text-sm font-medium text-navy">{nextStep.title}</p>
              <p className="mt-1 text-sm text-navy/60">{nextStep.description}</p>
              <Link
                href={nextStep.href}
                className="mt-4 inline-flex rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal/90"
              >
                {nextStep.ctaLabel}
              </Link>
            </div>
          )}

          {savedOpportunities.length > 0 && (
            <div className="rounded-xl border border-navy/10 bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-navy">Saved ({savedOpportunities.length})</p>
                <Link href="/student/opportunities?saved=1" className="flex items-center text-xs font-medium text-teal-ink hover:underline">
                  View all
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
              <ul className="mt-3 space-y-3">
                {savedOpportunities.map((o) => (
                  <li key={o.id}>
                    <Link href={`/opportunities/${o.id}`} className="block hover:text-teal-ink">
                      <p className="text-sm font-medium text-navy">{o.role}</p>
                      <p className="text-xs text-navy/50">{o.companyName}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recentUpdates.length > 0 && (
            <div className="rounded-xl border border-navy/10 bg-white p-5">
              <p className="text-sm font-semibold text-navy">Application updates</p>
              <ul className="mt-3 space-y-3">
                {recentUpdates.map((a) => {
                  const stageIdx = getApplicationStageIndex({
                    status: a.status,
                    hasSubmission: submissionByApplicationId.has(a.id),
                    hasOffer: offerByApplicationId.has(a.id),
                  });
                  const stageLabel = ["Applied", "Challenge submitted", "Under review", "Interview", "Offer"][stageIdx];
                  return (
                    <li key={a.id}>
                      <Link href={`/student/applications/${a.id}`} className="block hover:text-teal-ink">
                        <p className="text-sm text-navy">
                          {a.role} at {a.companyName} moved to <span className="font-medium">{stageLabel}</span>
                        </p>
                        <p className="text-xs text-navy/40">{relativeTime(a.updatedAt)}</p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
