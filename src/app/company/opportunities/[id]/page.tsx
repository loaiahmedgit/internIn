import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq, and, inArray, or, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { hiringMetrics, type HiringApplication } from "@/lib/company/hiring-metrics";
import { getCompanyCandidates } from "@/lib/company/candidates-data";
import { EVENT_LABEL } from "@/lib/company/internship-facts";
import { CompanyPageContainer } from "@/components/company/page-shell";
import { InternshipStatusBadge, ChallengeStatusBadge } from "@/components/company/status-badges";
import { CandidateTableRow } from "@/components/company/candidate-table-row";
import { AskInternshipPanel } from "@/components/opportunities/ask-internship-panel";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatDeadline } from "@/lib/format-date";
import { ChevronRight, ExternalLink, PenSquare, FileText, Plus } from "lucide-react";

type TabKey = "overview" | "candidates" | "listing" | "challenge" | "activity";
const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "candidates", label: "Candidates" },
  { key: "listing", label: "Listing" },
  { key: "challenge", label: "Challenge" },
  { key: "activity", label: "Activity" },
];

const WORK_MODE_LABEL: Record<string, string> = { onsite: "On-site", hybrid: "Hybrid", remote: "Remote" };
const AI_USAGE_POLICY_LABEL: Record<string, string> = { open: "Open", ai_allowed: "AI allowed", restricted_ai: "Restricted AI", controlled: "Controlled" };
const TABLE_HEAD_CLASS = "text-xs uppercase tracking-wide text-navy/65";

