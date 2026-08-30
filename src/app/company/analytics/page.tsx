import Link from "next/link";
import { Briefcase, Users, Clock3, Star, Download } from "lucide-react";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { getHiringData } from "@/lib/company/hiring-data";
import {
  hiringCohort,
  hiringMetrics,
  hiringActivity,
  percent,
} from "@/lib/company/hiring-metrics";
import { CompanyPageContainer } from "@/components/company/page-shell";
import {
  HiringHeader,
  HiringMetric,
  HiringPanel,
  HiringFunnel,
  ApplicantBars,
  StageDistribution,
  HiringTrend,
} from "@/components/company/hiring-panels";
import { QuerySelect } from "@/components/company/query-select";

export default async function CompanyAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { membership } = await requireCurrentCompanyMember();
  const [data, params] = await Promise.all([
    getHiringData(membership.companyId),
    searchParams,
  ]);
  const days = [7, 30, 90].includes(Number(params.window))
    ? Number(params.window)
    : 30;
  const now = new Date();
  const cohort = hiringCohort(data.applications, days, now);
  const m = hiringMetrics(cohort);
  const roles = data.postings
    .map((p) => ({
      ...p,
      metrics: hiringMetrics(cohort.filter((a) => a.opportunityId === p.id)),
    }))
    .filter((p) => p.metrics.applicants || p.status === "published")
    .sort(
      (a, b) =>
        b.metrics.applicants - a.metrics.applicants ||
        a.role.localeCompare(b.role),
    );
  const sources = [...new Set(cohort.map((a) => a.source ?? "unknown"))]
    .map((source) => ({
      source,
      metrics: hiringMetrics(
        cohort.filter((a) => (a.source ?? "unknown") === source),
      ),
    }))
    .sort((a, b) => b.metrics.applicants - a.metrics.applicants);
  const sourceLabels: Record<string, string> = {
    direct: "Direct",
    referral: "Referral",
    company_website: "Company website",
    unknown: "Not recorded",
  };
  return (
    <CompanyPageContainer>
      <HiringHeader
        title="Analytics"
        description="Understand hiring performance across your internships."
        actions={
          <QuerySelect
            ariaLabel="Analytics date range"
            param="window"
            value={String(days)}
            options={[7, 30, 90].map((d) => ({
              value: String(d),
              label: `Last ${d} days`,
            }))}
          />
        }
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HiringMetric
          icon={Users}
          color="text-teal-ink"
          label="Applicants"
          value={m.applicants}
          detail={`Applications received in the last ${days} days`}
        />
        <HiringMetric
          icon={Clock3}
          color="text-blue-600"
          label="Time to hire"
          value={
            m.timeToHire === null
              ? "Not available"
              : `${m.timeToHire.toFixed(1)} days`
          }
          detail={
            m.timedHires
              ? `Application to acceptance · ${m.timedHires} recorded hires`
              : "No recorded acceptance timestamps"
          }
        />
        <HiringMetric
          icon={Star}
          color="text-amber-600"
          label="Offer acceptance"
          value={
            m.acceptance === null
              ? "Not available"
              : `${(m.acceptance * 100).toFixed(1)}%`
          }
          detail="Accepted / responded offers in this cohort"
        />
        <HiringMetric
          icon={Briefcase}
          color="text-teal-ink"
          label="Active internships"
          value={data.postings.filter((p) => p.status === "published").length}
          detail="Currently published · all dates"
        />
      </div>
      <p className="mt-3 text-xs text-navy/60">
        Charts follow applications received in the selected period, including
        archived records. Outcomes reflect their current status.
      </p>
      <div className="mt-5 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        <HiringPanel
          title="Hiring funnel conversion"
          subtitle="Offers may be sent without shortlisting"
        >
          <HiringFunnel metrics={m} />
        </HiringPanel>
        <HiringPanel title="Applicants by internship">
          <ApplicantBars
            rows={roles.map((p) => ({
              id: p.id,
              role: p.role,
              count: p.metrics.applicants,
            }))}
          />
        </HiringPanel>
        <HiringPanel
          title="Stage distribution"
          subtitle="Current stages, including historical applications"
        >
          <StageDistribution
            rows={[
              {
                label: "Awaiting submission",
                value: m.awaitingSubmission,
                color: "#94A3B8",
              },
              { label: "To review", value: m.toReview, color: "#2563EB" },
              { label: "Shortlisted", value: m.shortlisted, color: "#D97706" },
              { label: "Offer sent", value: m.offerSent, color: "#059669" },
              { label: "Rejected", value: m.archived, color: "#DC2626" },
            ]}
          />
        </HiringPanel>
        <HiringPanel
          title="Hiring activity over time"
          subtitle={
            days === 7
              ? "Applications per day"
              : "Applications per 7-day interval"
          }
        >
          <HiringTrend points={hiringActivity(cohort, days, now)} />
        </HiringPanel>
        <HiringPanel
          title="Source performance"
          subtitle="Only recorded sources; conversion to accepted offer"
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-navy/10 text-navy/65">
                <th className="pb-3 text-left font-medium">Source</th>
                <th className="pb-3 text-right font-medium">Applicants</th>
                <th className="pb-3 text-right font-medium">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(({ source, metrics }) => (
                <tr
                  key={source}
                  className="border-b border-navy/8 last:border-0"
                >
                  <td className="py-3 text-navy">
                    {sourceLabels[source] ?? source}
                  </td>
                  <td className="text-right text-navy tabular-nums">
                    {metrics.applicants}
                  </td>
                  <td className="text-right text-teal-ink tabular-nums">
                    {percent(metrics.accepted, metrics.applicants)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sources.length && (
            <p className="mt-4 text-sm text-navy/60">
              No applications in this period.
            </p>
          )}
        </HiringPanel>
        <HiringPanel
          title="Top performing internships"
          subtitle="By accepted offers, then applicant volume"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-navy/10 text-navy/65">
                  <th className="pb-3 text-left font-medium">Internship</th>
                  <th className="pb-3 pl-3 text-right font-medium">
                    Time to hire
                  </th>
                  <th className="pb-3 pl-3 text-right font-medium">
                    Acceptance
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...roles]
                  .sort(
                    (a, b) =>
                      b.metrics.accepted - a.metrics.accepted ||
                      b.metrics.applicants - a.metrics.applicants,
                  )
                  .map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-navy/8 last:border-0"
                    >
                      <td className="py-3 text-navy">
                        <Link
                          href={`/company/candidates?opportunity=${p.id}`}
                          className="hover:text-teal-ink focus-visible:outline-2 focus-visible:outline-teal"
                        >
                          {p.role}
                        </Link>
                      </td>
                      <td className="pl-3 text-right text-navy/70 tabular-nums">
                        {p.metrics.timeToHire === null
                          ? "Not available"
                          : `${p.metrics.timeToHire.toFixed(1)}d`}
                      </td>
                      <td className="pl-3 text-right text-teal-ink tabular-nums">
                        {p.metrics.acceptance === null
                          ? "Not available"
                          : `${Math.round(p.metrics.acceptance * 100)}%`}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!roles.length && (
            <p className="text-sm text-navy/60">No internship results yet.</p>
          )}
        </HiringPanel>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-navy/10 px-5 py-4">
        <div>
          <p className="text-sm font-medium text-navy">
            Keep improving your hiring process
          </p>
          <p className="mt-1 text-xs text-navy/60">
            Export the current reporting period to review with your team.
          </p>
        </div>
        <a
          href={`/company/analytics/export?window=${days}`}
          className="inline-flex items-center gap-2 rounded-md border border-navy/20 px-4 py-2 text-sm font-medium text-navy hover:bg-gray-light focus-visible:outline-2 focus-visible:outline-teal"
        >
          <Download className="size-4" aria-hidden="true" />
          Export report
        </a>
      </div>
    </CompanyPageContainer>
  );
}
