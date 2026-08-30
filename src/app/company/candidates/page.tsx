import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { getCompanyCandidates, type CandidateRow } from "@/lib/company/candidates-data";
import { stageKeyOf, STAGE_LABEL, STAGE_ICON_COLOR } from "@/lib/company/candidate-stage";
import { CompanyPageContainer } from "@/components/company/page-shell";
import { QuerySelect } from "@/components/company/query-select";
import { ExportCandidatesMenu } from "@/components/company/export-candidates-menu";
import { CandidateTableRow } from "@/components/company/candidate-table-row";
import { CandidateSummaryCard } from "@/components/company/candidate-summary-card";
import { Pagination } from "@/components/company/pagination";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Archive, Users, SearchX, ChevronRight, Clock3, Star, Send, Search } from "lucide-react";

type TabKey = "all" | "to_review" | "shortlisted" | "invited";
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "to_review", label: STAGE_LABEL.to_review },
  { key: "shortlisted", label: STAGE_LABEL.shortlisted },
  { key: "invited", label: STAGE_LABEL.invited },
];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];
const PAGE_SIZE = 10;

// Icon + color pairing per stage. The same hue STAGE_ICON_COLOR/STAGE_CLASS
// use for the table badge and the profile badge, so a summary card, a table
// row, and the candidate profile can never show three different colors for
// the same real stage. Icons are colored text only, with no filled chip behind
// them, per the summary-card rule.
const SUMMARY_META: { key: "all" | "to_review" | "shortlisted" | "invited"; label: string; icon: typeof Users; iconColor: string }[] = [
  { key: "all", label: "Active candidates", icon: Users, iconColor: "text-navy/40" },
  { key: "to_review", label: STAGE_LABEL.to_review, icon: Clock3, iconColor: STAGE_ICON_COLOR.to_review },
  { key: "shortlisted", label: STAGE_LABEL.shortlisted, icon: Star, iconColor: STAGE_ICON_COLOR.shortlisted },
  { key: "invited", label: STAGE_LABEL.invited, icon: Send, iconColor: STAGE_ICON_COLOR.invited },
];

function isPrePipeline(row: CandidateRow): boolean {
  return row.status === "applied" && !row.hasSubmission;
}

function isArchived(row: CandidateRow): boolean {
  return row.status === "declined" || row.status === "withdrawn";
}

const TABLE_HEAD_CLASS = "text-xs uppercase tracking-wide text-navy/65";

