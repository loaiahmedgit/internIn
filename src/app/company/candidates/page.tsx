import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { getCompanyCandidates, type CandidateRow } from "@/lib/company/candidates-data";
import { stageKeyOf, STAGE_LABEL, STAGE_CLASS } from "@/lib/company/candidate-stage";
import { CompanyPageContainer } from "@/components/company/page-shell";
import { QuerySelect } from "@/components/company/query-select";
import { ExportCandidatesMenu } from "@/components/company/export-candidates-menu";
import { CandidateTableRow } from "@/components/company/candidate-table-row";
import { Pagination } from "@/components/company/pagination";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Users, SearchX, ChevronRight, Clock, Star, Send } from "lucide-react";

type TabKey = "all" | "to_review" | "shortlisted" | "invited";
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "to_review", label: "To review" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "invited", label: STAGE_LABEL.invited },
];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];
const PAGE_SIZE = 10;

// Icon + color pairing per stage — the exact same STAGE_CLASS recipe the
// table badge and the profile badge use, so a summary card, a table row,
// and the candidate profile can never show three different colors for the
// same real stage.
const SUMMARY_META: { key: "all" | "to_review" | "shortlisted" | "invited"; label: string; icon: typeof Users; className: string }[] = [
  { key: "all", label: "Total candidates", icon: Users, className: "bg-teal/10 text-teal-ink" },
  { key: "to_review", label: "To review", icon: Clock, className: "bg-navy/8 text-navy/60" },
  { key: "shortlisted", label: "Shortlisted", icon: Star, className: STAGE_CLASS.shortlisted },
  { key: "invited", label: STAGE_LABEL.invited, icon: Send, className: STAGE_CLASS.invited },
];

