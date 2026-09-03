import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { getOpportunitiesWithMatch, getPublishedChallengeInfo } from "@/lib/opportunities/browse";
import { getSavedOpportunityIds } from "@/lib/opportunities/saved";
import { getChallengeState } from "@/lib/opportunities/challenge-state";
import { getProfileCompletion } from "@/lib/profile-completion";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ChevronRight } from "lucide-react";

/**
 * One actionable item for "Needs your attention" — every entry here is
 * something the student can actually act on right now (an offer to
 * respond to, a challenge to start or finish). A passive status change
 * ("moved to Under review") is real information but not an action, so it
 * belongs on the Applications page's status list, not here — this section
 * exists to answer "what should I DO right now", not "what happened".
 */
type AttentionItem = { key: string; role: string; companyName: string; description: string; ctaLabel: string; href: string };

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
  const applicationByOpportunityId = new Map(applications.map((a) => [a.opportunityId, a]));
  const appliedOpportunityIds = new Set(applications.map((a) => a.opportunityId));

  const [{ opportunities, hasMatchData }, publishedChallengeInfo, savedIds] = await Promise.all([
    getOpportunitiesWithMatch(user.id),
    getPublishedChallengeInfo(),
    getSavedOpportunityIds(user.id),
  ]);

  const applicationsWithChallengeState = applications.map((a) => ({
    application: a,
    challengeState: getChallengeState({
      challengePublished: publishedChallengeInfo.has(a.opportunityId),
      application: a,
      submission: submissionByApplicationId.get(a.id),
    }),
  }));

  const profileCompletion = getProfileCompletion(profile);

  // An active internship outranks everything else in "what matters right
  // now" — if one exists it gets its own dedicated entry point, separate
  // from the Needs your attention / Recommended flow below.
  const acceptedOffer = offers.find((o) => o.status === "accepted");
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

  // Needs your attention: real, actionable items only — a pending offer to
  // respond to, or a challenge not yet finished. Capped short; this is a
  // short list of what to do next, not a restatement of every application.
  const attentionItems: AttentionItem[] = [];
  for (const offer of offers) {
    if (offer.status !== "pending") continue;
    const application = applications.find((a) => a.id === offer.applicationId);
    if (!application) continue;
    attentionItems.push({
      key: `offer-${offer.id}`,
      role: application.role,
      companyName: application.companyName,
      description: "Offer received",
      ctaLabel: "View offer",
      href: `/student/applications/${application.id}`,
    });
  }
  for (const x of applicationsWithChallengeState) {
    if (x.challengeState.kind === "in_progress") {
      attentionItems.push({
        key: `inprogress-${x.application.id}`,
        role: x.application.role,
        companyName: x.application.companyName,
        description: "Challenge in progress",
        ctaLabel: "Continue challenge",
        href: `/student/applications/${x.application.id}`,
      });
    }
  }
  for (const x of applicationsWithChallengeState) {
    if (x.challengeState.kind === "to_do") {
      attentionItems.push({
        key: `todo-${x.application.id}`,
        role: x.application.role,
        companyName: x.application.companyName,
        description: "Challenge not started",
        ctaLabel: "Start challenge",
        href: `/student/applications/${x.application.id}`,
      });
    }
  }
  const visibleAttentionItems = attentionItems.slice(0, 4);

  // Recommended: opportunities the student hasn't already applied to — an
  // active application already has its own entry point above, so the same
  // role never shows twice with two different meanings.
  const notApplied = opportunities.filter((o) => !appliedOpportunityIds.has(o.id));
  const recommended = (hasMatchData ? notApplied : [...notApplied].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())).slice(0, 6);

  const savedOpportunities = opportunities.filter((o) => savedIds.has(o.id)).slice(0, 3);

  let profileNudge: { title: string; description: string; ctaLabel: string; href: string } | undefined;
  if (profileCompletion.percent < 100) {
    profileNudge = {
      title: "Complete your profile",
      description: `Add your ${profileCompletion.missing[0]?.toLowerCase() ?? "remaining details"} to improve recommendations.`,
      ctaLabel: "Complete profile",
      href: "/student/profile",
    };
  } else if (applications.length === 0) {
    profileNudge = {
      title: "Ready to get started?",
      description: "Browse open opportunities and apply to your first role.",
      ctaLabel: "Browse opportunities",
      href: "/student/opportunities",
    };
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <header className="max-w-2xl">
        <h1 className="text-balance text-2xl font-semibold tracking-[-0.03em] text-navy sm:text-3xl">Opportunities for you</h1>
        <p className="mt-2 text-sm leading-6 text-navy/60">Discover internships based on your interests, skills, and experience.</p>
      </header>

      {activeProgramSummary && (
        <section aria-labelledby="current-internship-heading" className="mt-8">
          <Card className="gap-0 bg-teal/5 py-0 ring-teal/20">
            <CardContent className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="min-w-0">
                <p id="current-internship-heading" className="text-sm font-medium text-teal-ink">Current internship</p>
                <h2 className="mt-1 text-lg font-semibold text-navy">{activeProgramSummary.role}</h2>
                <p className="mt-1 text-sm text-navy/58">
                  {activeProgramSummary.companyName} · Week {activeProgramSummary.currentWeek} of {activeProgramSummary.totalWeeks}
                </p>
              </div>
              <Button
                render={<Link href="/student/internships" />}
                nativeButton={false}
                className="h-9 w-full bg-teal px-4 text-white hover:bg-teal/90 sm:w-auto"
              >
                Open workspace
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {visibleAttentionItems.length > 0 && (
        <section aria-labelledby="attention-heading" className="mt-10 max-w-4xl">
          <h2 id="attention-heading" className="text-lg font-semibold tracking-[-0.02em] text-navy">Needs your attention</h2>
          <Card className="mt-4 gap-0 divide-y divide-navy/8 py-0">
            {visibleAttentionItems.map((item) => (
              <div
                key={item.key}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy">{item.role}</p>
                  <p className="mt-0.5 truncate text-sm text-navy/55">{item.companyName} · {item.description}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={item.href} />}
                  nativeButton={false}
                  className="w-full border-teal/25 text-teal-ink hover:bg-teal/5 sm:w-auto"
                >
                  {item.ctaLabel}
                </Button>
              </div>
            ))}
          </Card>
        </section>
      )}

      <section
        aria-labelledby="recommended-heading"
        className={activeProgramSummary || visibleAttentionItems.length > 0 ? "mt-12" : "mt-9"}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="recommended-heading" className="text-xl font-semibold tracking-[-0.02em] text-navy">Recommended for you</h2>
          <Link
            href="/student/opportunities"
            className="flex shrink-0 items-center gap-1 rounded-sm text-sm font-medium text-teal-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
          >
            View all
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        {recommended.length === 0 ? (
          <p className="mt-6 text-navy/68">
            {opportunities.length === 0
              ? "No published opportunities yet. Companies are still building challenges. Check back soon."
              : "You've applied to everything that's currently open. Check back soon for more."}
          </p>
        ) : (
          <ul className="-mx-4 mt-5 grid snap-x snap-mandatory grid-flow-col auto-cols-[minmax(18rem,calc(100vw-3rem))] gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:auto-cols-[23rem] sm:px-6 lg:-mx-8 lg:px-8">
            {recommended.map((o) => (
              <li key={o.id} className="snap-start">
                <OpportunityCard
                  opportunity={o}
                  skills={o.skills}
                  saved={savedIds.has(o.id)}
                  estimatedMinutes={publishedChallengeInfo.get(o.id)?.estimatedMinutes}
                  matchScore={o.matchScore}
                  className="h-full"
                  challengeState={getChallengeState({
                    challengePublished: publishedChallengeInfo.has(o.id),
                    application: applicationByOpportunityId.get(o.id),
                    submission: undefined,
                  })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {savedOpportunities.length > 0 && (
        <section aria-labelledby="saved-heading" className="mt-10 max-w-4xl">
          <div className="flex items-center justify-between">
            <h2 id="saved-heading" className="text-lg font-semibold tracking-[-0.02em] text-navy">Saved for later</h2>
            <Link href="/student/opportunities?saved=1" className="flex items-center rounded-sm text-sm font-medium text-teal-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
              View all
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          <ul className="mt-3 border-y border-navy/10">
            {savedOpportunities.map((o) => (
              <li key={o.id} className="border-b border-navy/8 last:border-b-0">
                <Link
                  href={`/opportunities/${o.id}`}
                  className="flex items-center justify-between gap-4 px-1 py-4 hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-navy">{o.role}</span>
                    <span className="block truncate text-xs text-navy/50">{o.companyName}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-navy/35" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {profileNudge && (
        <div className="mt-10 flex max-w-4xl flex-col gap-4 border-t border-navy/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-navy">{profileNudge.title}</p>
            <p className="mt-0.5 text-sm text-navy/60">{profileNudge.description}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            render={<Link href={profileNudge.href} />}
            nativeButton={false}
            className="w-full sm:w-auto"
          >
            {profileNudge.ctaLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