export default async function CompanyCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const params = await searchParams;

  const db = getDb();
  const [membership] = await db
    .select({ company: schema.companies })
    .from(schema.companyMembers)
    .innerJoin(schema.companies, eq(schema.companyMembers.companyId, schema.companies.id))
    .where(eq(schema.companyMembers.userId, user.id))
    .limit(1);

  if (!membership) {
    return (
      <CompanyPageContainer>
        <p className="text-center text-navy/60">This account isn&apos;t linked to a company yet.</p>
      </CompanyPageContainer>
    );
  }

  const { rows, roleOptions } = await getCompanyCandidates(membership.company.id);
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  // Keep old archived URLs working while using a clearer query parameter for
  // new links. Archived candidates are history, not an active pipeline stage.
  const isArchiveView = params.view === "archived" || params.tab === "archive" || params.tab === "not_selected";
  const tab: TabKey = !isArchiveView && TABS.some((t) => t.key === params.tab) ? (params.tab as TabKey) : "all";
  const requestedOpportunityFilter = typeof params.opportunity === "string" ? params.opportunity : "all";
  const opportunityFilter =
    requestedOpportunityFilter === "all" || roleOptions.some((option) => option.id === requestedOpportunityFilter)
      ? requestedOpportunityFilter
      : "all";
  const sort = params.sort === "oldest" ? "oldest" : "newest";
  const requestedPage = Math.max(1, Number(params.page) || 1);

  // Pre-submission applications are not ready for evaluation. Declined and
  // withdrawn applications stay available for audit/export in the archive,
  // but never inflate the active pipeline or its summary counts.
  const reviewableRows = rows.filter((r) => !isPrePipeline(r));
  const activeRows = reviewableRows.filter((r) => !isArchived(r));
  const archivedRows = reviewableRows.filter(isArchived);
  const matchesOpportunity = (row: CandidateRow) =>
    opportunityFilter === "all" || row.opportunityId === opportunityFilter;
  const reviewableForOpportunity = reviewableRows.filter(matchesOpportunity);
  const activeForOpportunity = activeRows.filter(matchesOpportunity);
  const archivedForOpportunity = archivedRows.filter(matchesOpportunity);
  const activeWithKey = activeForOpportunity.map((r) => ({ ...r, key: stageKeyOf(r) }));
  const archivedWithKey = archivedForOpportunity.map((r) => ({ ...r, key: stageKeyOf(r) }));

  const counts = {
    all: activeWithKey.length,
    to_review: activeWithKey.filter((r) => r.key === "to_review").length,
    shortlisted: activeWithKey.filter((r) => r.key === "shortlisted").length,
    invited: activeWithKey.filter((r) => r.key === "invited").length,
  };

  const internshipCountRows = isArchiveView ? archivedRows : activeRows;
  const internshipCountById = new Map<string, number>();
  for (const row of internshipCountRows) {
    internshipCountById.set(row.opportunityId, (internshipCountById.get(row.opportunityId) ?? 0) + 1);
  }
  const internshipOptions = [
    { value: "all", label: "All internships", count: internshipCountRows.length },
    ...roleOptions.map((option) => ({
      value: option.id,
      label: option.role,
      count: internshipCountById.get(option.id) ?? 0,
    })),
  ];

  let filtered = isArchiveView
    ? archivedWithKey
    : tab === "all"
      ? activeWithKey
      : activeWithKey.filter((r) => r.key === tab);
  if (q) {
    filtered = filtered.filter(
      (r) => r.studentName.toLowerCase().includes(q) || r.studentEmail.toLowerCase().includes(q),
    );
  }
  filtered = [...filtered].sort((a, b) => (sort === "newest" ? b.appliedAt.getTime() - a.appliedAt.getTime() : a.appliedAt.getTime() - b.appliedAt.getTime()));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function buildHref(overrides: Record<string, string | number | undefined>) {
    const next = new URLSearchParams();
    const merged = {
      view: isArchiveView ? "archived" : undefined,
      tab: !isArchiveView && tab !== "all" ? tab : undefined,
      q: q || undefined,
      opportunity: opportunityFilter === "all" ? undefined : opportunityFilter,
      sort: sort === "newest" ? undefined : sort,
      page: page === 1 ? undefined : String(page),
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "") next.set(k, String(v));
    }
    const qs = next.toString();
    return qs ? `/company/candidates?${qs}` : "/company/candidates";
  }

  const csvHeaders = ["Candidate", "Email", "Internship", "Stage", "Applied"];
  const toCsvRow = (r: CandidateRow) => [r.studentName, r.studentEmail, r.role, STAGE_LABEL[stageKeyOf(r)] ?? r.status, r.appliedAt.toISOString()];

  return (
    <CompanyPageContainer>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-navy/45">
        <Link href="/company/dashboard" className="rounded-sm hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
          Home
        </Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span className="text-navy/70">Candidates</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-navy">Candidates</h1>
          <p className="text-sm text-navy/55">Review applicants and move the right people forward.</p>
        </div>
        {rows.length > 0 && (
          <ExportCandidatesMenu
            headers={csvHeaders}
            active={activeForOpportunity.map(toCsvRow)}
            archived={archivedForOpportunity.map(toCsvRow)}
            all={reviewableForOpportunity.map(toCsvRow)}
          />
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No candidates yet"
          description="Once students apply and submit a Challenge, they'll show up here for you to evaluate."
        />
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {SUMMARY_META.map((s) => (
              <CandidateSummaryCard
                key={s.key}
                icon={s.icon}
                iconColor={s.iconColor}
                label={s.label}
                value={counts[s.key]}
              />
            ))}
          </div>

          <Card className="mt-4 rounded-xl border border-navy/10 shadow-none ring-0">
            <CardContent className="px-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/8 px-4">
                <div className="flex flex-wrap items-center gap-1">
                  {TABS.map((t) => (
                    <Link
                      key={t.key}
                      href={buildHref({ view: undefined, tab: t.key === "all" ? undefined : t.key, page: undefined })}
                      className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 ${
                        !isArchiveView && tab === t.key ? "border-teal text-teal-ink" : "border-transparent text-navy/50 hover:text-navy"
                      }`}
                    >
                      {t.label}
                      <span className="rounded-full bg-gray-light px-1.5 py-0.5 text-xs tabular-nums text-navy/50">{counts[t.key]}</span>
                    </Link>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 py-2.5">
                  <QuerySelect
                    param="opportunity"
                    value={opportunityFilter}
                    resetParam="page"
                    ariaLabel="Filter by internship"
                    options={internshipOptions}
                    className="h-8 w-56"
                  />
                  <form method="get" className="relative flex items-center">
                    {isArchiveView ? (
                      <input type="hidden" name="view" value="archived" />
                    ) : (
                      tab !== "all" && <input type="hidden" name="tab" value={tab} />
                    )}
                    {opportunityFilter !== "all" && <input type="hidden" name="opportunity" value={opportunityFilter} />}
                    {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
                    <label htmlFor="candidate-search" className="sr-only">
                      Search candidates
                    </label>
                    <Search className="pointer-events-none absolute left-2.5 size-3.5 text-navy/35" aria-hidden="true" />
                    <input
                      id="candidate-search"
                      type="text"
                      name="q"
                      defaultValue={q}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Search candidates…"
                      className="h-8 w-52 rounded-lg border border-navy/15 bg-white pr-3 pl-8 text-sm text-navy placeholder:text-navy/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
                    />
                  </form>
                  <QuerySelect param="sort" value={sort} resetParam="page" ariaLabel="Sort candidates" options={SORT_OPTIONS} className="h-8" />
                  {archivedRows.length > 0 && (
                    <Link
                      href={buildHref({ view: "archived", tab: undefined, page: undefined })}
                      aria-current={isArchiveView ? "page" : undefined}
                      className={`flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 ${
                        isArchiveView
                          ? "bg-gray-light text-navy/70"
                          : "text-navy/45 hover:bg-gray-light/70 hover:text-navy/70"
                      }`}
                    >
                      <Archive className="size-3.5" aria-hidden="true" />
                      Archived candidates
                      <span className="tabular-nums">{archivedForOpportunity.length}</span>
                    </Link>
                  )}
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="px-4 pb-2">
                  <EmptyState
                    icon={SearchX}
                    title="Nothing here"
                    description={isArchiveView ? "No archived candidates match this view." : "No candidates match this view."}
                  />
                </div>
              ) : (
                <>
                  <Table className="min-w-[880px]">
                    <TableHeader className="bg-gray-50">
                      <TableRow className="border-navy/10 hover:bg-transparent">
                        <TableHead className={`pl-4 ${TABLE_HEAD_CLASS}`}>Candidate</TableHead>
                        <TableHead className={TABLE_HEAD_CLASS}>Contact</TableHead>
                        <TableHead className={TABLE_HEAD_CLASS}>Internship</TableHead>
                        <TableHead className={TABLE_HEAD_CLASS}>Applied</TableHead>
                        <TableHead className={TABLE_HEAD_CLASS}>Stage</TableHead>
                        <TableHead className={`pr-4 text-right ${TABLE_HEAD_CLASS}`}>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageRows.map((row) => (
                        <CandidateTableRow key={row.applicationId} row={row} />
                      ))}
                    </TableBody>
                  </Table>
                  <Pagination page={page} pageSize={PAGE_SIZE} totalCount={filtered.length} buildHref={(p) => buildHref({ page: p })} />
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </CompanyPageContainer>
  );
}
