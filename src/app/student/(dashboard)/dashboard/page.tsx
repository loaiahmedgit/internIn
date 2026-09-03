import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { eq, inArray, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { getOpportunitiesWithMatch, getPublishedChallengeInfo } from "@/lib/opportunities/browse";
import { getSavedOpportunityIds } from "@/lib/opportunities/saved";
import { getProfileCompletion } from "@/lib/profile-completion";
import { formatSavedAgo } from "@/lib/format-date";
import { HomeOpportunityCard } from "@/components/student/home-opportunity-card";
import { SaveButton } from "@/components/opportunities/save-button";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Bookmark,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  MapPin,
} from "lucide-react";

/** Display-only capitalization for a first name — never touches the stored value. */
function toDisplayName(name: string): string {
  return name.length ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

const RECOMMENDED_COUNT = 3;
const SAVED_COUNT = 3;
const PROFILE_RING_RADIUS = 22;
const PROFILE_RING_CIRCUMFERENCE = 2 * Math.PI * PROFILE_RING_RADIUS;

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
      hoursPerWeek: schema.opportunities.hoursPerWeek,
      location: schema.opportunities.location,
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

  const [{ opportunities, hasMatchData }, publishedChallengeInfo, savedIds] = await Promise.all([
    getOpportunitiesWithMatch(user.id),
    getPublishedChallengeInfo(),
    getSavedOpportunityIds(user.id),
  ]);

  const savedRows = await db
    .select({
      opportunityId: schema.opportunities.id,
      role: schema.opportunities.role,
      companyName: schema.companies.name,
      createdAt: schema.savedOpportunities.createdAt,
    })
    .from(schema.savedOpportunities)
    .innerJoin(schema.opportunities, eq(schema.savedOpportunities.opportunityId, schema.opportunities.id))
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(eq(schema.savedOpportunities.studentId, user.id))
    .orderBy(desc(schema.savedOpportunities.createdAt))
    .limit(SAVED_COUNT);

  const profileCompletion = getProfileCompletion(profile);
  const profileSteps = [
    { key: "skills", label: "Add skills", done: (profile?.skills.length ?? 0) > 0 },
    { key: "cv", label: "Add CV", done: Boolean(profile?.cvFileKey || profile?.cvUrl) },
    { key: "interests", label: "Add interests", done: (profile?.interests.length ?? 0) > 0 },
  ];

  // An active internship outranks everything else in "what matters right
  // now" — real week/progress, derived from actual task completion.
  const acceptedOffer = offers.find((o) => o.status === "accepted");
  let activeProgramSummary:
    | { role: string; companyName: string; hoursPerWeek: number; location: string; currentWeek: number; totalWeeks: number; percent: number }
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
      const sortedWeeks = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber);
      const firstIncomplete = sortedWeeks.find((w) => tasks.some((t) => t.weekId === w.id && t.status !== "done"));
      const currentWeek = firstIncomplete?.weekNumber ?? sortedWeeks[sortedWeeks.length - 1]?.weekNumber ?? 1;

      activeProgramSummary = {
        role: application.role,
        companyName: application.companyName,
        hoursPerWeek: application.hoursPerWeek,
        location: application.location,
        currentWeek,
        totalWeeks: program.durationWeeks,
        percent: Math.round((currentWeek / program.durationWeeks) * 100),
      };
    }
  }

  const appliedOpportunityIds = new Set(applications.map((a) => a.opportunityId));
  const notApplied = opportunities.filter((o) => !appliedOpportunityIds.has(o.id));
  const recommended = (hasMatchData ? notApplied : [...notApplied].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())).slice(0, RECOMMENDED_COUNT);

  const firstName = toDisplayName(user.fullName.trim().split(/\s+/)[0] || "there");

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Hero — compact app banner, not a landing-page hero. Text is
          vertically centered in the card; the illustration is absolutely
          anchored to the bottom-right so it shares the text block's visual
          center instead of floating in its own half. */}
      <section className="relative overflow-hidden rounded-2xl border border-navy/10 bg-white px-6 py-6 sm:px-9 lg:h-[200px] lg:px-10">
        <div className="relative z-[1] flex h-full max-w-lg flex-col justify-center lg:max-w-[52%]">
          <p className="text-base font-semibold text-teal-ink">Hi {firstName}</p>
          <h1 className="mt-1.5 text-balance text-2xl font-bold tracking-[-0.03em] text-navy sm:text-[1.875rem] sm:leading-[1.15]">
            Find opportunities that fit you.
          </h1>
          <p className="mt-2 max-w-md text-pretty text-sm leading-6 text-navy/60">
            Explore internships that match your interests and skills and build real experience.
          </p>
        </div>
        <div className="pointer-events-none absolute right-6 bottom-0 hidden lg:block lg:right-8">
          <Image
            src="/assets/student-hero-illustration.png"
            alt=""
            width={1448}
            height={1086}
            priority
            className="h-[220px] w-auto object-contain object-bottom"
            sizes="(min-width: 1024px) 420px, 0px"
          />
        </div>
      </section>

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

      {/* Current internship */}
      <section aria-labelledby="current-internship-heading" className="mt-9">
        <div className="flex items-center justify-between gap-4">
          <h2 id="current-internship-heading" className="text-lg font-semibold tracking-[-0.02em] text-navy">Current internship</h2>
        </div>

        {activeProgramSummary ? (
          <div className="mt-4 rounded-2xl border border-navy/10 bg-white px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
              <div className="flex min-w-0 items-center gap-3 lg:w-64 lg:shrink-0">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-sm font-semibold text-teal-ink" aria-hidden="true">
                  {activeProgramSummary.companyName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-navy">{activeProgramSummary.role}</p>
                  <p className="truncate text-sm text-navy/56">{activeProgramSummary.companyName}</p>
                </div>
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy/56 lg:shrink-0">
                <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" aria-hidden="true" />Week {activeProgramSummary.currentWeek} of {activeProgramSummary.totalWeeks}</span>
                <span className="flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden="true" />{activeProgramSummary.hoursPerWeek}h/week</span>
                <span className="flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden="true" />{activeProgramSummary.location}</span>
              </div>

              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-navy/8" aria-hidden="true">
                  <div className="h-full rounded-full bg-teal" style={{ width: `${activeProgramSummary.percent}%` }} />
                </div>
                <span className="shrink-0 text-xs font-medium tabular-nums text-navy/56">{activeProgramSummary.percent}%</span>
              </div>

              <Button render={<Link href="/student/internships" />} nativeButton={false} variant="outline" className="h-9 shrink-0 border-teal/25 bg-white px-3.5 text-teal-ink hover:bg-teal/5">
                Open workspace
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-navy/10 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy/40" aria-hidden="true">
                <Briefcase className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-navy">No active internship yet</p>
                <p className="mt-0.5 text-sm text-navy/56">When you accept an offer, your internship workspace will appear here.</p>
              </div>
            </div>
            <Link href="/student/opportunities" className="shrink-0 text-sm font-medium text-teal-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
              Explore internships →
            </Link>
          </div>
        )}
      </section>

      {/* Saved opportunities */}
      <section aria-labelledby="saved-heading" className="mt-9">
        <div className="flex items-center justify-between gap-4">
          <h2 id="saved-heading" className="text-lg font-semibold tracking-[-0.02em] text-navy">Saved opportunities</h2>
          <Link href="/student/opportunities?saved=1" className="flex shrink-0 items-center gap-1 text-sm font-medium text-teal-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
            View all
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        {savedRows.length === 0 ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-navy/10 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy/40" aria-hidden="true">
                <Bookmark className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-navy">Nothing saved yet</p>
                <p className="mt-0.5 text-sm text-navy/56">Save opportunities you like so you can come back to them quickly.</p>
              </div>
            </div>
            <Link href="/student/opportunities" className="shrink-0 text-sm font-medium text-teal-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
              Explore roles →
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 divide-y divide-navy/8 overflow-hidden rounded-2xl border border-navy/10 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {savedRows.map((item) => (
              <div key={item.opportunityId} className="flex items-start justify-between gap-3 px-5 py-4">
                <Link href={`/student/opportunities?opportunity=${item.opportunityId}`} className="flex min-w-0 items-start gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-xs font-semibold text-teal-ink" aria-hidden="true">
                    {item.companyName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-navy/52">{item.companyName}</p>
                    <p className="truncate text-sm font-semibold text-navy">{item.role}</p>
                    <p className="mt-0.5 truncate text-xs text-navy/45">{formatSavedAgo(item.createdAt)}</p>
                  </div>
                </Link>
                <SaveButton opportunityId={item.opportunityId} initialSaved className="shrink-0" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Level up your profile */}
      {profileCompletion.percent < 100 && (
        <section aria-labelledby="profile-nudge-heading" className="mt-8 mb-2">
          <div className="flex flex-col gap-5 rounded-2xl border border-navy/10 bg-white px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
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
    </div>
  );
}
