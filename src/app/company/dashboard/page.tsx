import Link from "next/link";
import {
  Briefcase,
  Users,
  Clock3,
  Send,
  ChevronRight,
  CalendarDays,
  UserPlus,
} from "lucide-react";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { getHiringData } from "@/lib/company/hiring-data";
import {
  DAY_MS,
  hiringCohort,
  hiringMetrics,
} from "@/lib/company/hiring-metrics";
import { CompanyPageContainer } from "@/components/company/page-shell";
import {
  HiringHeader,
  HiringMetric,
  HiringPanel,
  HiringFunnel,
} from "@/components/company/hiring-panels";
import { QuerySelect } from "@/components/company/query-select";
import { formatDeadline } from "@/lib/format-date";

/** Furthest real stage any candidate on this posting has reached — a single qualitative read of "how far along is this internship," not a fabricated health score. */
const PIPELINE_STAGES = ["Applicants", "Screening", "Interviews", "Offers", "Hired"] as const;
function furthestStage(m: ReturnType<typeof hiringMetrics>): { label: (typeof PIPELINE_STAGES)[number]; index: number } {
  if (m.accepted > 0) return { label: "Hired", index: 4 };
  if (m.offerSent > 0) return { label: "Offers", index: 3 };
  if (m.shortlisted > 0) return { label: "Interviews", index: 2 };
  if (m.toReview > 0) return { label: "Screening", index: 1 };
  return { label: "Applicants", index: 0 };
}

const linkStyle =
  "text-xs font-medium text-teal-ink hover:underline focus-visible:outline-2 focus-visible:outline-teal";
