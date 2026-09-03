import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { Search, SearchX } from "lucide-react";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { getOpportunitiesWithMatch, getPublishedChallengeInfo } from "@/lib/opportunities/browse";
import { getSavedOpportunityIds } from "@/lib/opportunities/saved";
import { getChallengeState } from "@/lib/opportunities/challenge-state";
import { ExploreOpportunityCard } from "@/components/student/explore-opportunity-card";
import { OpportunityDetailSheet, type OpportunityDetail } from "@/components/student/opportunity-detail-sheet";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";

function valueOf(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function StudentOpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { user } = await requireCurrentStudent();
  const params = await searchParams;
  const db = getDb();

  const qRaw = valueOf(params.q).trim();
  const q = qRaw.toLowerCase();
  const location = valueOf(params.location);
  const duration = valueOf(params.duration);
  const workMode = valueOf(params.workMode);
  const sort = valueOf(params.sort) || "relevant";
  const selectedId = valueOf(params.opportunity);
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
    if (q && !`${o.role} ${o.companyName} ${o.skills.join(" ")}`.toLowerCase().includes(q)) return false;
    if (location && o.location !== location) return false;
    if (duration && o.duration !== duration) return false;
    if (workMode && o.workMode !== workMode) return false;
    if (savedOnly && !savedIds.has(o.id)) return false;
    return true;
  });

  if (sort === "newest") filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (sort === "title") filtered.sort((a, b) => a.role.localeCompare(b.role));

  // Closed by default: only a real match for the `?opportunity=` param
  // opens the sheet — never fall back to the first result in the list.
  const selectedOpportunity = filtered.find((o) => o.id === selectedId);
  const hasActiveFilters = Boolean(q || location || duration || workMode || savedOnly);

  function cardHref(opportunityId: string) {
    const next = new URLSearchParams();
    if (qRaw) next.set("q", qRaw);
    if (location) next.set("location", location);
    if (duration) next.set("duration", duration);
    if (workMode) next.set("workMode", workMode);
    if (savedOnly) next.set("saved", "1");
    if (sort !== "relevant") next.set("sort", sort);
    next.set("opportunity", opportunityId);
    return `/student/opportunities?${next.toString()}`;
  }

  function closeHref() {
    const next = new URLSearchParams();
    if (qRaw) next.set("q", qRaw);
    if (location) next.set("location", location);
    if (duration) next.set("duration", duration);
    if (workMode) next.set("workMode", workMode);
    if (savedOnly) next.set("saved", "1");
    if (sort !== "relevant") next.set("sort", sort);
    const qs = next.toString();
    return qs ? `/student/opportunities?${qs}` : "/student/opportunities";
  }

  let detail: OpportunityDetail | null = null;
  if (selectedOpportunity) {
    const application = applicationByOpportunityId.get(selectedOpportunity.id);
    const submission = application ? submissionByApplicationId.get(application.id) : undefined;
    const challenge = publishedChallengeInfo.get(selectedOpportunity.id);
    const challengeState = application
      ? getChallengeState({ challengePublished: Boolean(challenge), application, submission })
      : undefined;
    detail = {
      id: selectedOpportunity.id,
      role: selectedOpportunity.role,
      companyName: selectedOpportunity.companyName,
      companyVerified: selectedOpportunity.companyVerified,
      location: selectedOpportunity.location,
      workMode: selectedOpportunity.workMode,
      duration: selectedOpportunity.duration,
      hoursPerWeek: selectedOpportunity.hoursPerWeek,
      description: selectedOpportunity.description,
      shortDescription: selectedOpportunity.shortDescription,
      skills: selectedOpportunity.skills,
      requirements: selectedOpportunity.requirements,
      whatYouWillLearn: selectedOpportunity.whatYouWillLearn,
      saved: savedIds.has(selectedOpportunity.id),
      challenge,
      application: application
        ? {
            id: application.id,
            ctaLabel:
              challengeState?.kind === "to_do" ? "Start challenge" : challengeState?.kind === "in_progress" ? "Continue challenge" : "Open application",
          }
        : undefined,
    };
  }

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <header>
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-navy sm:text-2xl">Explore internships</h1>
        <p className="mt-1 text-sm text-navy/58">Discover roles matched to your interests, skills, and availability.</p>
      </header>

      <form method="get" className="mt-4">
        <div className="relative max-w-3xl">
          <label htmlFor="opportunity-search" className="sr-only">Search roles, companies, or skills</label>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-navy/38" aria-hidden="true" />
          <input id="opportunity-search" type="search" name="q" defaultValue={qRaw} placeholder="Search by role, company, or skill…" autoComplete="off" className="h-10 w-full rounded-lg border border-navy/12 bg-white pr-12 pl-9 text-sm text-navy placeholder:text-navy/38 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40" />
          <button type="submit" aria-label="Search internships" className="absolute top-1 right-1 flex size-8 items-center justify-center rounded-md bg-teal text-white transition-colors hover:bg-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 focus-visible:ring-offset-2">
            <Search className="size-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <label htmlFor="opportunity-location" className="sr-only">Location</label>
          <select id="opportunity-location" name="location" defaultValue={location} className="h-9 rounded-md border border-navy/12 bg-white px-2.5 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
            <option value="">All locations</option>
            {locations.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <label htmlFor="opportunity-duration" className="sr-only">Duration</label>
          <select id="opportunity-duration" name="duration" defaultValue={duration} className="h-9 rounded-md border border-navy/12 bg-white px-2.5 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
            <option value="">Any duration</option>
            {durations.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <label htmlFor="opportunity-work-mode" className="sr-only">Work mode</label>
          <select id="opportunity-work-mode" name="workMode" defaultValue={workMode} className="h-9 rounded-md border border-navy/12 bg-white px-2.5 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
            <option value="">Any work mode</option>
            <option value="onsite">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option>
          </select>
          <label className="flex h-9 items-center gap-1.5 rounded-md border border-navy/12 bg-white px-2.5 text-sm text-navy/68"><input type="checkbox" name="saved" value="1" defaultChecked={savedOnly} className="size-3.5 rounded border-navy/30 accent-teal" />Saved only</label>
          <label htmlFor="opportunity-sort" className="sr-only">Sort opportunities</label>
          <select id="opportunity-sort" name="sort" defaultValue={sort} className="h-9 rounded-md border border-navy/12 bg-white px-2.5 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 sm:ml-auto">
            <option value="relevant">Most relevant</option><option value="newest">Newest first</option><option value="title">Role title</option>
          </select>
          <Button type="submit" variant="outline" className="h-9 border-teal/20 bg-white px-3 text-teal-ink hover:bg-teal/5">Apply</Button>
          {hasActiveFilters ? <Link href="/student/opportunities" className="rounded-md px-1 text-sm font-medium text-navy/50 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">Clear</Link> : null}
        </div>
      </form>

      {filtered.length === 0 ? (
        opportunities.length === 0 ? <EmptyState icon={SearchX} title="No published opportunities yet" description="Companies are still preparing their internships. Check back soon." /> : <EmptyState icon={SearchX} title="No opportunities match these filters" description="Try a broader search or clear one of the filters." ctaLabel="Clear filters" ctaHref="/student/opportunities" />
      ) : (
        <section aria-labelledby="opportunity-results-heading" className="mt-4">
          <h2 id="opportunity-results-heading" className="text-sm font-semibold text-navy">{filtered.length} {filtered.length === 1 ? "opportunity" : "opportunities"}</h2>
          <div className="mt-2.5 space-y-2">
            {filtered.map((opportunity) => (
              <ExploreOpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                href={cardHref(opportunity.id)}
                selected={opportunity.id === selectedOpportunity?.id}
                saved={savedIds.has(opportunity.id)}
                estimatedMinutes={publishedChallengeInfo.get(opportunity.id)?.estimatedMinutes}
                matchScore={opportunity.matchScore}
              />
            ))}
          </div>
        </section>
      )}

      <OpportunityDetailSheet opportunity={detail} closeHref={closeHref()} />
    </div>
  );
}
