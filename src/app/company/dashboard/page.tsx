import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getCompanyHomeData } from "@/lib/company/home-data";
import { CompanyPageContainer, CompanyPageHeader } from "@/components/company/page-shell";
import { MetricCard } from "@/components/company/metric-card";
import { InternshipStatusBadge, InternStatusBadge } from "@/components/company/status-badges";
import { TeamsIcon, SlackIcon, ZoomIcon, JiraIcon, NotionIcon } from "@/components/company/brand-icons";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  Briefcase,
  Users,
  GraduationCap,
  TriangleAlert,
  ArrowRight,
  Sparkles,
  MoreHorizontal,
  FileText,
  CalendarClock,
  FileSearch,
} from "lucide-react";

const ATTENTION_ICON = { review: FileSearch, schedule: CalendarClock, draft: FileText } as const;

const CHALLENGE_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  published: "Published",
  none: "Not started",
};

const INTEGRATIONS = [
  { name: "Microsoft Teams", icon: TeamsIcon },
  { name: "Slack", icon: SlackIcon },
  { name: "Zoom", icon: ZoomIcon },
  { name: "Jira", icon: JiraIcon },
  { name: "Notion", icon: NotionIcon },
];

export default async function CompanyHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

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
  const hasAnyInternships = data.internshipActivity.length > 0;

  return (
    <CompanyPageContainer>
      <CompanyPageHeader
        eyebrow="Company workspace"
        title={membership.company.name}
        description="Operations overview"
        actions={
          <Button render={<Link href="/company/opportunities/new" />} nativeButton={false} className="bg-teal text-white hover:bg-teal/90">
            <Sparkles className="size-4" /> Create internship
          </Button>
        }
      />

      {!hasAnyInternships ? (
        <EmptyState
          icon={Sparkles}
          title="Create your first internship"
          description="Describe what your team needs help with and internIn will help structure the role and a realistic work challenge."
          ctaLabel="Create internship"
          ctaHref="/company/opportunities/new"
        />
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard icon={Briefcase} label="Open internships" value={data.openInternships} />
            <MetricCard icon={Users} label="Candidates to review" value={data.candidatesToReview} />
            <MetricCard icon={GraduationCap} label="Active interns" value={data.activeInterns} />
            <MetricCard icon={TriangleAlert} label="Needs attention" value={data.needsAttentionCount} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-6">
              {/* Needs your attention — the most important section on the page */}
              <Card className="rounded-xl border border-navy/10 shadow-none ring-0">
                <CardContent className="px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TriangleAlert className="size-4 text-navy/40" aria-hidden="true" />
                      <h2 className="text-sm font-semibold text-navy">Needs your attention</h2>
                    </div>
                    {data.attentionItems.length > 0 && (
                      <span className="text-xs text-navy/45">{data.attentionItems.length} items require your attention</span>
                    )}
                  </div>
                  {data.attentionItems.length === 0 ? (
                    <p className="mt-4 text-sm text-navy/55">Nothing needs your attention right now.</p>
                  ) : (
                    <div className="mt-3 divide-y divide-navy/8">
                      {data.attentionItems.map((item) => {
                        const Icon = ATTENTION_ICON[item.icon];
                        return (
                          <div key={item.key} className="flex items-center gap-3 py-3">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-light">
                              <Icon className="size-4 text-navy/50" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-navy">{item.message}</p>
                              <p className="truncate text-xs text-navy/50">{item.subLabel}</p>
                            </div>
                            <Button render={<Link href={item.ctaHref} />} nativeButton={false} variant="outline" size="sm" className="shrink-0">
                              {item.ctaLabel}
                              <ArrowRight className="size-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-navy/10 shadow-none ring-0">
                <CardContent className="px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Briefcase className="size-4 text-navy/40" aria-hidden="true" />
                      <h2 className="text-sm font-semibold text-navy">Internship activity</h2>
                    </div>
                    <Link href="/company/internships" className="text-sm font-medium text-teal-ink hover:underline">
                      View all internships
                    </Link>
                  </div>
                  <div className="mt-3 divide-y divide-navy/8">
                    {data.internshipActivity.slice(0, 5).map((row) => (
                      <div key={row.opportunityId} className="flex items-center justify-between gap-4 py-3.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-navy">{row.role}</p>
                            <InternshipStatusBadge status={row.status} />
                          </div>
                          <p className="mt-0.5 truncate text-xs text-navy/50">
                            {row.duration} · {row.location} · {row.applicantCount} applicant{row.applicantCount === 1 ? "" : "s"} ·{" "}
                            {row.candidatesToReview > 0
                              ? `${row.candidatesToReview} ready for review`
                              : `Challenge: ${CHALLENGE_LABEL[row.challengeStatus] ?? row.challengeStatus}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            render={<Link href={`/company/opportunities/${row.opportunityId}`} />}
                            nativeButton={false}
                            variant="ghost"
                            size="sm"
                            className="text-teal-ink hover:text-teal-ink"
                          >
                            {row.status === "draft" ? "Continue setup" : row.candidatesToReview > 0 ? "View candidates" : "Manage internship"}
                            <ArrowRight className="size-3.5" aria-hidden="true" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More actions for ${row.role}`} />}>
                              <MoreHorizontal className="size-4" aria-hidden="true" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem render={<Link href={`/company/opportunities/${row.opportunityId}`} />}>
                                Manage internship
                              </DropdownMenuItem>
                              {row.status === "published" && (
                                <DropdownMenuItem render={<Link href={`/opportunities/${row.opportunityId}`} />}>
                                  View public listing
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {data.activeInternRows.length > 0 && (
                <Card className="rounded-xl border border-navy/10 shadow-none ring-0">
                  <CardContent className="px-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="size-4 text-navy/40" aria-hidden="true" />
                        <h2 className="text-sm font-semibold text-navy">Active interns</h2>
                      </div>
                      <Link href="/company/interns" className="text-sm font-medium text-teal-ink hover:underline">
                        View all interns
                      </Link>
                    </div>
                    <div className="mt-3 divide-y divide-navy/8">
                      {data.activeInternRows.slice(0, 4).map((row) => (
                        <div key={row.offerId} className="flex items-center justify-between gap-4 py-3.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy/8 text-xs font-semibold text-navy/60">
                              {row.internName.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium text-navy">{row.internName}</p>
                                <InternStatusBadge severity={row.severity} />
                              </div>
                              <p className="mt-0.5 truncate text-xs text-navy/50">
                                {row.role} · Week {row.currentWeekNumber} of {row.durationWeeks}
                                {row.currentWeekTitle ? ` · ${row.currentWeekTitle}` : ""} · Tasks {row.tasksDone}/{row.tasksTotal}
                              </p>
                            </div>
                          </div>
                          <Button
                            render={<Link href={`/company/offers/${row.offerId}/program`} />}
                            nativeButton={false}
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-teal-ink hover:text-teal-ink"
                          >
                            View intern
                            <ArrowRight className="size-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <aside className="space-y-6">
              <Card className="rounded-xl border border-navy/10 shadow-none ring-0">
                <CardContent className="px-5">
                  <h2 className="text-sm font-semibold text-navy">Hiring funnel</h2>
                  <div className="mt-4 space-y-3">
                    <FunnelBar label="Applied" value={data.funnel.applied} max={data.funnel.applied} />
                    <FunnelBar label="Challenge submitted" value={data.funnel.submitted} max={data.funnel.applied} />
                    <FunnelBar label="Shortlisted" value={data.funnel.shortlisted} max={data.funnel.applied} />
                    <FunnelBar label="Invited" value={data.funnel.invited} max={data.funnel.applied} />
                    <FunnelBar label="Accepted" value={data.funnel.accepted} max={data.funnel.applied} />
                  </div>
                  <Link href="/company/analytics" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal-ink hover:underline">
                    View analytics <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-navy/10 shadow-none ring-0">
                <CardContent className="px-5">
                  <h2 className="text-sm font-semibold text-navy">Integrations preview</h2>
                  <ul className="mt-3 space-y-2.5">
                    {INTEGRATIONS.map((integration) => (
                      <li key={integration.name} className="flex items-center gap-2.5 text-sm text-navy/70">
                        <integration.icon />
                        <span className="min-w-0 flex-1 truncate">{integration.name}</span>
                        <span className="shrink-0 rounded-full bg-gray-light px-2 py-0.5 text-xs text-navy/50">Coming soon</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/company/integrations" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal-ink hover:underline">
                    Manage integrations <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </CardContent>
              </Card>
            </aside>
          </div>
        </>
      )}
    </CompanyPageContainer>
  );
}

function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-navy/65">{label}</span>
        <span className="font-semibold text-navy">{value}</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-navy/8">
        <div className="h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