export default async function OpportunityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === query.tab) ? (query.tab as TabKey) : "overview";
  const { membership } = await requireCurrentCompanyMember();
  const db = getDb();

  const [opportunity] = await db
    .select()
    .from(schema.opportunities)
    .where(and(eq(schema.opportunities.id, id), eq(schema.opportunities.companyId, membership.companyId)))
    .limit(1);
  if (!opportunity) notFound();
  if (opportunity.status === "draft") redirect(`/company/opportunities/${id}/setup`);

  const [company] = await db.select({ name: schema.companies.name }).from(schema.companies).where(eq(schema.companies.id, membership.companyId)).limit(1);

  const [creator] = opportunity.createdByUserId
    ? await db.select({ fullName: schema.users.fullName }).from(schema.users).where(eq(schema.users.id, opportunity.createdByUserId)).limit(1)
    : [];

  const [challenge] = await db.select().from(schema.challenges).where(eq(schema.challenges.opportunityId, id)).limit(1);
  const [challengeVersion] = challenge?.currentVersionId
    ? await db.select().from(schema.challengeVersions).where(eq(schema.challengeVersions.id, challenge.currentVersionId)).limit(1)
    : [];

  const apps = await db
    .select({
      id: schema.applications.id,
      status: schema.applications.status,
      appliedAt: schema.applications.createdAt,
      source: schema.applications.source,
      name: schema.users.fullName,
    })
    .from(schema.applications)
    .innerJoin(schema.users, eq(schema.users.id, schema.applications.studentId))
    .where(eq(schema.applications.opportunityId, id));
  const appIds = apps.map((a) => a.id);

  const submissions = appIds.length
    ? await db.select({ applicationId: schema.submissions.applicationId, submittedAt: schema.submissions.submittedAt }).from(schema.submissions).where(inArray(schema.submissions.applicationId, appIds))
    : [];
  const submittedAtByApp = new Map(submissions.map((s) => [s.applicationId, s.submittedAt]));

  const offers = appIds.length ? await db.select().from(schema.internshipOffers).where(inArray(schema.internshipOffers.applicationId, appIds)) : [];
  const offerByApp = new Map(offers.map((o) => [o.applicationId, o]));

  const hiringApps: HiringApplication[] = apps.map((a) => ({
    id: a.id,
    opportunityId: id,
    name: a.name,
    status: a.status,
    appliedAt: a.appliedAt,
    submittedAt: submittedAtByApp.get(a.id) ?? null,
    source: a.source,
    offer: offerByApp.get(a.id) ? { status: offerByApp.get(a.id)!.status, sentAt: offerByApp.get(a.id)!.createdAt, acceptedAt: null } : null,
  }));
  const metrics = hiringMetrics(hiringApps);

  const { rows: allCandidates } = await getCompanyCandidates(membership.companyId);
  const scopedCandidates = allCandidates.filter((r) => r.opportunityId === id).sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime());
  const previewCandidates = scopedCandidates.slice(0, 10);

  const offerIds = offers.map((o) => o.id);
  const activityEntityIds = [id, ...appIds, ...offerIds];
  const activity = activityEntityIds.length
    ? await db
        .select({ id: schema.eventLog.id, eventType: schema.eventLog.eventType, createdAt: schema.eventLog.createdAt })
        .from(schema.eventLog)
        .where(or(and(eq(schema.eventLog.entityType, "opportunity"), eq(schema.eventLog.entityId, id)), inArray(schema.eventLog.entityId, activityEntityIds)))
        .orderBy(desc(schema.eventLog.createdAt))
        .limit(30)
    : [];

  const hasChallenge = !!challengeVersion;

  return (
    <CompanyPageContainer>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-navy/45">
        <Link href="/company/dashboard" className="hover:text-navy">
          Home
        </Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <Link href="/company/internships" className="hover:text-navy">
          Internships
        </Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span className="text-navy/70">{opportunity.role}</span>
      </nav>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-navy">{opportunity.role}</h1>
            <InternshipStatusBadge status={opportunity.status} />
          </div>
          <p className="mt-1 text-sm text-navy/55">Created {formatDeadline(opportunity.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AskInternshipPanel opportunityId={id} role={opportunity.role} />
          {opportunity.status === "published" && (
            <Button variant="outline" size="sm" render={<a href={`/opportunities/${id}`} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
              <ExternalLink className="size-3.5" />
              View public listing
            </Button>
          )}
          <Button variant="outline" size="sm" render={<Link href={`/company/opportunities/${id}/edit`} />} nativeButton={false}>
            <PenSquare className="size-3.5" />
            Edit
          </Button>
        </div>
      </div>

      <div className="mt-5 flex gap-1 border-b border-navy/10">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "overview" ? `/company/opportunities/${id}` : `/company/opportunities/${id}?tab=${t.key}`}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key ? "border-teal text-teal-ink" : "border-transparent text-navy/50 hover:text-navy"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <section className="rounded-xl border border-navy/10 bg-white p-5">
              <h2 className="text-sm font-semibold text-navy">Hiring summary</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  { label: "Applicants", value: metrics.applicants },
                  { label: "To review", value: metrics.toReview },
                  { label: "Shortlisted", value: metrics.shortlisted },
                  { label: "Offer sent", value: metrics.offerSent },
                  { label: "Hired", value: metrics.accepted },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-navy/8 px-3 py-2.5">
                    <p className="text-lg leading-none font-semibold tabular-nums text-navy">{s.value}</p>
                    <p className="mt-1 text-xs text-navy/55">{s.label}</p>
                  </div>
                ))}
              </div>
            </section>

            {opportunity.shortDescription && (
              <section className="rounded-xl border border-navy/10 bg-white p-5">
                <h2 className="text-sm font-semibold text-navy">Role description</h2>
                <p className="mt-2 text-sm whitespace-pre-wrap text-navy/75">{opportunity.shortDescription}</p>
              </section>
            )}

            <section className="rounded-xl border border-navy/10 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-navy">Recent activity</h2>
                <Link href={`/company/opportunities/${id}?tab=activity`} className="text-xs font-medium text-teal-ink hover:underline">
                  View all
                </Link>
              </div>
              {activity.length === 0 ? (
                <p className="mt-2 text-sm text-navy/50">Nothing logged yet.</p>
              ) : (
                <ul className="mt-3 space-y-3 border-l border-navy/10 pl-4">
                  {activity.slice(0, 5).map((e) => (
                    <li key={e.id} className="relative text-sm">
                      <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-teal/50" aria-hidden="true" />
                      <p className="text-navy">{EVENT_LABEL[e.eventType] ?? e.eventType}</p>
                      <p className="text-xs text-navy/45">{formatDeadline(e.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-xl border border-navy/10 bg-white p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-navy/45">Internship information</h2>
              <dl className="mt-3 space-y-2.5 text-sm">
                {[
                  ["Department", opportunity.department || "—"],
                  ["Duration", opportunity.duration],
                  ["Location", opportunity.location],
                  ["Mode", opportunity.workMode ? WORK_MODE_LABEL[opportunity.workMode] : "—"],
                  ["Openings", String(opportunity.slots)],
                  ["Created by", creator?.fullName ?? "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <dt className="text-navy/50">{label}</dt>
                    <dd className="truncate text-right text-navy">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="rounded-xl border border-navy/10 bg-white p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-navy/45">Timeline</h2>
              <dl className="mt-3 space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-navy/50">Created</dt>
                  <dd className="text-navy">{formatDeadline(opportunity.createdAt)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-navy/50">Deadline</dt>
                  <dd className="text-navy">{opportunity.applicationDeadline ? formatDeadline(opportunity.applicationDeadline) : "No deadline set"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-navy/50">Start date</dt>
                  <dd className="text-navy">{opportunity.startDate ? formatDeadline(opportunity.startDate) : "Not set"}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-navy/10 bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-navy/45">Challenge</h2>
                <ChallengeStatusBadge status={hasChallenge ? challenge!.status : "none"} />
              </div>
              <p className="mt-2 text-sm text-navy">{hasChallenge ? challengeVersion!.title : "No challenge included"}</p>
              <Link href={`/company/opportunities/${id}?tab=challenge`} className="mt-2 inline-block text-xs font-medium text-teal-ink hover:underline">
                {hasChallenge ? "View challenge" : "Add a challenge"}
              </Link>
            </section>
          </div>
        </div>
      )}

      {tab === "candidates" && (
        <div className="mt-5">
          <div className="rounded-xl border border-navy/10 bg-white">
            <div className="flex items-center justify-between border-b border-navy/8 px-4 py-3">
              <p className="text-sm font-medium text-navy">{scopedCandidates.length} candidate{scopedCandidates.length === 1 ? "" : "s"}</p>
              <Link href={`/company/candidates?opportunity=${id}`} className="text-xs font-medium text-teal-ink hover:underline">
                Open in Candidates
              </Link>
            </div>
            {previewCandidates.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-navy/50">No applicants yet.</p>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow className="border-navy/10 hover:bg-transparent">
                    <TableHead className={`pl-4 ${TABLE_HEAD_CLASS}`}>Candidate</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Contact</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Internship</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Applied</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Stage</TableHead>
                    <TableHead className={`pr-4 text-right ${TABLE_HEAD_CLASS}`}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewCandidates.map((row) => (
                    <CandidateTableRow key={row.applicationId} row={row} />
                  ))}
                </TableBody>
              </Table>
            )}
            {scopedCandidates.length > previewCandidates.length && (
              <div className="border-t border-navy/8 px-4 py-3 text-center">
                <Link href={`/company/candidates?opportunity=${id}`} className="text-xs font-medium text-teal-ink hover:underline">
                  View all {scopedCandidates.length} candidates
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "listing" && (
        <div className="mt-5 max-w-2xl space-y-5">
          <section className="rounded-xl border border-navy/10 bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-navy">{opportunity.role}</h2>
                <p className="text-sm text-navy/55">{company?.name ?? "Your company"} · {opportunity.location}{opportunity.workMode ? ` · ${WORK_MODE_LABEL[opportunity.workMode]}` : ""}</p>
              </div>
              <Button variant="outline" size="sm" render={<Link href={`/company/opportunities/${id}/edit`} />} nativeButton={false}>
                <PenSquare className="size-3.5" />
                Edit listing
              </Button>
            </div>

            <div className="mt-5 space-y-5 text-sm">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-navy/45">Description</h3>
                <p className="mt-1.5 whitespace-pre-wrap text-navy/80">{opportunity.description}</p>
              </div>
              {opportunity.whatYouWillLearn && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-navy/45">What you&apos;ll learn</h3>
                  <p className="mt-1.5 whitespace-pre-wrap text-navy/80">{opportunity.whatYouWillLearn}</p>
                </div>
              )}
              {opportunity.requirements.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-navy/45">Requirements</h3>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-navy/80">
                    {opportunity.requirements.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {opportunity.niceToHave.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-navy/45">Nice to have</h3>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-navy/80">
                    {opportunity.niceToHave.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-navy/45">Logistics</h3>
                <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <dt className="text-navy/50">Duration</dt>
                  <dd className="text-navy">{opportunity.duration}</dd>
                  <dt className="text-navy/50">Hours / week</dt>
                  <dd className="text-navy">{opportunity.hoursPerWeek}</dd>
                  <dt className="text-navy/50">Application deadline</dt>
                  <dd className="text-navy">{opportunity.applicationDeadline ? formatDeadline(opportunity.applicationDeadline) : "No deadline set"}</dd>
                  <dt className="text-navy/50">Requires CV</dt>
                  <dd className="text-navy">{opportunity.requireCv ? "Yes" : "No"}</dd>
                </dl>
              </div>
              {opportunity.skills.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-navy/45">Skills</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {opportunity.skills.map((s) => (
                      <span key={s} className="rounded-full bg-gray-light px-2.5 py-1 text-xs text-navy/70">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === "challenge" && (
        <div className="mt-5 max-w-2xl">
          {hasChallenge ? (
            <section className="rounded-xl border border-navy/10 bg-white p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-navy">{challengeVersion!.title}</h2>
                <ChallengeStatusBadge status={challenge!.status} />
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap text-navy/75">{challengeVersion!.scenario}</p>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Expected duration</p>
                  <p className="mt-1 text-navy">{challengeVersion!.estimatedMinutes} minutes</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">AI usage policy</p>
                  <p className="mt-1 text-navy">{AI_USAGE_POLICY_LABEL[challengeVersion!.aiUsagePolicy] ?? challengeVersion!.aiUsagePolicy}</p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Tasks</p>
                <ol className="mt-1.5 list-decimal space-y-1.5 pl-5 text-sm text-navy/80">
                  {challengeVersion!.tasks.map((t) => (
                    <li key={t.id}>
                      <span className="font-medium text-navy">{t.title}</span> — {t.description}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Deliverables</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-navy/80">
                  {challengeVersion!.deliverables.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            </section>
          ) : (
            <section className="flex flex-col items-center rounded-xl border border-dashed border-navy/15 bg-white p-10 text-center">
              <FileText className="size-8 text-navy/25" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-navy">No challenge yet</p>
              <p className="mt-1 max-w-sm text-sm text-navy/55">Add a work-sample challenge so candidates can show real evidence of their skills.</p>
              <Button className="mt-4 bg-teal text-white hover:bg-teal/90" render={<Link href={`/company/opportunities/${id}/setup`} />} nativeButton={false}>
                <Plus className="size-3.5" />
                Add challenge
              </Button>
            </section>
          )}
        </div>
      )}

      {tab === "activity" && (
        <div className="mt-5 max-w-2xl">
          <section className="rounded-xl border border-navy/10 bg-white p-5">
            <h2 className="text-sm font-semibold text-navy">Activity</h2>
            {activity.length === 0 ? (
              <p className="mt-2 text-sm text-navy/50">Nothing logged yet.</p>
            ) : (
              <ul className="mt-3 space-y-3 border-l border-navy/10 pl-4">
                {activity.map((e) => (
                  <li key={e.id} className="relative text-sm">
                    <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-teal/50" aria-hidden="true" />
                    <p className="text-navy">{EVENT_LABEL[e.eventType] ?? e.eventType}</p>
                    <p className="text-xs text-navy/45">{formatDeadline(e.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </CompanyPageContainer>
  );
}
