import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { getCompanyAnalytics } from "@/lib/company/analytics-data";
import { CompanyPageContainer, CompanyPageHeader } from "@/components/company/page-shell";
import { MetricCard } from "@/components/company/metric-card";
import { QuerySelect } from "@/components/company/query-select";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, Users, GraduationCap, PieChart, Globe } from "lucide-react";

const WINDOW_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  return `${(minutes / 60).toFixed(1)} hr`;
}

export default async function CompanyAnalyticsPage({
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

  const windowDays = [7, 30, 90].includes(Number(params.window)) ? Number(params.window) : 30;
  const data = await getCompanyAnalytics(membership.company.id, windowDays);

  const funnelSteps: { label: string; value: number }[] = [
    { label: "Applied", value: data.funnel.applied },
    { label: "Challenge submitted", value: data.funnel.submitted },
    { label: "Shortlisted", value: data.funnel.shortlisted },
    { label: "Invited", value: data.funnel.invited },
    { label: "Accepted", value: data.funnel.accepted },
  ];
  const conversionRate = data.funnel.applied > 0 ? Math.round((data.funnel.accepted / data.funnel.applied) * 100) : null;

  return (
    <CompanyPageContainer>
      <CompanyPageHeader
        eyebrow="Analytics"
        title="Analytics"
        description="A first look at how candidates move through your internships."
        actions={<QuerySelect param="window" value={String(windowDays)} options={WINDOW_OPTIONS} className="h-9" />}
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard icon={Briefcase} label="Open internships" value={data.openInternships} />
        <MetricCard icon={Users} label="Applicants" value={data.applicants} />
        <MetricCard
          icon={PieChart}
          label="Challenge completion rate"
          value={data.challengeCompletionRate === null ? 0 : Math.round(data.challengeCompletionRate * 100)}
        />
        <MetricCard icon={GraduationCap} label="Active interns" value={data.activeInterns} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="rounded-xl border border-navy/10 shadow-none ring-0">
          <CardContent className="px-5">
            <h2 className="text-sm font-semibold text-navy">Hiring funnel</h2>
            <div className="mt-4 space-y-3">
              {funnelSteps.map((step) => {
                const pct = data.funnel.applied > 0 ? Math.round((step.value / data.funnel.applied) * 100) : 0;
                return (
                  <div key={step.label} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-sm text-navy/65">{step.label}</span>
                    <div className="h-2 min-w-0 flex-1 rounded-full bg-navy/8">
                      <div className="h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 shrink-0 text-right text-sm font-semibold text-navy">{step.value}</span>
                    <span className="w-10 shrink-0 text-right text-xs text-navy/45">{pct}%</span>
                  </div>
                );
              })}
            </div>
            {conversionRate !== null && (
              <div className="mt-4 flex items-center justify-between rounded-lg bg-teal/5 px-3 py-2 text-sm">
                <span className="text-navy/70">Conversion from applied to accepted</span>
                <span className="font-semibold text-teal-ink">{conversionRate}%</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-navy/10 shadow-none ring-0">
          <CardContent className="px-5">
            <h2 className="text-sm font-semibold text-navy">Program health</h2>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xl font-semibold text-navy">{data.activeInterns}</p>
                <p className="text-xs text-navy/50">Active interns</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-navy">{data.needsAttentionCount}</p>
                <p className="text-xs text-navy/50">Needing attention</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-navy">{data.openInternships}</p>
                <p className="text-xs text-navy/50">Open internships</p>
              </div>
            </div>

            <div className="mt-6 border-t border-navy/8 pt-4">
              <h3 className="text-sm font-semibold text-navy">Review turnaround</h3>
              {data.reviewTurnaround.avgDaysToReview === null ? (
                <p className="mt-2 text-sm text-navy/50">Not enough reviewed submissions yet to compute this.</p>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-semibold text-navy">{data.reviewTurnaround.avgDaysToReview.toFixed(1)}</p>
                    <p className="text-xs text-navy/50">Avg. days to review</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-navy">{data.reviewTurnaround.awaitingReviewCount}</p>
                    <p className="text-xs text-navy/50">Awaiting review</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 rounded-xl border border-navy/10 shadow-none ring-0">
        <CardContent className="px-5">
          <h2 className="text-sm font-semibold text-navy">Challenge analytics</h2>
          {data.challengeTiming.startedCount === 0 ? (
            <p className="mt-2 text-sm text-navy/50">No challenges have been started yet in this window.</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-2xl font-semibold text-navy">{data.challengeTiming.startedCount}</p>
                <p className="text-xs text-navy/50">Challenges started</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-navy">
                  {data.challengeCompletionRate === null ? "—" : `${Math.round(data.challengeCompletionRate * 100)}%`}
                </p>
                <p className="text-xs text-navy/50">Completion rate</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-navy">{formatMinutes(data.challengeTiming.medianCompletionMinutes)}</p>
                <p className="text-xs text-navy/50">Median completion time</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Applicant source: no referrer/source tracking exists in the schema — an honest
          insufficient-data state instead of the mockup's fabricated Direct/Organic/Referral split. */}
      <Card className="mt-6 rounded-xl border border-navy/10 shadow-none ring-0">
        <CardContent className="px-5">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-navy/40" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-navy">Applicant source</h2>
          </div>
          <p className="mt-2 text-sm text-navy/50">
            internIn doesn&apos;t track where applicants come from yet, so there&apos;s nothing real to show here.
          </p>
        </CardContent>
      </Card>
    </CompanyPageContainer>
  );
}
