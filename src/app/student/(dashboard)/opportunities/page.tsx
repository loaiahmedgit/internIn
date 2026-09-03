import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  MapPin,
  Monitor,
  Search,
  SearchX,
  Sparkles,
} from "lucide-react";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { getOpportunitiesWithMatch, getPublishedChallengeInfo } from "@/lib/opportunities/browse";
import { getSavedOpportunityIds } from "@/lib/opportunities/saved";
import { getChallengeState } from "@/lib/opportunities/challenge-state";
import { ExploreOpportunityCard } from "@/components/student/explore-opportunity-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ApplyButton } from "@/components/opportunities/apply-button";
import { SaveButton } from "@/components/opportunities/save-button";
import { Button } from "@/components/ui/button";

const WORK_MODE_LABEL: Record<"remote" | "onsite" | "hybrid", string> = {
  remote: "Remote",
  onsite: "On-site",
  hybrid: "Hybrid",
};

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

  const selectedOpportunity = filtered.find((o) => o.id === selectedId) ?? filtered[0];
  const selectedApplication = selectedOpportunity ? applicationByOpportunityId.get(selectedOpportunity.id) : undefined;
  const selectedSubmission = selectedApplication ? submissionByApplicationId.get(selectedApplication.id) : undefined;
  const selectedChallenge = selectedOpportunity ? publishedChallengeInfo.get(selectedOpportunity.id) : undefined;
  const selectedChallengeState = selectedApplication
    ? getChallengeState({
        challengePublished: Boolean(selectedChallenge),
        application: selectedApplication,
        submission: selectedSubmission,
      })
    : undefined;
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

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header>
        <h1 className="text-balance text-3xl font-semibold tracking-[-0.045em] text-navy sm:text-4xl">Explore internships</h1>
        <p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-navy/58 sm:text-base">Discover roles matched to your interests, skills, and availability.</p>
      </header>

      <form method="get" className="mt-7">
        <div className="relative max-w-4xl">
          <label htmlFor="opportunity-search" className="sr-only">Search roles, companies, or skills</label>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-navy/38" aria-hidden="true" />
          <input id="opportunity-search" type="search" name="q" defaultValue={qRaw} placeholder="Search by role, company, or skill…" autoComplete="off" className="h-12 w-full rounded-xl border border-navy/12 bg-white pr-14 pl-11 text-sm text-navy shadow-[0_6px_20px_rgba(33,50,72,0.04)] placeholder:text-navy/38 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40" />
          <button type="submit" aria-label="Search internships" className="absolute top-1.5 right-1.5 flex size-9 items-center justify-center rounded-lg bg-teal text-white transition-colors hover:bg-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 focus-visible:ring-offset-2">
            <Search className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <label htmlFor="opportunity-location" className="sr-only">Location</label>
          <select id="opportunity-location" name="location" defaultValue={location} className="h-10 rounded-lg border border-navy/12 bg-white px-3 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
            <option value="">All locations</option>
            {locations.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <label htmlFor="opportunity-duration" className="sr-only">Duration</label>
          <select id="opportunity-duration" name="duration" defaultValue={duration} className="h-10 rounded-lg border border-navy/12 bg-white px-3 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
            <option value="">Any duration</option>
            {durations.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <label htmlFor="opportunity-work-mode" className="sr-only">Work mode</label>
          <select id="opportunity-work-mode" name="workMode" defaultValue={workMode} className="h-10 rounded-lg border border-navy/12 bg-white px-3 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
            <option value="">Any work mode</option>
            <option value="onsite">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option>
          </select>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-navy/12 bg-white px-3 text-sm text-navy/68"><input type="checkbox" name="saved" value="1" defaultChecked={savedOnly} className="size-4 rounded border-navy/30 accent-teal" />Saved only</label>
          <label htmlFor="opportunity-sort" className="sr-only">Sort opportunities</label>
          <select id="opportunity-sort" name="sort" defaultValue={sort} className="h-10 rounded-lg border border-navy/12 bg-white px-3 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 sm:ml-auto">
            <option value="relevant">Most relevant</option><option value="newest">Newest first</option><option value="title">Role title</option>
          </select>
          <Button type="submit" variant="outline" className="h-10 border-teal/20 bg-white px-4 text-teal-ink hover:bg-teal/5">Apply filters</Button>
          {hasActiveFilters ? <Link href="/student/opportunities" className="rounded-md px-1 text-sm font-medium text-navy/50 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">Clear</Link> : null}
        </div>
      </form>

      {filtered.length === 0 ? (
        opportunities.length === 0 ? <EmptyState icon={SearchX} title="No published opportunities yet" description="Companies are still preparing their internships. Check back soon." /> : <EmptyState icon={SearchX} title="No opportunities match these filters" description="Try a broader search or clear one of the filters." ctaLabel="Clear filters" ctaHref="/student/opportunities" />
      ) : (
        <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.92fr)]">
          <section aria-labelledby="opportunity-results-heading">
            <div className="flex items-center justify-between gap-4"><h2 id="opportunity-results-heading" className="text-sm font-semibold text-navy">{filtered.length} {filtered.length === 1 ? "opportunity" : "opportunities"}</h2><p className="text-xs text-navy/45">Select a role to preview it</p></div>
            <div className="mt-3 space-y-3.5">
              {filtered.map((opportunity) => <ExploreOpportunityCard key={opportunity.id} opportunity={opportunity} href={cardHref(opportunity.id)} selected={opportunity.id === selectedOpportunity.id} saved={savedIds.has(opportunity.id)} estimatedMinutes={publishedChallengeInfo.get(opportunity.id)?.estimatedMinutes} matchScore={opportunity.matchScore} />)}
            </div>
          </section>

          <aside className="rounded-2xl border border-navy/10 bg-white p-5 shadow-[0_16px_44px_rgba(33,50,72,0.07)] sm:p-7 xl:sticky xl:top-[6rem]" aria-label={`${selectedOpportunity.role} details`}>
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-teal/10 text-lg font-semibold text-teal-ink" aria-hidden="true">{selectedOpportunity.companyName.charAt(0).toUpperCase()}</div>
              <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><p className="truncate text-sm font-medium text-navy/62">{selectedOpportunity.companyName}</p>{selectedOpportunity.companyVerified ? <BadgeCheck className="size-4 shrink-0 text-teal-ink" aria-label="Verified company" /> : null}</div><h2 className="mt-1 text-balance text-2xl font-semibold tracking-[-0.035em] text-navy">{selectedOpportunity.role}</h2></div>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-navy/56">
              <span className="flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden="true" />{selectedOpportunity.location}</span>
              {selectedOpportunity.workMode ? <span className="flex items-center gap-1.5"><Monitor className="size-3.5" aria-hidden="true" />{WORK_MODE_LABEL[selectedOpportunity.workMode]}</span> : null}
              <span className="flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden="true" />{selectedOpportunity.duration}</span>
              <span className="flex items-center gap-1.5"><BriefcaseBusiness className="size-3.5" aria-hidden="true" />{selectedOpportunity.hoursPerWeek}h/week</span>
            </div>
            <p className="mt-6 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-navy/68">{selectedOpportunity.shortDescription || selectedOpportunity.description}</p>
            {selectedOpportunity.skills.length > 0 ? <section className="mt-6" aria-labelledby="key-skills-heading"><h3 id="key-skills-heading" className="text-sm font-semibold text-navy">Key skills</h3><div className="mt-3 flex flex-wrap gap-2">{selectedOpportunity.skills.map((skill) => <span key={skill} className="rounded-full border border-navy/10 bg-[#f7f9fa] px-3 py-1.5 text-xs text-navy/62">{skill}</span>)}</div></section> : null}
            {selectedOpportunity.requirements.length > 0 ? <section className="mt-6 border-t border-navy/8 pt-6" aria-labelledby="requirements-heading"><h3 id="requirements-heading" className="text-base font-semibold text-navy">Role requirements</h3><ul className="mt-3 space-y-2.5">{selectedOpportunity.requirements.slice(0, 5).map((requirement) => <li key={requirement} className="flex items-start gap-2.5 text-sm leading-6 text-navy/64"><CheckCircle2 className="mt-1 size-4 shrink-0 text-teal-ink" aria-hidden="true" /><span>{requirement}</span></li>)}</ul></section> : null}
            {selectedOpportunity.whatYouWillLearn ? <section className="mt-6 border-t border-navy/8 pt-6" aria-labelledby="learning-heading"><h3 id="learning-heading" className="text-base font-semibold text-navy">What you will learn</h3><p className="mt-2 text-sm leading-6 text-navy/64">{selectedOpportunity.whatYouWillLearn}</p></section> : null}
            {selectedChallenge ? <div className="mt-6 rounded-xl border border-teal/16 bg-teal/[0.055] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-teal-ink"><Sparkles className="size-4" aria-hidden="true" />Work challenge</div><p className="mt-2 text-sm font-medium text-navy">{selectedChallenge.title}</p><p className="mt-1 text-xs text-navy/52">{selectedChallenge.taskCount} {selectedChallenge.taskCount === 1 ? "task" : "tasks"}, about {selectedChallenge.estimatedMinutes} minutes</p></div> : null}
            <div className="mt-6 flex items-start gap-2.5">
              <div className="min-w-0 flex-1">{selectedApplication ? <Button render={<Link href={`/student/applications/${selectedApplication.id}`} />} nativeButton={false} className="h-11 w-full bg-teal px-5 text-white hover:bg-teal-ink">{selectedChallengeState?.kind === "to_do" ? "Start challenge" : selectedChallengeState?.kind === "in_progress" ? "Continue challenge" : "Open application"}<ArrowRight className="size-4" aria-hidden="true" /></Button> : <ApplyButton opportunityId={selectedOpportunity.id} label="Apply now" className="h-11 w-full bg-teal px-5 text-white hover:bg-teal-ink" />}</div>
              <SaveButton opportunityId={selectedOpportunity.id} initialSaved={savedIds.has(selectedOpportunity.id)} showLabel className="border border-navy/12 bg-white hover:border-teal/25 hover:bg-teal/5" />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
