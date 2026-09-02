import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { getOpportunitiesWithMatch, getPublishedChallengeInfo } from "@/lib/opportunities/browse";
import { getSavedOpportunityIds } from "@/lib/opportunities/saved";
import { getChallengeState } from "@/lib/opportunities/challenge-state";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { StudentPageHeader } from "@/components/dashboard/student-page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SearchX } from "lucide-react";

export default async function StudentOpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { user } = await requireCurrentStudent();
  const params = await searchParams;
  const db = getDb();

  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const location = typeof params.location === "string" ? params.location : "";
  const duration = typeof params.duration === "string" ? params.duration : "";
  const workMode = typeof params.workMode === "string" ? params.workMode : "";
  const savedOnly = params.saved === "1";

  const applications = await db
    .select({
      id: schema.applications.id,
      opportunityId: schema.applications.opportunityId,
      challengeStartedAt: schema.applications.challengeStartedAt,
    })
    .from(schema.applications)
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
  const submissionByApplicationId = new Map(
    submissions.map((s) => [s.applicationId, { hasEvidence: evidencedSubmissionIds.has(s.id) }]),
  );
  const applicationByOpportunityId = new Map(applications.map((a) => [a.opportunityId, a]));

  const [{ opportunities }, publishedChallengeInfo, savedIds] = await Promise.all([
    getOpportunitiesWithMatch(user.id),
    getPublishedChallengeInfo(),
    getSavedOpportunityIds(user.id),
  ]);

  const locations = Array.from(new Set(opportunities.map((o) => o.location))).sort();
  const durations = Array.from(new Set(opportunities.map((o) => o.duration))).sort();

  const filtered = opportunities.filter((o) => {
    if (q) {
      const haystack = `${o.role} ${o.companyName} ${o.skills.join(" ")}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (location && o.location !== location) return false;
    if (duration && o.duration !== duration) return false;
    if (workMode && o.workMode !== workMode) return false;
    if (savedOnly && !savedIds.has(o.id)) return false;
    return true;
  });

  const hasActiveFilters = Boolean(q || location || duration || workMode || savedOnly);

  return (
    <div className="@container mx-auto max-w-screen-2xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <StudentPageHeader eyebrow="Explore" title="Explore internships" />

      <form method="get" className="mt-8 space-y-3">
        <label htmlFor="opportunity-search" className="sr-only">
          Search roles, companies, or skills
        </label>
        <input
          id="opportunity-search"
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search roles, companies, or skills..."
          className="w-full max-w-xl rounded-lg border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy placeholder:text-navy/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
        />

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
          <label htmlFor="opportunity-location" className="sr-only">
            Location
          </label>
          <select
            id="opportunity-location"
            name="location"
            defaultValue={location}
            className="rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
          >
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          <label htmlFor="opportunity-duration" className="sr-only">
            Duration
          </label>
          <select
            id="opportunity-duration"
            name="duration"
            defaultValue={duration}
            className="rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
          >
            <option value="">Any duration</option>
            {durations.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <label htmlFor="opportunity-work-mode" className="sr-only">
            Work mode
          </label>
          <select
            id="opportunity-work-mode"
            name="workMode"
            defaultValue={workMode}
            className="rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
          >
            <option value="">Any work mode</option>
            <option value="onsite">On-site</option>
            <option value="hybrid">Hybrid</option>
            <option value="remote">Remote</option>
          </select>

          <label className="col-span-2 flex items-center gap-2 text-sm text-navy/70 sm:col-span-1">
            <input type="checkbox" name="saved" value="1" defaultChecked={savedOnly} className="size-4 rounded border-navy/30 accent-teal" />
            Saved only
          </label>

          <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
            <button type="submit" className="rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal/90">
              Apply filters
            </button>
            {hasActiveFilters && (
              <a href="/student/opportunities" className="text-sm font-medium text-navy/50 hover:text-navy/70">
                Clear
              </a>
            )}
          </div>
        </div>
      </form>

      <p className="mt-6 text-sm text-navy/50">
        {filtered.length} {filtered.length === 1 ? "opportunity" : "opportunities"}
      </p>

      {filtered.length === 0 ? (
        opportunities.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No published opportunities yet"
            description="Companies are still building their Challenges — check back soon."
          />
        ) : (
          <EmptyState
            icon={SearchX}
            title="No opportunities match these filters"
            description="Try widening your search or clearing a filter."
            ctaLabel="Clear filters"
            ctaHref="/student/opportunities"
          />
        )
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-5 @2xl:grid-cols-2 @6xl:grid-cols-3">
          {filtered.map((o) => {
            const application = applicationByOpportunityId.get(o.id);
            const submission = application ? submissionByApplicationId.get(application.id) : undefined;
            return (
              <OpportunityCard
                key={o.id}
                opportunity={o}
                skills={o.skills}
                saved={savedIds.has(o.id)}
                estimatedMinutes={publishedChallengeInfo.get(o.id)?.estimatedMinutes}
                matchScore={o.matchScore}
                challengeState={getChallengeState({
                  challengePublished: publishedChallengeInfo.has(o.id),
                  application,
                  submission,
                })}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
