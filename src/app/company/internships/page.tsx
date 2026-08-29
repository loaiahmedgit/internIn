import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getCompanyHomeData } from "@/lib/company/home-data";
import { CompanyPageContainer } from "@/components/company/page-shell";
import { Badge } from "@/components/ui/badge";
import { QuerySelect } from "@/components/company/query-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { InternshipRowActions } from "@/components/company/internship-row-actions";
import { formatDeadline } from "@/lib/format-date";
import { Sparkles, SearchX, ChevronRight } from "lucide-react";

const WORK_MODE_LABEL: Record<string, string> = { remote: "Remote", onsite: "On-site", hybrid: "Hybrid" };

/**
 * Wording local to this page only — Home still shows "Published" via the
 * shared InternshipStatusBadge, which is untouched. "Draft/Open/Closed"
 * matches the company's own internship lifecycle vocabulary; "open" is the
 * same underlying opportunities.status === "published" value.
 */
const INTERNSHIP_STATUS_LABEL: Record<string, string> = { draft: "Draft", published: "Open", closed: "Closed" };
const INTERNSHIP_STATUS_CLASS: Record<string, string> = {
  draft: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  published: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  closed: "bg-red-500/10 text-red-700 dark:text-red-400",
};

// Collapses the 5 real challenge statuses (draft/ai_generated/pending_approval/
// approved/published) plus "no challenge row at all" into the 3 states asked for.
const CHALLENGE_STATUS_LABEL: Record<string, string> = {
  none: "No challenge",
  draft: "Draft",
  pending_approval: "Draft",
  approved: "Draft",
  published: "Live",
};
const CHALLENGE_STATUS_CLASS: Record<string, string> = {
  none: "",
  draft: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  pending_approval: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  approved: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  published: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

type TabKey = "all" | "published" | "draft" | "closed";
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Open" },
  { key: "draft", label: "Draft" },
  { key: "closed", label: "Closed" },
];
const SORT_OPTIONS = [
  { value: "newest", label: "Sort: Newest" },
  { value: "oldest", label: "Sort: Oldest" },
];

export default async function CompanyInternshipsPage({
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

  const data = await getCompanyHomeData(membership.company.id);
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const tab: TabKey = TABS.some((t) => t.key === params.tab) ? (params.tab as TabKey) : "all";
  const sort = params.sort === "oldest" ? "oldest" : "newest";

  const counts = {
    all: data.internshipActivity.length,
    published: data.internshipActivity.filter((r) => r.status === "published").length,
    draft: data.internshipActivity.filter((r) => r.status === "draft").length,
    closed: data.internshipActivity.filter((r) => r.status === "closed").length,
  };

  let rows = data.internshipActivity;
  if (tab !== "all") rows = rows.filter((r) => r.status === tab);
  if (q) rows = rows.filter((r) => r.role.toLowerCase().includes(q) || r.location.toLowerCase().includes(q));
  rows = [...rows].sort((a, b) =>
    sort === "newest" ? b.createdAt.getTime() - a.createdAt.getTime() : a.createdAt.getTime() - b.createdAt.getTime(),
  );

  return (
    <CompanyPageContainer>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-navy/45">
        <Link href="/company/dashboard" className="hover:text-navy">
          Home
        </Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span className="text-navy/70">Internships</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-navy">Internships</h1>
          <p className="text-sm text-navy/55">Manage all your internship postings and their progress.</p>
        </div>
        <Button render={<Link href="/company/opportunities/new" />} nativeButton={false} className="bg-teal text-white hover:bg-teal/90">
          <Sparkles className="size-4" /> Create internship
        </Button>
      </div>

      {data.internshipActivity.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Create your first internship"
          description="Describe what your team needs help with and internIn will help structure the role and a realistic work challenge."
          ctaLabel="Create internship"
          ctaHref="/company/opportunities/new"
        />
      ) : (
        <Card className="mt-4 rounded-xl border border-navy/10 shadow-none ring-0">
          <CardContent className="px-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/8 px-5">
              <div className="flex gap-1 border-b border-transparent">
                {TABS.map((t) => (
                  <Link
                    key={t.key}
                    href={t.key === "all" ? "/company/internships" : `/company/internships?tab=${t.key}`}
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
                  {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
                  <label htmlFor="internship-search" className="sr-only">
                    Search internships
                  </label>
                  <input
                    id="internship-search"
                    type="text"
                    name="q"
                    defaultValue={q}
                    placeholder="Search internships..."
                    className="h-8 w-52 rounded-lg border border-navy/15 bg-white px-3 text-sm text-navy placeholder:text-navy/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
                  />
                </form>
                <QuerySelect param="sort" value={sort} options={SORT_OPTIONS} className="h-8" />
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="px-5 pb-2">
                <EmptyState icon={SearchX} title="No internships match" description="Try a different search or tab." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-navy/10 hover:bg-transparent">
                    <TableHead className="pl-5 text-xs uppercase tracking-wide text-navy/45">Internship</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-navy/45">Duration</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-navy/45">Location</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-navy/45">Mode</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wide text-navy/45">Applicants</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-navy/45">Deadline</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-navy/45">Challenge</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-navy/45">Status</TableHead>
                    <TableHead className="pr-5 text-right text-xs uppercase tracking-wide text-navy/45">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.opportunityId} className="border-navy/8">
                      <TableCell className="max-w-56 pl-5">
                        <Link
                          href={
                            row.status === "draft"
                              ? `/company/opportunities/${row.opportunityId}/setup`
                              : `/company/opportunities/${row.opportunityId}`
                          }
                          className="block truncate font-medium text-navy hover:text-teal-ink"
                        >
                          {row.role}
                        </Link>
                      </TableCell>
                      <TableCell className="text-navy/65">{row.duration}</TableCell>
                      <TableCell className="max-w-40 truncate text-navy/65">{row.location}</TableCell>
                      <TableCell className="text-navy/65">{row.workMode ? WORK_MODE_LABEL[row.workMode] : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-navy/65">{row.applicantCount}</TableCell>
                      <TableCell className="text-navy/65">
                        {row.applicationDeadline ? formatDeadline(row.applicationDeadline) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={CHALLENGE_STATUS_CLASS[row.challengeStatus] ?? ""}>
                          {CHALLENGE_STATUS_LABEL[row.challengeStatus] ?? row.challengeStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={INTERNSHIP_STATUS_CLASS[row.status]}>
                          {INTERNSHIP_STATUS_LABEL[row.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <InternshipRowActions
                          opportunityId={row.opportunityId}
                          status={row.status}
                          role={row.role}
                          editDetails={{
                            role: row.role,
                            duration: row.duration,
                            hoursPerWeek: row.hoursPerWeek,
                            location: row.location,
                            workMode: row.workMode,
                            applicationDeadline: row.applicationDeadline,
                            slots: row.slots,
                            skills: row.skills,
                            description: row.description,
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="px-5 py-3 text-xs text-navy/45">
              Showing 1 to {rows.length} of {rows.length} internship{rows.length === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
      )}
    </CompanyPageContainer>
  );
}