export default async function CompanyHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { membership } = await requireCurrentCompanyMember();
  const [data, params] = await Promise.all([
    getHiringData(membership.companyId),
    searchParams,
  ]);
  const now = new Date();
  const metrics = hiringMetrics(data.applications);
  const published = data.postings.filter((p) => p.status === "published");

  // Real period-over-period deltas — omitted (not "0%") when the prior
  // period has nothing to compare against, per the no-fabrication rule.
  const newThisMonth = data.postings.filter((p) => now.getTime() - p.createdAt.getTime() <= 30 * DAY_MS).length;
  const applicantsThisWeek = hiringCohort(data.applications, 7, now).length;
  const applicantsPriorWeek = hiringCohort(data.applications, 14, now).length - applicantsThisWeek;
  const applicantsDelta =
    applicantsPriorWeek > 0
      ? `${Math.round(((applicantsThisWeek - applicantsPriorWeek) / applicantsPriorWeek) * 100) >= 0 ? "+" : ""}${Math.round(((applicantsThisWeek - applicantsPriorWeek) / applicantsPriorWeek) * 100)}% vs previous 7 days`
      : null;
  const selected =
    typeof params.opportunity === "string" &&
    data.postings.some((p) => p.id === params.opportunity)
      ? params.opportunity
      : "all";
  const pipeline = hiringMetrics(
    data.applications.filter(
      (a) => selected === "all" || a.opportunityId === selected,
    ),
  );
  const upcoming = published
    .filter(
      (p) =>
        p.applicationDeadline &&
        p.applicationDeadline >= now &&
        p.applicationDeadline.getTime() <= now.getTime() + 7 * DAY_MS,
    )
    .sort(
      (a, b) =>
        a.applicationDeadline!.getTime() - b.applicationDeadline!.getTime(),
    );
  const pastDeadline = published.filter(
    (p) => p.applicationDeadline && p.applicationDeadline < now,
  );
  const date = (d: Date) =>
    new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      timeZone: "Asia/Qatar",
    }).format(d);
  const roleById = new Map(data.postings.map((p) => [p.id, p.role]));
  const activity = data.applications
    .flatMap((a) => [
      {
        id: `${a.id}-applied`,
        at: a.appliedAt,
        title: "New application received",
        detail: `${a.name} applied for ${roleById.get(a.opportunityId)}`,
        href: `/company/candidates?opportunity=${a.opportunityId}`,
      },
      ...(a.submittedAt
        ? [
            {
              id: `${a.id}-submitted`,
              at: a.submittedAt,
              title: "Challenge submitted",
              detail: `${a.name} · ${roleById.get(a.opportunityId)}`,
              href: `/company/candidates/${a.id}`,
            },
          ]
        : []),
      ...(a.offer
        ? [
            {
              id: `${a.id}-offer`,
              at: a.offer.sentAt,
              title: "Offer sent",
              detail: `${a.name} · ${roleById.get(a.opportunityId)}`,
              href: `/company/candidates/${a.id}`,
            },
          ]
        : []),
    ])
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 4);
  return (
    <CompanyPageContainer>
      <HiringHeader
        title="Home"
        description="Track hiring progress and see what needs your attention."
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HiringMetric
          icon={Briefcase}
          color="text-teal-ink"
          label="Active internships"
          value={published.length}
          detail="Published postings"
          delta={newThisMonth > 0 ? `${newThisMonth} new this month` : undefined}
          deltaTone="positive"
        />
        <HiringMetric
          icon={Users}
          color="text-blue-600"
          label="New applicants"
          value={applicantsThisWeek}
          detail="Received in the last 7 days"
          delta={applicantsDelta ?? undefined}
          deltaTone={applicantsDelta?.startsWith("-") ? "negative" : "positive"}
        />
        <HiringMetric
          icon={Clock3}
          color="text-amber-600"
          label="Needs review"
          value={metrics.toReview}
          detail="Across all internships"
        />
        <HiringMetric
          icon={Send}
          color="text-emerald-600"
          label="Offers pending"
          value={metrics.pending}
          detail="Awaiting candidate response"
        />
      </div>
      <div className="mt-6 grid items-stretch gap-5 xl:grid-cols-2">
        <HiringPanel
          title="Hiring pipeline overview"
          subtitle="All-time applicant-to-offer progress"
          action={
            <QuerySelect
              param="opportunity"
              value={selected}
              ariaLabel="Pipeline internship"
              className="h-8 max-w-52 text-xs"
              options={[
                { value: "all", label: "All internships" },
                ...data.postings.map((p) => ({ value: p.id, label: p.role })),
              ]}
            />
          }
        >
          <HiringFunnel metrics={pipeline} />
        </HiringPanel>
        <HiringPanel
          title="Internship health"
          subtitle="A separate hiring view for every active posting"
          action={
            <Link className={linkStyle} href="/company/internships">
              View all internships
            </Link>
          }
        >
          <div className="space-y-3">
            {published.map((p) => {
              const m = hiringMetrics(
                data.applications.filter((a) => a.opportunityId === p.id),
              );
              const stage = furthestStage(m);
              const workMode = p.workMode ? p.workMode[0].toUpperCase() + p.workMode.slice(1) : null;
              return (
                <Link
                  key={p.id}
                  href={`/company/candidates?opportunity=${p.id}`}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-navy/10 p-3 hover:bg-gray-light/60 focus-visible:outline-2 focus-visible:outline-teal"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal/8 text-xs font-semibold text-teal-ink">
                    {p.role
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")}
                  </span>
                  <div className="min-w-0 flex-1 basis-32">
                    <p className="text-xs font-medium text-navy">{p.role}</p>
                    <p className="mt-1 text-xs text-navy/60">
                      {p.location}
                      {workMode ? ` · ${workMode}` : ""}
                    </p>
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold tabular-nums text-navy">
                      {m.applicants}
                    </p>
                    <p className="mt-1 text-navy/60">Applicants</p>
                  </div>
                  <div className="w-24 text-xs">
                    <p className="font-medium text-navy">{stage.label}</p>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-navy/8">
                      <div
                        className="h-full rounded-full bg-teal-ink"
                        style={{ width: `${(stage.index / (PIPELINE_STAGES.length - 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <p className="w-16 shrink-0 text-right text-xs text-navy/60">
                    {p.applicationDeadline ? formatDeadline(p.applicationDeadline) : "No deadline"}
                  </p>
                  <ChevronRight
                    className="size-4 shrink-0 text-navy/40"
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
            {!published.length && (
              <p className="text-sm text-navy/60">
                No published internships yet. Publish a posting to begin hiring.
              </p>
            )}
          </div>
        </HiringPanel>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <HiringPanel title="Needs attention">
          <div className="divide-y divide-navy/8">
            {[
              {
                label: "Applications awaiting review",
                detail: "Submitted challenges ready to evaluate",
                count: metrics.toReview,
                href: "/company/candidates?tab=to_review",
                icon: Users,
              },
              {
                label: "Expiring deadlines",
                detail: "Internships closing in the next 7 days",
                count: upcoming.length,
                href: "/company/internships",
                icon: CalendarDays,
              },
              {
                label: "Offers awaiting response",
                detail: "Pending candidate decisions",
                count: metrics.pending,
                href: "/company/candidates?tab=invited",
                icon: Send,
              },
              ...(pastDeadline.length
                ? [
                    {
                      label: "Past application deadline",
                      detail: "Review postings that are still published",
                      count: pastDeadline.length,
                      href: "/company/internships",
                      icon: Clock3,
                    },
                  ]
                : []),
            ].map((item) => (
              <Link
                href={item.href}
                key={item.label}
                className="flex items-center gap-3 py-4 first:pt-0 last:pb-0 hover:text-teal-ink focus-visible:outline-2 focus-visible:outline-teal"
              >
                <item.icon
                  className="size-4 shrink-0 text-teal-ink"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-navy">{item.label}</p>
                  <p className="mt-1 text-xs text-navy/60">{item.detail}</p>
                </div>
                <span className="text-sm text-navy tabular-nums">
                  {item.count}
                </span>
                <ChevronRight
                  className="size-3 text-navy/50"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </HiringPanel>
        <HiringPanel title="Recent activity">
          <ul className="space-y-4">
            {activity.map((a) => (
              <li key={a.id}>
                <Link
                  href={a.href}
                  className="block rounded hover:bg-gray-light/50 focus-visible:outline-2 focus-visible:outline-teal"
                >
                  <div className="flex justify-between gap-2">
                    <p className="text-xs font-medium text-navy">{a.title}</p>
                    <time
                      className="shrink-0 text-[11px] text-navy/60"
                      dateTime={a.at.toISOString()}
                    >
                      {date(a.at)}
                    </time>
                  </div>
                  <p className="mt-1 text-xs text-navy/60">{a.detail}</p>
                </Link>
              </li>
            ))}
            {!activity.length && (
              <li className="text-sm text-navy/60">
                Hiring activity will appear when applications arrive.
              </li>
            )}
          </ul>
        </HiringPanel>
        <HiringPanel
          title="This week"
          subtitle="Live review queue and upcoming deadlines"
        >
          <div className="space-y-4">
            <Link
              href="/company/candidates?tab=to_review"
              className="flex gap-3 rounded focus-visible:outline-2 focus-visible:outline-teal"
            >
              <Users
                className="size-4 shrink-0 text-teal-ink"
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-medium text-navy">
                  Review applications
                </p>
                <p className="mt-1 text-xs text-navy/60">
                  {metrics.toReview} submitted applications waiting
                </p>
              </div>
            </Link>
            {upcoming.map((p) => (
              <Link
                href={`/company/candidates?opportunity=${p.id}`}
                key={p.id}
                className="flex gap-3 rounded focus-visible:outline-2 focus-visible:outline-teal"
              >
                <CalendarDays
                  className="size-4 shrink-0 text-amber-600"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs font-medium text-navy">{p.role}</p>
                  <p className="mt-1 text-xs text-navy/60">
                    Applications close {date(p.applicationDeadline!)}
                  </p>
                </div>
              </Link>
            ))}
            {!upcoming.length && (
              <p className="text-xs leading-relaxed text-navy/60">
                No application deadlines in the next 7 days.
              </p>
            )}
          </div>
        </HiringPanel>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-navy/10 px-4 py-3 text-xs">
        <p className="text-navy/65">
          Manage who can access your hiring workspace.
        </p>
        <Link
          href="/company/settings?tab=team"
          className={`flex items-center gap-2 ${linkStyle}`}
        >
          Team &amp; roles
          <UserPlus className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </CompanyPageContainer>
  );
}
