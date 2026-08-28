import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { getCompanyHomeData } from "@/lib/company/home-data";
import { CompanyPageContainer, CompanyPageHeader } from "@/components/company/page-shell";
import { MetricCard } from "@/components/company/metric-card";
import { InternStatusBadge } from "@/components/company/status-badges";
import { QuerySelect } from "@/components/company/query-select";
import { ExportCsvButton } from "@/components/company/export-csv-button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { GraduationCap, Users, TriangleAlert, ShieldAlert, SearchX } from "lucide-react";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "on_track", label: "On track" },
  { value: "needs_attention", label: "Needs attention" },
  { value: "behind_schedule", label: "Behind schedule" },
  { value: "completed", label: "Completed" },
];

export default async function CompanyInternsPage({
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
  const statusFilter = typeof params.status === "string" ? params.status : "all";

  const rowsWithDisplayStatus = data.allInternRows.map((r) => ({
    ...r,
    displayStatus: r.programStatus === "completed" ? ("completed" as const) : r.severity,
  }));

  const onTrackCount = rowsWithDisplayStatus.filter((r) => r.programStatus === "active" && (r.severity === "on_track" || r.severity === "not_started")).length;
  const needsAttentionCount = rowsWithDisplayStatus.filter((r) => r.programStatus === "active" && r.severity === "needs_attention").length;
  const behindCount = rowsWithDisplayStatus.filter((r) => r.programStatus === "active" && r.severity === "behind_schedule").length;

  let rows = rowsWithDisplayStatus;
  if (statusFilter !== "all") rows = rows.filter((r) => r.displayStatus === statusFilter);
  if (q) rows = rows.filter((r) => r.internName.toLowerCase().includes(q) || r.role.toLowerCase().includes(q));

  const csvRows = rows.map((r) => [
    r.internName,
    r.role,
    `Week ${r.currentWeekNumber} of ${r.durationWeeks}`,
    `${r.tasksDone}/${r.tasksTotal}`,
    r.displayStatus,
  ]);

  return (
    <CompanyPageContainer>
      <CompanyPageHeader
        eyebrow="Interns"
        title="All interns"
        description="Every internship program, active and completed."
        actions={
          <ExportCsvButton
            filename="interns.csv"
            headers={["Intern", "Role", "Program progress", "Tasks", "Status"]}
            rows={csvRows}
          />
        }
      />

      {data.allInternRows.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No interns yet"
          description="Once you invite a candidate and they accept, their internship program will show up here."
        />
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard icon={GraduationCap} label="Total interns" value={data.allInternRows.length} />
            <MetricCard icon={Users} label="On track" value={onTrackCount} />
            <MetricCard icon={TriangleAlert} label="Needs attention" value={needsAttentionCount} />
            <MetricCard icon={ShieldAlert} label="Behind schedule" value={behindCount} />
          </div>

          <Card className="mt-6 rounded-xl border border-navy/10 shadow-none ring-0">
            <CardContent className="px-0">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <form method="get">
                  <label htmlFor="intern-search" className="sr-only">
                    Search interns or roles
                  </label>
                  <input
                    id="intern-search"
                    type="text"
                    name="q"
                    defaultValue={q}
                    placeholder="Search interns or roles..."
                    className="h-8 w-56 rounded-lg border border-navy/15 bg-white px-3 text-sm text-navy placeholder:text-navy/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
                  />
                </form>
                <QuerySelect param="status" value={statusFilter} options={STATUS_FILTER_OPTIONS} className="h-8" />
              </div>

              {rows.length === 0 ? (
                <div className="px-5 pb-2">
                  <EmptyState icon={SearchX} title="No interns match" description="Try a different search or status filter." />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-navy/10 hover:bg-transparent">
                      <TableHead className="pl-5 text-xs uppercase tracking-wide text-navy/45">Intern</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-navy/45">Role</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-navy/45">Program progress</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-navy/45">Tasks</TableHead>
                      <TableHead className="pr-5 text-xs uppercase tracking-wide text-navy/45">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const weekPct = row.durationWeeks > 0 ? Math.round((row.currentWeekNumber / row.durationWeeks) * 100) : 0;
                      const taskPct = row.tasksTotal > 0 ? Math.round((row.tasksDone / row.tasksTotal) * 100) : 0;
                      return (
                        <TableRow key={row.programId} className="border-navy/8">
                          <TableCell className="pl-5">
                            <Link href={`/company/offers/${row.offerId}/program`} className="flex items-center gap-2.5">
                              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-navy/8 text-xs font-semibold text-navy/60">
                                {row.internName.charAt(0).toUpperCase()}
                              </span>
                              <span className="font-medium text-navy hover:text-teal-ink">{row.internName}</span>
                            </Link>
                          </TableCell>
                          <TableCell className="text-navy/65">{row.role}</TableCell>
                          <TableCell className="min-w-40">
                            <p className="text-xs text-navy/55">
                              Week {row.currentWeekNumber} of {row.durationWeeks}
                            </p>
                            <Progress value={weekPct} className="mt-1 w-32" />
                            <p className="mt-0.5 text-xs text-navy/45">{weekPct}% complete</p>
                          </TableCell>
                          <TableCell className="min-w-32">
                            <p className="text-xs text-navy/55">
                              {row.tasksDone} of {row.tasksTotal}
                            </p>
                            <Progress value={taskPct} className="mt-1 w-24" />
                            <p className="mt-0.5 text-xs text-navy/45">{taskPct}% complete</p>
                          </TableCell>
                          <TableCell className="pr-5">
                            <InternStatusBadge severity={row.programStatus === "completed" ? "completed" : row.severity} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              <p className="px-5 py-3 text-xs text-navy/45">
                Showing 1 to {rows.length} of {rows.length} intern{rows.length === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </CompanyPageContainer>
  );
}
