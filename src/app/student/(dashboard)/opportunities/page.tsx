import Link from "next/link";
import { Clock3, MapPin, Monitor, Search, SearchX, SlidersHorizontal } from "lucide-react";
import { requireCurrentStudent } from "@/lib/auth";
import { getOpportunitiesWithMatch, getPublishedChallengeInfo } from "@/lib/opportunities/browse";
import { getSavedOpportunityIds } from "@/lib/opportunities/saved";
import { loadOpportunityDetail } from "@/lib/opportunities/detail-actions";
import { ExploreSplitView, type ExploreListItem } from "@/components/student/explore-split-view";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";

const NEW_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

function valueOf(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

/** Plain helper (not a component) so calling Date.now() here never trips the render-purity lint rule. */
function isWithinLastWeek(date: Date): boolean {
  return Date.now() - date.getTime() < NEW_WITHIN_MS;
}

export default async function StudentOpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { user } = await requireCurrentStudent();
  const params = await searchParams;

  const qRaw = valueOf(params.q).trim();
  const q = qRaw.toLowerCase();
  const location = valueOf(params.location);
  const category = valueOf(params.category);
  const duration = valueOf(params.duration);
  const workMode = valueOf(params.workMode);
  const hoursBucket = valueOf(params.hours);
  const sort = valueOf(params.sort) || "relevant";
  const selectedIdParam = valueOf(params.opportunity);
  const savedOnly = params.saved === "1";

  const [{ opportunities }, publishedChallengeInfo, savedIds] = await Promise.all([
    getOpportunitiesWithMatch(user.id),
    getPublishedChallengeInfo(),
    getSavedOpportunityIds(user.id),
  ]);

  const locations = Array.from(new Set(opportunities.map((o) => o.location))).sort();
  // Case-insensitive dedupe (keeps the first-seen casing) so "3 months" and
  // "3 Months" don't show up as two separate, confusing filter options.
  const durations = Array.from(
    opportunities.reduce((byKey, o) => {
      const key = o.duration.trim().toLowerCase();
      if (!byKey.has(key)) byKey.set(key, o.duration);
      return byKey;
    }, new Map<string, string>()).values(),
  ).sort();
  const categories = Array.from(new Set(opportunities.map((o) => o.department).filter((d): d is string => Boolean(d)))).sort();
  const filtered = opportunities.filter((o) => {
    if (q && !`${o.role} ${o.companyName} ${o.skills.join(" ")}`.toLowerCase().includes(q)) return false;
    if (location && o.location !== location) return false;
    if (category && o.department !== category) return false;
    if (duration && o.duration !== duration) return false;
    if (workMode && o.workMode !== workMode) return false;
    if (hoursBucket === "under10" && o.hoursPerWeek >= 10) return false;
    if (hoursBucket === "11to20" && (o.hoursPerWeek < 11 || o.hoursPerWeek > 20)) return false;
    if (hoursBucket === "21to30" && (o.hoursPerWeek < 21 || o.hoursPerWeek > 30)) return false;
    if (hoursBucket === "over30" && o.hoursPerWeek <= 30) return false;
    if (savedOnly && !savedIds.has(o.id)) return false;
    return true;
  });

  if (sort === "newest") filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (sort === "deadline") {
    filtered.sort((a, b) => {
      if (!a.applicationDeadline && !b.applicationDeadline) return 0;
      if (!a.applicationDeadline) return 1;
      if (!b.applicationDeadline) return -1;
      return a.applicationDeadline.getTime() - b.applicationDeadline.getTime();
    });
  }

  const hasActiveFilters = Boolean(q || location || category || duration || workMode || hoursBucket || savedOnly);

  function buildParams() {
    const next = new URLSearchParams();
    if (qRaw) next.set("q", qRaw);
    if (location) next.set("location", location);
    if (category) next.set("category", category);
    if (duration) next.set("duration", duration);
    if (workMode) next.set("workMode", workMode);
    if (hoursBucket) next.set("hours", hoursBucket);
    if (savedOnly) next.set("saved", "1");
    if (sort !== "relevant") next.set("sort", sort);
    return next;
  }
  const baseQueryString = buildParams().toString();

  // Split-view default: with no explicit `?opportunity=`, select the first
  // result automatically (matches LinkedIn-style browsing — the panel is
  // never blank when results exist) rather than the old modal-era rule of
  // staying closed by default (that rule existed specifically to avoid an
  // unwanted popup; a right-side panel that's always part of the page has
  // no such risk).
  const selectedOpportunity = (selectedIdParam && filtered.find((o) => o.id === selectedIdParam)) || filtered[0];

  const items: ExploreListItem[] = filtered.map((o) => ({
    id: o.id,
    role: o.role,
    companyName: o.companyName,
    companyVerified: o.companyVerified,
    shortDescription: o.shortDescription,
    description: o.description,
    location: o.location,
    workMode: o.workMode,
    duration: o.duration,
    hoursPerWeek: o.hoursPerWeek,
    skills: o.skills,
    saved: savedIds.has(o.id),
    isNew: isWithinLastWeek(o.createdAt),
    estimatedMinutes: publishedChallengeInfo.get(o.id)?.estimatedMinutes,
    matchScore: o.matchScore,
  }));

  const initialDetail = selectedOpportunity ? await loadOpportunityDetail(selectedOpportunity.id, user.id) : null;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
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
          <span className="flex items-center gap-1.5 rounded-full border border-navy/10 bg-white pl-3 pr-1 text-sm text-navy/70">
            <MapPin className="size-3.5 shrink-0 text-navy/40" aria-hidden="true" />
            <label htmlFor="opportunity-location" className="sr-only">Location</label>
            <select id="opportunity-location" name="location" defaultValue={location} className="h-9 rounded-full bg-transparent pr-2 text-sm text-navy focus-visible:outline-none">
              <option value="">All locations</option>
              {locations.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </span>
          {categories.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-navy/10 bg-white pl-3 pr-1 text-sm text-navy/70">
              <SlidersHorizontal className="size-3.5 shrink-0 text-navy/40" aria-hidden="true" />
              <label htmlFor="opportunity-category" className="sr-only">Field</label>
              <select id="opportunity-category" name="category" defaultValue={category} className="h-9 rounded-full bg-transparent pr-2 text-sm text-navy focus-visible:outline-none">
                <option value="">Any field</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </span>
          )}
          <span className="flex items-center gap-1.5 rounded-full border border-navy/10 bg-white pl-3 pr-1 text-sm text-navy/70">
            <Clock3 className="size-3.5 shrink-0 text-navy/40" aria-hidden="true" />
            <label htmlFor="opportunity-duration" className="sr-only">Duration</label>
            <select id="opportunity-duration" name="duration" defaultValue={duration} className="h-9 rounded-full bg-transparent pr-2 text-sm text-navy focus-visible:outline-none">
              <option value="">Any duration</option>
              {durations.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-navy/10 bg-white pl-3 pr-1 text-sm text-navy/70">
            <Monitor className="size-3.5 shrink-0 text-navy/40" aria-hidden="true" />
            <label htmlFor="opportunity-work-mode" className="sr-only">Work mode</label>
            <select id="opportunity-work-mode" name="workMode" defaultValue={workMode} className="h-9 rounded-full bg-transparent pr-2 text-sm text-navy focus-visible:outline-none">
              <option value="">Any work mode</option>
              <option value="onsite">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option>
            </select>
          </span>
          <label htmlFor="opportunity-hours" className="sr-only">Hours per week</label>
          <select id="opportunity-hours" name="hours" defaultValue={hoursBucket} className="h-9 rounded-full border border-navy/10 bg-white px-3 text-sm text-navy/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
            <option value="">Any hours/week</option>
            <option value="under10">Up to 10h/week</option>
            <option value="11to20">11–20h/week</option>
            <option value="21to30">21–30h/week</option>
            <option value="over30">30h/week+</option>
          </select>
          <label className="flex h-9 items-center gap-1.5 rounded-full border border-navy/10 bg-white px-3 text-sm text-navy/68"><input type="checkbox" name="saved" value="1" defaultChecked={savedOnly} className="size-3.5 rounded border-navy/30 accent-teal" />Saved only</label>
          <label htmlFor="opportunity-sort" className="sr-only">Sort opportunities</label>
          <select id="opportunity-sort" name="sort" defaultValue={sort} className="h-9 rounded-full border border-navy/10 bg-white px-3 text-sm text-navy/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 sm:ml-auto">
            <option value="relevant">Most relevant</option><option value="newest">Newest first</option><option value="deadline">Deadline soon</option>
          </select>
          <Button type="submit" variant="outline" className="h-9 border-teal/20 bg-white px-3 text-teal-ink hover:bg-teal/5">Apply</Button>
          {hasActiveFilters ? <Link href="/student/opportunities" className="rounded-md px-1 text-sm font-medium text-navy/50 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">Clear all</Link> : null}
        </div>
      </form>

      {filtered.length === 0 ? (
        opportunities.length === 0 ? <EmptyState icon={SearchX} title="No published opportunities yet" description="Companies are still preparing their internships. Check back soon." /> : <EmptyState icon={SearchX} title="No opportunities match these filters" description="Try a broader search or clear one of the filters." ctaLabel="Clear filters" ctaHref="/student/opportunities" />
      ) : (
        <>
          <p className="mt-4 text-sm font-semibold text-navy">{filtered.length} {filtered.length === 1 ? "opportunity" : "opportunities"}</p>
          <ExploreSplitView
            key={baseQueryString}
            items={items}
            baseQueryString={baseQueryString}
            initialSelectedId={selectedOpportunity?.id ?? null}
            initialDetail={initialDetail}
          />
        </>
      )}
    </div>
  );
}