function isArchived(row: CandidateRow): boolean {
  return row.status === "declined" || row.status === "withdrawn";
}
function isPrePipeline(row: CandidateRow): boolean {
  return row.status === "applied" && !row.hasSubmission;
}

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
  const isArchiveView = params.tab === "archive";
  const tab: TabKey = !isArchiveView && TABS.some((t) => t.key === params.tab) ? (params.tab as TabKey) : "all";
  const opportunityFilter = typeof params.opportunity === "string" ? params.opportunity : "all";
  const sort = params.sort === "oldest" ? "oldest" : "newest";
  const page = Math.max(1, Number(params.page) || 1);

  // Real candidate lifecycle, simplified: pre-submission "applied" rows are
  // not ready for evaluation and never shown here; declined/withdrawn are
  // archived, reachable only through the subtle link below, never a main tab.
  const pipelineRows = rows.filter((r) => !isPrePipeline(r) && !isArchived(r));
  const archiveRows = rows.filter(isArchived);
  const withKey = pipelineRows.map((r) => ({ ...r, key: stageKeyOf(r) }));

  const counts = {
    all: withKey.length,
    to_review: withKey.filter((r) => r.key === "to_review").length,
    shortlisted: withKey.filter((r) => r.key === "shortlisted").length,
    invited: withKey.filter((r) => r.key === "invited").length,
  };

  let filtered = tab === "all" ? withKey : withKey.filter((r) => r.key === tab);
  if (opportunityFilter !== "all") filtered = filtered.filter((r) => r.opportunityId === opportunityFilter);
  if (q) {
    filtered = filtered.filter(
      (r) => r.studentName.toLowerCase().includes(q) || r.studentEmail.toLowerCase().includes(q),
    );
  }
  filtered = [...filtered].sort((a, b) => (sort === "newest" ? b.appliedAt.getTime() - a.appliedAt.getTime() : a.appliedAt.getTime() - b.appliedAt.getTime()));

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function buildHref(overrides: Record<string, string | number | undefined>) {
    const next = new URLSearchParams();
    const merged = { tab: tab === "all" ? undefined : tab, q: q || undefined, opportunity: opportunityFilter === "all" ? undefined : opportunityFilter, sort: sort === "newest" ? undefined : sort, page: page === 1 ? undefined : String(page), ...overrides };
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
        <Link href="/company/dashboard" className="hover:text-navy">
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
            active={pipelineRows.map(toCsvRow)}
            notSelected={archiveRows.map(toCsvRow)}
            all={rows.filter((r) => !isPrePipeline(r)).map(toCsvRow)}
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
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SUMMARY_META.map((s) => (
              <div key={s.key} className="flex items-center gap-2.5 rounded-xl border border-navy/10 bg-white px-4 py-3">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${s.className}`}>
                  <s.icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg leading-none font-semibold tabular-nums text-navy">{counts[s.key]}</p>
                  <p className="mt-1 truncate text-xs text-navy/50">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          <Card className="mt-4 rounded-xl border border-navy/10 shadow-none ring-0">
            <CardContent className="px-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/8 px-4">
                <div className="flex flex-wrap items-center gap-1">
                  {TABS.map((t) => (
                    <Link
                      key={t.key}
                      href={t.key === "all" ? "/company/candidates" : `/company/candidates?tab=${t.key}`}
                      className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-sm font-medium transition-colors ${
                        tab === t.key && !isArchiveView ? "border-teal text-teal-ink" : "border-transparent text-navy/50 hover:text-navy"
                      }`}
                    >
                      {t.label}
                      <span className="rounded-full bg-gray-light px-1.5 py-0.5 text-xs text-navy/50">{counts[t.key]}</span>
                    </Link>
                  ))}
                  {archiveRows.length > 0 && (
                    <Link
                      href="/company/candidates?tab=archive"
                      className={`ml-2 text-xs font-medium underline-offset-2 hover:underline ${
                        isArchiveView ? "text-teal-ink" : "text-navy/40"
                      }`}
                    >
                      Not selected ({archiveRows.length})
                    </Link>
                  )}
                </div>
                {!isArchiveView && (
                  <div className="flex flex-wrap items-center gap-2 py-2.5">
                    <form method="get" className="flex items-center gap-2">
                      {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
                      {opportunityFilter !== "all" && <input type="hidden" name="opportunity" value={opportunityFilter} />}
                      {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
                      <label htmlFor="candidate-search" className="sr-only">
                        Search candidates
                      </label>
                      <input
                        id="candidate-search"
                        type="text"
                        name="q"
                        defaultValue={q}
                        placeholder="Search candidates..."
                        className="h-8 w-52 rounded-lg border border-navy/15 bg-white px-3 text-sm text-navy placeholder:text-navy/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
                      />
                    </form>
                    <QuerySelect
                      param="opportunity"
                      value={opportunityFilter}
                      resetParam="page"
                      options={[{ value: "all", label: "All internships" }, ...roleOptions.map((o) => ({ value: o.id, label: o.role }))]}
                      className="h-8"
                    />
                    <QuerySelect param="sort" value={sort} resetParam="page" options={SORT_OPTIONS} className="h-8" />
                  </div>
                )}
              </div>

              {isArchiveView ? (
                archiveRows.length === 0 ? (
                  <div className="px-4 pb-2">
                    <EmptyState icon={SearchX} title="Nothing archived" description="Rejected or withdrawn candidates will show up here." />
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow className="border-navy/10 hover:bg-transparent">
                        <TableHead className="pl-4 text-xs uppercase tracking-wide text-navy/65">Candidate</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-navy/65">Contact</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-navy/65">Internship</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-navy/65">Applied</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-navy/65">Stage</TableHead>
                        <TableHead className="pr-4 text-right text-xs uppercase tracking-wide text-navy/65">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archiveRows.map((row) => (
                        <CandidateTableRow key={row.applicationId} row={row} />
                      ))}
                    </TableBody>
                  </Table>
                )
              ) : filtered.length === 0 ? (
                <div className="px-4 pb-2">
                  <EmptyState icon={SearchX} title="Nothing here" description="No candidates match this view." />
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow className="border-navy/10 hover:bg-transparent">
                        <TableHead className="pl-4 text-xs uppercase tracking-wide text-navy/65">Candidate</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-navy/65">Contact</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-navy/65">Internship</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-navy/65">Applied</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-navy/65">Stage</TableHead>
                        <TableHead className="pr-4 text-right text-xs uppercase tracking-wide text-navy/65">Actions</TableHead>
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
