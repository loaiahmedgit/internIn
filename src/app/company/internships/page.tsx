import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getCompanyHomeData } from "@/lib/company/home-data";
import { CompanyPageContainer, CompanyPageHeader } from "@/components/company/page-shell";
import { InternshipStatusBadge, ChallengeStatusBadge } from "@/components/company/status-badges";
import { QuerySelect } from "@/components/company/query-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Sparkles, SearchX, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TabKey = "all" | "published" | "draft";
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Draft" },
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
  };

  let rows = data.internshipActivity;
  if (tab !== "all") rows = rows.filter((r) => r.status === tab);
  if (q) rows = rows.filter((r) => r.role.toLowerCase().includes(q) || r.location.toLowerCase().includes(q));
  rows = [...rows].sort((a, b) =>
    sort === "newest" ? b.createdAt.getTime() - a.createdAt.getTime() : a.createdAt.getTime() - b.createdAt.getTime(),
  );

  return (
    <CompanyPageContainer>
      <CompanyPageHeader
        eyebrow="Internships"
        title="All internships"
        description={data.internshipActivity.length > 0 ? `${counts.published} published · ${counts.all} total` : undefined}
        actions={
          <Button render={<Link href="/company/opportunities/new" />} nativeButton={false} className="bg-teal text-white hover:bg-teal/90">
            <Sparkles className="size-4" /> Create internship
          </Button>
        }
      />

      {data.internshipActivity.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Create your first internship"
          description="Describe what your team needs help with and internIn will help structure the role and a realistic work challenge."
          ctaLabel="Create internship"
          ctaHref="/company/opportunities/new"
        />
      ) : (
        <Card className="mt-6 rounded-xl border border-navy/10 shadow-none ring-0">
          <CardContent className="px-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5">
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
                    <TableHead className="text-xs uppercase tracking-wide text-navy/45">Location / Mode</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-navy/45">Applicants</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-navy/45">Challenge status</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-navy/45">Status</TableHead>
                    <TableHead className="pr-5 text-right text-xs uppercase tracking-wide text-navy/45">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.opportunityId} className="border-navy/8">
                      <TableCell className="pl-5">
                        <Link
                          href={
                            row.status === "draft"
                              ? `/company/opportunities/${row.opportunityId}/setup`
                              : `/company/opportunities/${row.opportunityId}`
                          }
                          className="font-medium text-navy hover:text-teal-ink"
                        >
                          {row.role}
                        </Link>
                      </TableCell>
                      <TableCell className="text-navy/65">{row.duration}</TableCell>
                      <TableCell className="text-navy/65">{row.location}</TableCell>
                      <TableCell className="text-navy/65">{row.applicantCount || "—"}</TableCell>
                      <TableCell>
                        <ChallengeStatusBadge status={row.challengeStatus} />
                      </TableCell>
                      <TableCell>
                        <InternshipStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.role}`} />}>
                            <MoreHorizontal className="size-4" aria-hidden="true" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              render={
                                <Link
                                  href={
                                    row.status === "draft"
                                      ? `/company/opportunities/${row.opportunityId}/setup`
                                      : `/company/opportunities/${row.opportunityId}`
                                  }
                                />
                              }
                            >
                              {row.status === "draft" ? "Continue setup" : "View candidates"}
                            </DropdownMenuItem>
                            {row.status === "published" && (
                              <DropdownMenuItem render={<Link href={`/opportunities/${row.opportunityId}`} />}>
                                View public listing
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
