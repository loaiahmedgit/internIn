import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { getCompanyCandidates } from "@/lib/company/candidates-data";
import { stageKeyOf } from "@/lib/company/candidate-stage";
import { CompanyPageContainer } from "@/components/company/page-shell";
import { QuerySelect } from "@/components/company/query-select";
import { ExportCsvButton } from "@/components/company/export-csv-button";
import { CandidateTableRow } from "@/components/company/candidate-table-row";
import { CandidateDrawer } from "@/components/company/candidate-drawer";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Users, SearchX, ChevronRight } from "lucide-react";

type TabKey = "to_review" | "shortlisted" | "invited" | "declined" | "all";
const TABS: { key: TabKey; label: string }[] = [
  { key: "to_review", label: "To review" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "invited", label: "Invited" },
  { key: "declined", label: "Passed" },
  { key: "all", label: "All" },
];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

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
  const tab: TabKey = TABS.some((t) => t.key === params.tab) ? (params.tab as TabKey) : "to_review";
  const opportunityFilter = typeof params.opportunity === "string" ? params.opportunity : "all";
  const sort = params.sort === "oldest" ? "oldest" : "newest";

  const withKey = rows.map((r) => ({ ...r, key: stageKeyOf(r) }));
  const counts = {
    to_review: withKey.filter((r) => r.key === "to_review").length,
    shortlisted: withKey.filter((r) => r.key === "shortlisted").length,
    invited: withKey.filter((r) => r.key === "invited").length,
    declined: withKey.filter((r) => r.key === "declined").length,
    all: withKey.length,
  };

  let filtered = tab === "all" ? withKey : withKey.filter((r) => r.key === tab);
  if (opportunityFilter !== "all") filtered = filtered.filter((r) => r.opportunityId === opportunityFilter);
  if (q) {
    filtered = filtered.filter(
      (r) => r.studentName.toLowerCase().includes(q) || r.studentEmail.toLowerCase().includes(q),
    );
  }
  filtered = [...filtered].sort((a, b) => {
    const at = a.submittedAt?.getTime() ?? 0;
    const bt = b.submittedAt?.getTime() ?? 0;
    return sort === "newest" ? bt - at : at - bt;
  });

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
          <ExportCsvButton
            filename="candidates.csv"
            label="Export candidates"
            headers={["Candidate", "Email", "Internship", "Stage", "Evidence", "Submitted"]}
            rows={filtered.map((r) => [
              r.studentName,
              r.studentEmail,
              r.role,
              r.key,
              r.hasSubmission ? `${r.artifacts.length} file(s)` : "Not submitted",
              r.submittedAt ? r.submittedAt.toISOString() : "",
            ])}
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
        <Card className="mt-4 rounded-xl border border-navy/10 shadow-none ring-0">
          <CardContent className="px-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/8 px-4">
              <div className="flex flex-wrap gap-1">
                {TABS.map((t) => (
                  <Link
                    key={t.key}
                    href={t.key === "to_review" ? "/company/candidates" : `/company/candidates?tab=${t.key}`}
                    className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-sm font-medium transition-colors ${
                      tab === t.key ? "border-teal text-teal-ink" : "border-transparent text-navy/50 hover:text-navy"
                    }`}
                  >
                    {t.label}
                    <span className="rounded-full bg-gray-light px-1.5 py-0.5 text-xs text-navy/50">{counts[t.key]}</span>
                  </Link>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 py-2.5">
                <form method="get" className="flex items-center gap-2">
                  {tab !== "to_review" && <input type="hidden" name="tab" value={tab} />}
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
                  options={[{ value: "all", label: "All internships" }, ...roleOptions.map((o) => ({ value: o.id, label: o.role }))]}
                  className="h-8"
                />
                <QuerySelect param="sort" value={sort} options={SORT_OPTIONS} className="h-8" />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="px-4 pb-2">
                <EmptyState icon={SearchX} title="Nothing here" description="No candidates match this view." />
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow className="border-navy/10 hover:bg-transparent">
                    <TableHead className="pl-4 text-xs uppercase tracking-wide text-navy/65">Candidate</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-navy/65">Contact</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-navy/65">Internship</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-navy/65">Evidence</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-navy/65">Submitted</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-navy/65">Stage</TableHead>
                    <TableHead className="pr-4 text-right text-xs uppercase tracking-wide text-navy/65">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <CandidateTableRow key={row.applicationId} row={row} />
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="px-4 py-3 text-xs text-navy/45">
              Showing 1 to {filtered.length} of {filtered.length} candidate{filtered.length === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
      )}

      <CandidateDrawer candidates={rows} />
    </CompanyPageContainer>
  );
}
