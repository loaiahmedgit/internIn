import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { getOpportunitiesWithMatch, getPublishedChallengeOpportunityIds } from "@/lib/opportunities/browse";
import { getSavedOpportunityIds } from "@/lib/opportunities/saved";
import { getChallengeState } from "@/lib/opportunities/challenge-state";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";

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
  const submissionByApplicationId = new Map(submissions.map((s) => [s.applicationId, s]));
  const applicationByOpportunityId = new Map(applications.map((a) => [a.opportunityId, a]));

  const [{ opportunities }, publishedChallengeIds, savedIds] = await Promise.all([
    getOpportunitiesWithMatch(user.id),
    getPublishedChallengeOpportunityIds(),
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
    if (workMode === "remote" && o.location.trim().toLowerCase() !== "remote") return false;
    if (workMode === "onsite" && o.location.trim().toLowerCase() === "remote") return false;
    if (savedOnly && !savedIds.has(o.id)) return false;
    return true;
  });

  const hasActiveFilters = Boolean(q || location || duration || workMode || savedOnly);

  return (
    <div className="px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-teal-ink">Opportunities</p>
      <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">Prove what you can do.</h1>

      <form method="get" className="mt-8 space-y-3">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search roles, companies, or skills..."
          className="w-full max-w-xl rounded-lg border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy placeholder:text-navy/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
        />

        <div className="flex flex-wrap items-center gap-3">
          <select
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

          <select
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

          <select
            name="workMode"
            defaultValue={workMode}
            className="rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
          >
            <option value="">Any work mode</option>
            <option value="remote">Remote</option>
            <option value="onsite">On-site</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-navy/70">
            <input type="checkbox" name="saved" value="1" defaultChecked={savedOnly} className="size-4 rounded border-navy/30 accent-teal" />
            Saved only
          </label>

          <button
            type="submit"
            className="rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal/90"
          >
            Apply filters
          </button>

          {hasActiveFilters && (
            <a href="/student/opportunities" className="text-sm font-medium text-navy/50 hover:text-navy/70">
              Clear filters
            </a>
          )}
        </div>
      </form>

      <p className="mt-6 text-sm text-navy/50">
        {filtered.length} {filtered.length === 1 ? "opportunity" : "opportunities"}
      </p>

      {filtered.length === 0 ? (
        <p className="mt-6 text-navy/68">
          {opportunities.length === 0
            ? "No published opportunities yet. Companies are still building challenges — check back soon."
            : "No opportunities match these filters. Try widening your search."}
        </p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((o) => {
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
  );
}
