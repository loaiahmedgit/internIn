import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { getCompanyCandidates, type CandidateRow } from "@/lib/company/candidates-data";
import { CompanyPageContainer, CompanyPageHeader } from "@/components/company/page-shell";
import { CandidateStatusBadge, type CandidateStatusKey } from "@/components/company/status-badges";
import { QuerySelect } from "@/components/company/query-select";
import { CandidateRowActions } from "@/components/company/candidate-row-actions";
import { ExportCsvButton } from "@/components/company/export-csv-button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Users, SearchX } from "lucide-react";
import Link from "next/link";

type TabKey = "to_review" | "shortlisted" | "invited" | "declined" | "all";
const TABS: { key: TabKey; label: string }[] = [
  { key: "to_review", label: "To review" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "invited", label: "Invited" },
  { key: "declined", label: "Passed" },
  { key: "all", label: "All" },
];

function candidateStatusKey(row: CandidateRow): CandidateStatusKey {
  if (row.status === "applied" && row.hasSubmission) return "to_review";
  return row.status as CandidateStatusKey;
}

function relativeDate(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
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
  const tab: TabKey = TABS.some((t) => t.key === params.tab) ? (params.tab as TabKey) : "to_review";
  const opportunityFilter = typeof params.opportunity === "string" ? params.opportunity : "all";
  const sort = params.sort === "oldest" ? "oldest" : "newest";

  const withKey = rows.map((r) => ({ ...r, key: candidateStatusKey(r) }));
  const counts = {
    to_review: withKey.filter((r) => r.key === "to_review").length,
    shortlisted: withKey.filter((r) => r.key === "shortlisted").length,
    invited: withKey.filter((r) => r.key === "invited").length,
    declined: withKey.filter((r) => r.key === "declined").length,
    all: withKey.length,
  };

  let filtered = tab === "all" ? withKey : withKey.filter((r) => r.key === tab);
  if (opportunityFilter !== "all") filtered = filtered.filter((r) => r.opportunityId === opportunityFilter);
  filtered = [...filtered].sort((a, b) => {
    const at = a.submittedAt?.getTime() ?? 0;
    const bt = b.submittedAt?.getTime() ?? 0;
    return sort === "newest" ? bt - at : at - bt;
  });

  return (
    <CompanyPageContainer>
      <CompanyPageHeader
        eyebrow="Candidates"
        title="Candidates to review"
        description="Challenge submissions waiting for a decision — shortlist, invite, or pass."
        actions={
          rows.length > 0 ? (
            <ExportCsvButton
              filename="candidates.csv"
              label="Export candidates"
              headers={["Candidate", "Email", "Internship", "Status", "Evidence", "Submitted"]}
              rows={filtered.map((r) => [
                r.studentName,
                r.studentEmail,
                r.role,
                r.key,
                r.evidenceSummary ?? "",
                r.submittedAt ? r.submittedAt.toISOString() : "",
              ])}
            />
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No candidates yet"
          description="Once students apply and submit a Challenge, they'll show up here for you to evaluate."
        />
      ) : (
        <Card className="mt-6 rounded-xl border border-navy/10 shadow-none ring-0">
          <CardContent className="px-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5">
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
                <QuerySelect
                  param="opportunity"
                  value={opportunityFilter}
                  options={[{ value: "all", label: "All internships" }, ...roleOptions.map((o) => ({ value: o.id, label: o.role }))]}
                  className="h-8"
                />
                <QuerySelect
                  param="sort"
                  value={sort}
                  options={[
                    { value: "newest", label: "Newest first" },
                    { value: "oldest", label: "Oldest first" },
                  ]}
                  className="h-8"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="px-5 pb-2">
                <EmptyState icon={SearchX} title="Nothing here" description="No candidates match this view." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-navy/10 hover:bg-transparent">
                    <TableHead className="pl-5 text-xs uppercase tracking-wide text-navy/45">Candidate</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-navy/45">Internship</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-navy/45">Status</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-navy/45">Evidence</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-navy/45">Submitted</TableHead>
                    <TableHead className="pr-5 text-right text-xs uppercase tracking-wide text-navy/45">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.applicationId} className="border-navy/8">
                      <TableCell className="max-w-44 pl-5">
                        <div className="flex items-center gap-2">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-navy/8 text-xs font-semibold text-navy/60">
                            {row.studentName.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-navy">{row.studentName}</p>
                            <p className="truncate text-xs text-navy/45">{row.studentEmail}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-32 truncate text-navy/65">{row.role}</TableCell>
                      <TableCell>
                        <CandidateStatusBadge status={row.key} />
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-navy/65">
                        {row.evidenceSummary ?? (row.hasSubmission ? "Submitted — not yet evaluated" : "No submission yet")}
                      </TableCell>
                      <TableCell className="text-navy/65">{row.submittedAt ? relativeDate(row.submittedAt) : "—"}</TableCell>
                      <TableCell className="pr-5">
                        <CandidateRowActions
                          applicationId={row.applicationId}
                          submissionId={row.submissionId}
                          status={row.status}
                          hasOffer={row.hasOffer}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="px-5 py-3 text-xs text-navy/45">
              Showing 1 to {filtered.length} of {filtered.length} candidate{filtered.length === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
      )}
    </CompanyPageContainer>
  );
}
