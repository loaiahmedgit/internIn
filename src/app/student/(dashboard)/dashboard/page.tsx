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
import { StudentPageHeader } from "@/components/dashboard/student-page-header";
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
    <div className="@container mx-auto max-w-4xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <StudentPageHeader
        eyebrow="For You"
        title="For You"
        description="Internships matched to your interests and experience."
      />

      {activeProgramSummary && (
        <div className="mt-8 rounded-xl border border-teal/30 bg-teal/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-ink">Current internship</p>
          <h2 className="mt-1.5 text-lg font-semibold text-navy">
            {activeProgramSummary.role} · {activeProgramSummary.companyName}
          </h2>
          <p className="mt-1 text-sm text-navy/60">
            Week {activeProgramSummary.currentWeek} of {activeProgramSummary.totalWeeks}
          </p>
          <Link
            href={`/student/applications/${activeProgramSummary.applicationId}`}
            className="mt-4 inline-flex rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal/90"
          >
            Open internship workspace
          </Link>
        </div>
      )}

      {visibleAttentionItems.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy/50">Needs your attention</h2>
          <div className="mt-3 space-y-2">
            {visibleAttentionItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-4 rounded-xl border border-navy/10 bg-white px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy">
                    {item.role} · {item.companyName}
                  </p>
                  <p className="mt-0.5 text-sm text-teal-ink">{item.description}</p>
                </div>
                <Link
                  href={item.href}
                  className="shrink-0 rounded-lg border border-teal/30 px-3.5 py-1.5 text-sm font-medium text-teal-ink transition-colors hover:bg-teal/5"
                >
                  {item.ctaLabel}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={activeProgramSummary || visibleAttentionItems.length > 0 ? "mt-10" : "mt-8"}>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-navy">Recommended for you</h2>
          <Link
            href="/student/opportunities"
            className="flex shrink-0 items-center gap-1 text-sm font-medium text-teal-ink hover:underline"
          >
            View all
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
          <div className="mt-5 grid grid-cols-1 gap-5 @2xl:grid-cols-2">
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

      {savedOpportunities.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-navy/50">Saved</h2>
            <Link href="/student/opportunities?saved=1" className="flex items-center text-xs font-medium text-teal-ink hover:underline">
              View all
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {savedOpportunities.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/opportunities/${o.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-navy/10 bg-white px-5 py-3.5 hover:border-teal/30"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-navy">{o.role}</span>
                    <span className="block truncate text-xs text-navy/50">{o.companyName}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {profileNudge && (
        <div className="mt-10 flex items-center justify-between gap-4 rounded-xl border border-navy/10 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-navy">{profileNudge.title}</p>
            <p className="mt-0.5 text-sm text-navy/60">{profileNudge.description}</p>
          </div>
          <Link
            href={profileNudge.href}
            className="shrink-0 rounded-lg border border-navy/15 px-3.5 py-1.5 text-sm font-medium text-navy transition-colors hover:bg-navy/5"
          >
            {profileNudge.ctaLabel}
          </Link>
        </div>
      )}
    </div>
  );
}
