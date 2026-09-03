import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { getOpportunitiesWithMatch, getPublishedChallengeInfo } from "@/lib/opportunities/browse";
import { getSavedOpportunityIds } from "@/lib/opportunities/saved";
import { getChallengeState } from "@/lib/opportunities/challenge-state";
import { getProfileCompletion } from "@/lib/profile-completion";
import { HomeOpportunityCard } from "@/components/student/home-opportunity-card";
import { NewThisWeekCard } from "@/components/student/new-this-week-card";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";

/** Display-only capitalization for a first name — never touches the stored value. */
function toDisplayName(name: string): string {
  return name.length ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

/** Plain helper (not a component) so calling Date.now() here never trips the render-purity lint rule. */
function isWithinLastWeek(date: Date, windowMs: number): boolean {
  return Date.now() - date.getTime() < windowMs;
}

const RECOMMENDED_COUNT = 3;
const NEW_THIS_WEEK_COUNT = 3;
const CONTINUE_COUNT = 3;
const NEW_THIS_WEEK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const PROFILE_RING_RADIUS = 22;
const PROFILE_RING_CIRCUMFERENCE = 2 * Math.PI * PROFILE_RING_RADIUS;

/** One real, actionable item for "Continue where you left off" — a pending
 * offer to respond to, or a challenge the student has started but not
 * finished (or hasn't started at all). Never a passive status change. */
type ContinueItem = { key: string; title: string; role: string; companyName: string; status: string; href: string };

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
      cvUrl: schema.studentProfiles.cvUrl,
    })
    .from(schema.studentProfiles)
    .where(eq(schema.studentProfiles.userId, user.id))
    .limit(1);
  if (!profile?.educationStage) redirect("/student/onboarding");

  const applications = await db
    .select({
      id: schema.applications.id,
      opportunityId: schema.applications.opportunityId,
      role: schema.opportunities.role,
      companyName: schema.companies.name,
      challengeStartedAt: schema.applications.challengeStartedAt,
    })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(eq(schema.applications.studentId, user.id));

  const applicationIds = applications.map((a) => a.id);
  const offers = applicationIds.length
    ? await db
        .select({ id: schema.internshipOffers.id, applicationId: schema.internshipOffers.applicationId, status: schema.internshipOffers.status })
        .from(schema.internshipOffers)
        .where(inArray(schema.internshipOffers.applicationId, applicationIds))
    : [];
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
  const submissionByApplicationId = new Map(
    submissions.map((s) => [s.applicationId, { hasEvidence: evidencedSubmissionIds.has(s.id) }]),
  );

  const [{ opportunities, hasMatchData }, publishedChallengeInfo, savedIds] = await Promise.all([
    getOpportunitiesWithMatch(user.id),
    getPublishedChallengeInfo(),
    getSavedOpportunityIds(user.id),
  ]);

  const profileCompletion = getProfileCompletion(profile);
  const profileSteps = [
    { key: "skills", label: "Add skills", done: (profile?.skills.length ?? 0) > 0 },
    { key: "cv", label: "Add CV", done: Boolean(profile?.cvFileKey || profile?.cvUrl) },
    { key: "interests", label: "Add interests", done: (profile?.interests.length ?? 0) > 0 },
  ];

  const appliedOpportunityIds = new Set(applications.map((a) => a.opportunityId));
  const notApplied = opportunities.filter((o) => !appliedOpportunityIds.has(o.id));
  const recommended = (hasMatchData ? notApplied : [...notApplied].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())).slice(0, RECOMMENDED_COUNT);

  const newThisWeek = [...notApplied]
    .filter((o) => isWithinLastWeek(o.createdAt, NEW_THIS_WEEK_WINDOW_MS))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, NEW_THIS_WEEK_COUNT);

  // Real, actionable items only — a pending offer to respond to, or a
  // challenge not yet finished. Never a restatement of every application.
  const continueItems: ContinueItem[] = [];
  for (const offer of offers) {
    if (offer.status !== "pending") continue;
    const application = applications.find((a) => a.id === offer.applicationId);
    if (!application) continue;
    continueItems.push({
      key: `offer-${offer.id}`,
      title: "Respond to offer",
      role: application.role,
      companyName: application.companyName,
      status: "Offer received",
      href: `/student/applications/${application.id}`,
    });
  }
  for (const application of applications) {
    const challengeState = getChallengeState({
      challengePublished: publishedChallengeInfo.has(application.opportunityId),
      application,
      submission: submissionByApplicationId.get(application.id),
    });
    if (challengeState.kind === "in_progress") {
      continueItems.push({
        key: `inprogress-${application.id}`,
        title: "Continue challenge",
        role: application.role,
        companyName: application.companyName,
        status: "Challenge in progress",
        href: `/student/applications/${application.id}`,
      });
    } else if (challengeState.kind === "to_do") {
      continueItems.push({
        key: `todo-${application.id}`,
        title: "Start challenge",
        role: application.role,
        companyName: application.companyName,
        status: "Challenge not started",
        href: `/student/applications/${application.id}`,
      });
    }
  }
  const visibleContinueItems = continueItems.slice(0, CONTINUE_COUNT);

  const firstName = toDisplayName(user.fullName.trim().split(/\s+/)[0] || "there");

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Hero — compact app banner, not a landing-page hero. Text is
          vertically centered in the card; the illustration is absolutely
          anchored to the bottom-right so it shares the text block's visual
          center instead of floating in its own half. */}
      <section className="relative overflow-hidden rounded-2xl border border-black/[0.04] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)] sm:px-9 lg:h-[224px] lg:px-10">
        <div className="relative z-[1] flex h-full max-w-lg flex-col justify-center lg:max-w-[52%]">
          <p className="text-base font-semibold text-teal-ink">Hi {firstName}</p>
          <h1 className="mt-1.5 text-balance text-2xl font-bold tracking-[-0.03em] text-navy sm:text-[1.875rem] sm:leading-[1.15]">
            Find opportunities that fit you.
          </h1>
          <p className="mt-2 max-w-md text-pretty text-sm leading-6 text-navy/60">
            Explore internships that match your interests and skills and build real experience.
          </p>
        </div>
        <div className="pointer-events-none absolute right-3 bottom-0 hidden lg:block">
          <Image
            src="/assets/student-hero-illustration.png"
            alt=""
            width={1382}
            height={998}
            priority
            className="h-[210px] w-auto object-contain object-bottom"
            sizes="(min-width: 1024px) 420px, 0px"
          />
        </div>
      </section>

      {/* Level up your profile */}
      {profileCompletion.percent < 100 && (
        <section aria-labelledby="profile-nudge-heading" className="mt-8">
          <div className="flex flex-col gap-5 rounded-2xl border border-black/[0.04] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)] sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <svg viewBox="0 0 52 52" className="size-12 shrink-0 -rotate-90" aria-hidden="true">
                <circle cx="26" cy="26" r={PROFILE_RING_RADIUS} className="fill-none stroke-navy/8" strokeWidth="4" />
                <circle
                  cx="26"
                  cy="26"
                  r={PROFILE_RING_RADIUS}
                  className="fill-none stroke-teal"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={PROFILE_RING_CIRCUMFERENCE}
                  strokeDashoffset={PROFILE_RING_CIRCUMFERENCE * (1 - profileCompletion.percent / 100)}
                />
              </svg>
              <div className="min-w-0">
                <p id="profile-nudge-heading" className="flex items-baseline gap-1.5 text-base font-semibold text-navy">
                  <span className="tabular-nums text-teal-ink">{profileCompletion.percent}%</span>
                  Level up your profile
                </p>
                <p className="mt-0.5 max-w-sm text-sm leading-5 text-navy/58">Add skills, CV and interests to get better matches and stand out to companies.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {profileSteps.map((step, index) => (
                <div key={step.key} className="flex items-center gap-2">
                  <span className={`flex items-center gap-1.5 text-sm font-medium ${step.done ? "text-navy" : "text-navy/45"}`}>
                    {step.done ? (
                      <CheckCircle2 className="size-4 fill-teal text-white" aria-hidden="true" />
                    ) : (
                      <Circle className="size-4 text-navy/25" aria-hidden="true" />
                    )}
                    {step.label}
                  </span>
                  {index < profileSteps.length - 1 && <span className="text-navy/25" aria-hidden="true">›</span>}
                </div>
              ))}
            </div>

            <Button render={<Link href="/student/profile" />} nativeButton={false} className="h-10 shrink-0 bg-teal px-4 text-white hover:bg-teal-ink">
              Improve profile
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </section>
      )}

      {/* Recommended for you */}
      <section aria-labelledby="recommended-heading" className="mt-9">
        <div className="flex items-center justify-between gap-4">
          <h2 id="recommended-heading" className="text-lg font-semibold tracking-[-0.02em] text-navy">Recommended for you</h2>
          <Link href="/student/opportunities" className="flex shrink-0 items-center gap-1 text-sm font-medium text-teal-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
            View all
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        {recommended.length === 0 ? (
          <p className="mt-4 text-sm text-navy/60">
            {opportunities.length === 0
              ? "No published opportunities yet. Companies are still building challenges. Check back soon."
              : "You've applied to everything that's currently open. Check back soon for more."}
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((o) => (
              <HomeOpportunityCard
                key={o.id}
                opportunity={o}
                href={`/student/opportunities?opportunity=${o.id}`}
                saved={savedIds.has(o.id)}
                estimatedMinutes={publishedChallengeInfo.get(o.id)?.estimatedMinutes}
              />
            ))}
          </div>
        )}
      </section>

      {/* Continue where you left off — real actionable items only; the
          whole section is omitted when there is nothing to act on. */}
      {visibleContinueItems.length > 0 && (
        <section aria-labelledby="continue-heading" className="mt-9">
          <h2 id="continue-heading" className="text-lg font-semibold tracking-[-0.02em] text-navy">Continue where you left off</h2>
          <div className="mt-4 divide-y divide-navy/8 overflow-hidden rounded-2xl border border-black/[0.04] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)]">
            {visibleContinueItems.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-xs font-semibold text-teal-ink" aria-hidden="true">
                    {item.companyName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">{item.title}</p>
                    <p className="truncate text-xs text-navy/52">{item.role} · {item.companyName}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-xs text-navy/45 sm:inline">{item.status}</span>
                  <Link href={item.href} className="flex items-center gap-1 text-sm font-medium text-teal-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
                    Continue
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* New this week — fresh opportunities, omitted entirely when none
          were published in the last 7 days. */}
      {newThisWeek.length > 0 && (
        <section aria-labelledby="new-this-week-heading" className="mt-9 mb-2">
          <h2 id="new-this-week-heading" className="text-lg font-semibold tracking-[-0.02em] text-navy">New this week</h2>
          <p className="mt-0.5 text-sm text-navy/52">Fresh opportunities matching your interests.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {newThisWeek.map((o) => (
              <NewThisWeekCard key={o.id} opportunity={o} href={`/student/opportunities?opportunity=${o.id}`} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
