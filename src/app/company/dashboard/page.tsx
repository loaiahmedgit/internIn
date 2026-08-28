import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getCompanyHomeData } from "@/lib/company/home-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  CheckCircle2,
  Sparkles,
  MoreHorizontal,
  MessageSquare,
  Mail,
  Hash,
  FileStack,
  KanbanSquare,
} from "lucide-react";

const OPPORTUNITY_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  closed: "Closed",
};

const OPPORTUNITY_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  published: "default",
  closed: "outline",
};

const INTERN_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  "On track": "default",
  "Not started": "secondary",
  "Behind schedule": "destructive",
};

const INTEGRATIONS = [
  { name: "Microsoft Teams", icon: MessageSquare },
  { name: "Google Workspace", icon: Mail },
  { name: "Slack", icon: Hash },
  { name: "Notion", icon: FileStack },
  { name: "Jira", icon: KanbanSquare },
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
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-navy/60">
        This account isn&apos;t linked to a company yet.
      </div>
    );
  }

  const data = await getCompanyHomeData(membership.company.id);
  const hasAnyInternships = data.internshipActivity.length > 0;

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-teal-ink">Company workspace</p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">
            {membership.company.name}
          </h1>
        </div>
        <Button render={<Link href="/company/opportunities/new" />} nativeButton={false} className="bg-teal text-white hover:bg-teal/90">
          <Sparkles className="size-4" /> Create internship
        </Button>
      </div>

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
          {/* KPI strip */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard icon={Briefcase} label="Open internships" value={data.openInternships} />
            <KpiCard icon={Users} label="Candidates to review" value={data.candidatesToReview} />
            <KpiCard icon={GraduationCap} label="Active interns" value={data.activeInterns} />
            <KpiCard icon={TriangleAlert} label="Interns needing attention" value={data.internsNeedingAttention} />
          </div>

          {/* Needs your attention */}
          <Card className="mt-8 rounded-xl border border-navy/10 shadow-none ring-0">
            <CardContent className="px-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-navy/50">Needs your attention</h2>
              {data.attentionItems.length === 0 ? (
                <p className="mt-4 flex items-center gap-2 text-sm text-navy/60">
                  <CheckCircle2 className="size-4 text-teal-ink" aria-hidden="true" />
                  Nothing needs your attention right now.
                </p>
              ) : (
                <div className="mt-3 divide-y divide-navy/8">
                  {data.attentionItems.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy">{item.message}</p>
                        <p className="truncate text-xs text-navy/50">{item.subLabel}</p>
                      </div>
                      <Button
                        render={<Link href={item.ctaHref} />}
                        nativeButton={false}
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-teal-ink hover:text-teal-ink"
                      >
                        {item.ctaLabel}
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            {/* Main column */}
            <div className="min-w-0 space-y-8">
              <section>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-navy/50">Internship activity</h2>
                  <Link href="/company/internships" className="text-sm font-medium text-teal-ink hover:underline">
                    View all internships
                  </Link>
                </div>
                <Card className="mt-3 rounded-xl border border-navy/10 shadow-none ring-0">
                  <CardContent className="divide-y divide-navy/8 px-6">
                    {data.internshipActivity.slice(0, 5).map((row) => (
                      <div key={row.opportunityId} className="flex items-center justify-between gap-4 py-3.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-navy">{row.role}</p>
                            <Badge variant={OPPORTUNITY_STATUS_VARIANT[row.status]}>
                              {OPPORTUNITY_STATUS_LABEL[row.status]}
                            </Badge>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-navy/50">
                            {row.duration} · {row.location} · {row.applicantCount} applicant{row.applicantCount === 1 ? "" : "s"} ·{" "}
                            {row.candidatesToReview > 0
                              ? `${row.candidatesToReview} ready for review`
                              : `Challenge: ${row.challengeStatusLabel}`}
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
                            {row.status === "draft"
                              ? "Continue setup"
                              : row.candidatesToReview > 0
                                ? "View candidates"
                                : "Manage internship"}
                            <ArrowRight className="size-3.5" aria-hidden="true" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${row.role}`} />
                              }
                            >
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
                  </CardContent>
                </Card>
              </section>

              <section>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-navy/50">Active interns</h2>
                  {data.activeInternRows.length > 0 && (
                    <Link href="/company/interns" className="text-sm font-medium text-teal-ink hover:underline">
                      View all interns
                    </Link>
                  )}
                </div>
                {data.activeInternRows.length === 0 ? (
                  <p className="mt-3 text-sm text-navy/60">
                    No active interns yet — once you invite and onboard a candidate, they&apos;ll show up here.
                  </p>
                ) : (
                  <Card className="mt-3 rounded-xl border border-navy/10 shadow-none ring-0">
                    <CardContent className="divide-y divide-navy/8 px-6">
                      {data.activeInternRows.slice(0, 4).map((row) => (
                        <div key={row.offerId} className="flex items-center justify-between gap-4 py-3.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-navy">{row.internName}</p>
                              <Badge variant={INTERN_STATUS_VARIANT[row.statusLabel]}>{row.statusLabel}</Badge>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-navy/50">
                              {row.role} · Week {row.currentWeekNumber} of {row.durationWeeks}
                              {row.currentWeekTitle ? ` · ${row.currentWeekTitle}` : ""} · Tasks {row.tasksDone}/
                              {row.tasksTotal}
                            </p>
                          </div>
                          <Button
                            render={<Link href={`/company/offers/${row.offerId}/program`} />}
                            nativeButton={false}
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-teal-ink hover:text-teal-ink"
                          >
                            View internship
                            <ArrowRight className="size-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </section>
            </div>

            {/* Right rail */}
            <aside className="space-y-6">
              <Card className="rounded-xl border border-navy/10 shadow-none ring-0">
                <CardContent className="px-5">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-navy/50">Hiring funnel</h2>
                  <div className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm">
                    <FunnelStep label="Applied" value={data.funnel.applied} />
                    <ArrowRight className="size-3 shrink-0 text-navy/25" aria-hidden="true" />
                    <FunnelStep label="Submitted" value={data.funnel.submitted} />
                    <ArrowRight className="size-3 shrink-0 text-navy/25" aria-hidden="true" />
                    <FunnelStep label="Shortlisted" value={data.funnel.shortlisted} />
                    <ArrowRight className="size-3 shrink-0 text-navy/25" aria-hidden="true" />
                    <FunnelStep label="Invited" value={data.funnel.invited} />
                    <ArrowRight className="size-3 shrink-0 text-navy/25" aria-hidden="true" />
                    <FunnelStep label="Accepted" value={data.funnel.accepted} />
                  </div>
                  <Link
                    href="/company/analytics"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal-ink hover:underline"
                  >
                    View analytics <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-navy/10 shadow-none ring-0">
                <CardContent className="px-5">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-navy/50">
                    Connect the tools your team uses
                  </h2>
                  <Separator className="my-3" />
                  <ul className="space-y-2.5">
                    {INTEGRATIONS.map((integration) => (
                      <li key={integration.name} className="flex items-center gap-2.5 text-sm text-navy/70">
                        <integration.icon className="size-4 shrink-0 text-navy/40" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{integration.name}</span>
                        <Badge variant="secondary" className="shrink-0">
                          Coming soon
                        </Badge>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/company/integrations"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal-ink hover:underline"
                  >
                    Manage integrations <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </CardContent>
              </Card>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value }: { icon: typeof Briefcase; label: string; value: number }) {
  return (
    <Card size="sm" className="rounded-xl border border-navy/10 shadow-none ring-0">
      <CardContent className="px-4">
        <div className="flex items-start gap-1.5 text-xs font-medium text-navy/50">
          <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{label}</span>
        </div>
        <p className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] text-navy">{value}</p>
      </CardContent>
    </Card>
  );
}

function FunnelStep({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <span className="font-semibold text-navy">{value}</span>
      <span className="text-xs text-navy/50">{label}</span>
    </span>
  );
}
