import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { getOpportunitiesWithMatch, getPublishedChallengeOpportunityIds, countCreatedWithinMs } from "@/lib/opportunities/browse";
import { getSavedOpportunityIds } from "@/lib/opportunities/saved";
import { getChallengeState } from "@/lib/opportunities/challenge-state";
import { getApplicationStageIndex } from "@/lib/opportunities/application-stage";
import { getProfileCompletion } from "@/lib/profile-completion";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { ArrowRight, ChevronRight } from "lucide-react";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-navy/10 bg-white px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-navy/40">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-[-0.02em] text-navy">{value}</p>
      {hint && <p className="mt-1 text-xs text-navy/50">{hint}</p>}
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
    .select({ id: schema.applications.id, opportunityId: schema.applications.opportunityId, status: schema.applications.status })
    .from(schema.applications)
    .where(eq(schema.applications.studentId, user.id));

  const applicationIds = applications.map((a) => a.id);
  const submissions = applicationIds.length
    ? await db
        .select({ applicationId: schema.submissions.applicationId, status: schema.submissions.status })
        .from(schema.submissions)
        .where(inArray(schema.submissions.applicationId, applicationIds))
    : [];
  const offers = applicationIds.length
    ? await db
        .select({ applicationId: schema.internshipOffers.applicationId })
        .from(schema.internshipOffers)
        .where(inArray(schema.internshipOffers.applicationId, applicationIds))
    : [];

  const submissionByApplicationId = new Map(submissions.map((s) => [s.applicationId, s]));
  const offerApplicationIds = new Set(offers.map((o) => o.applicationId));
  const applicationByOpportunityId = new Map(applications.map((a) => [a.opportunityId, a]));

  const [{ opportunities, hasMatchData }, publishedChallengeIds, savedIds] = await Promise.all([
    getOpportunitiesWithMatch(user.id),
    getPublishedChallengeOpportunityIds(),
    getSavedOpportunityIds(user.id),
  ]);

  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = countCreatedWithinMs(opportunities, oneWeekMs);

  const inReviewCount = applications.filter((a) => {
    const idx = getApplicationStageIndex({
      status: a.status,
      hasSubmission: submissionByApplicationId.has(a.id),
      hasOffer: offerApplicationIds.has(a.id),
    });
    return idx === 1 || idx === 2;
  }).length;

  const activeChallengesCount = applications.filter(
    (a) => !submissionByApplicationId.has(a.id) && publishedChallengeIds.has(a.opportunityId),
  ).length;

  const profileCompletion = getProfileCompletion(profile);

  const recommended = (hasMatchData ? opportunities : [...opportunities].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())).slice(
    0,
    6,
  );

  const savedOpportunities = opportunities.filter((o) => savedIds.has(o.id)).slice(0, 3);

  const nextSteps: { label: string; sublabel: string; href: string }[] = [];
  if (profileCompletion.percent < 100) {
    nextSteps.push({ label: "Complete your profile", sublabel: "Add education, skills & preferences", href: "/student/profile" });
  }
  const inProgressApplication = applications.find(
    (a) => !submissionByApplicationId.has(a.id) && publishedChallengeIds.has(a.opportunityId),
  );
  if (inProgressApplication) {
    nextSteps.push({
      label: "Finish a challenge",
      sublabel: "Show what you can do",
      href: `/student/applications/${inProgressApplication.id}`,
    });
  }
  if (!profile.cvFileKey) {
    nextSteps.push({ label: "Upload your CV", sublabel: "Help companies know you better", href: "/student/profile" });
  }

  return (
    <div className="px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-teal-ink">Dashboard</p>
      <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">
        Welcome back, {user.fullName.split(" ")[0]}. 👋
      </h1>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Applications"
          value={String(applications.length)}
          hint={inReviewCount > 0 ? `${inReviewCount} in review` : undefined}
        />
        <StatCard
          label="Open opportunities"
          value={String(opportunities.length)}
          hint={newThisWeek > 0 ? `${newThisWeek} new this week` : undefined}
        />
        <StatCard label="Active challenges" value={String(activeChallengesCount)} hint={activeChallengesCount > 0 ? "In progress" : undefined} />
        <StatCard label="Profile completion" value={`${profileCompletion.percent}%`} />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
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
              No published opportunities yet. Companies are still building challenges — check back soon.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {recommended.map((o) => {
                const application = applicationByOpportunityId.get(o.id);
                const submission = application ? submissionByApplicationId.get(application.id) : undefined;
                return (
                  <OpportunityCard
                    key={o.id}
                    opportunity={o}
                    saved={savedIds.has(o.id)}
                    challengeState={getChallengeState({
                      challengePublished: publishedChallengeIds.has(o.id),
                      application,
                      submission,
                    })}
                  />
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-navy/10 bg-white p-5">
            <p className="text-sm font-semibold text-navy">Profile completion</p>
            <p className="mt-3 text-2xl font-semibold tabular-nums text-teal-ink">{profileCompletion.percent}%</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-light">
              <div className="h-full rounded-full bg-teal transition-[width]" style={{ width: `${profileCompletion.percent}%` }} />
            </div>
            <p className="mt-3 text-xs text-navy/60">
              {profileCompletion.percent >= 100
                ? "Your profile is complete."
                : `You're doing great! Complete a few more details to stand out.`}
            </p>
            <Link
              href="/student/profile"
              className="mt-4 block rounded-lg bg-teal px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-teal/90"
            >
              Complete profile
            </Link>
          </div>

          <div className="rounded-xl border border-navy/10 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-navy">Saved opportunities ({savedOpportunities.length})</p>
              <Link href="/student/opportunities?saved=1" className="flex items-center text-xs font-medium text-teal-ink hover:underline">
                View all
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
            {savedOpportunities.length === 0 ? (
              <p className="mt-3 text-xs text-navy/50">Bookmark roles you&apos;re interested in to see them here.</p>
            ) : (
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
            )}
          </div>

          {nextSteps.length > 0 && (
            <div className="rounded-xl border border-navy/10 bg-white p-5">
              <p className="text-sm font-semibold text-navy">Next steps</p>
              <ul className="mt-3 space-y-3">
                {nextSteps.map((step) => (
                  <li key={step.label}>
                    <Link href={step.href} className="flex items-start gap-2 hover:text-teal-ink">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />
                      <span>
                        <span className="block text-sm font-medium text-navy">{step.label}</span>
                        <span className="block text-xs text-navy/50">{step.sublabel}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
