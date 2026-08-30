import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { getCandidateDetail } from "@/lib/company/candidate-detail-data";
import {
  candidateAssistiveSummary,
  candidateInsights,
  candidateSummaryUnavailableMessage,
} from "@/lib/company/candidate-insights";
import { stageKeyOf, STAGE_LABEL, STAGE_CLASS } from "@/lib/company/candidate-stage";
import { CompanyPageContainer } from "@/components/company/page-shell";
import { CandidateActionsPanel } from "@/components/company/candidate-actions-panel";
import { CandidateNotesPanel } from "@/components/company/candidate-notes-panel";
import { DownloadFilesMenu } from "@/components/company/download-files-menu";
import { FileCard } from "@/components/company/file-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDeadline } from "@/lib/format-date";
import {
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileCheck2,
  FileSearch,
  Mail,
  MapPin,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";

type TabKey = "overview" | "resume" | "challenge" | "notes" | "activity";
const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "resume", label: "Resume" },
  { key: "challenge", label: "Challenge" },
  { key: "notes", label: "Notes" },
  { key: "activity", label: "Activity" },
];

const EVENT_LABEL: Record<string, string> = {
  application_shortlisted: "Shortlisted",
  application_declined: "Rejected",
  application_moved_to_review: "Moved back to review",
  internship_offer_created: "Offer sent",
  internship_offer_withdrawn: "Offer withdrawn",
  evidence_generated: "AI summary generated",
};

const AI_USAGE_LABEL: Record<string, string> = {
  open: "Open",
  ai_allowed: "AI allowed",
  restricted_ai: "Restricted AI",
  controlled: "Controlled",
};

export default async function CandidateProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const { id } = await params;
  const query = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === query.tab) ? (query.tab as TabKey) : "overview";

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

  const candidate = await getCandidateDetail(id, membership.company.id);
  if (!candidate) notFound();

  const stage = stageKeyOf({ status: candidate.status, hasSubmission: !!candidate.submission });
  const insights = candidateInsights(candidate);
  const assistiveSummary = candidate.evidence ? candidateAssistiveSummary(candidate) : null;
  const summaryUnavailableMessage = candidateSummaryUnavailableMessage(candidate);
  const files = [
    ...(candidate.profile?.cvUrl ? [{ name: "CV", url: candidate.profile.cvUrl }] : []),
    ...(candidate.submission?.artifacts ?? []),
  ];
  const education = [candidate.profile?.major, candidate.profile?.university].filter(Boolean).join(" · ");
  const educationWithYear = `${education || "Not provided"}${candidate.profile?.graduationYear ? ` (${candidate.profile.graduationYear})` : ""}`;

  return (
    <CompanyPageContainer>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-navy/45">
        <Link href="/company/dashboard" className="rounded-sm hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
          Home
        </Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <Link href="/company/candidates" className="rounded-sm hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
          Candidates
        </Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span className="text-navy/70">{candidate.studentName}</span>
      </nav>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-navy">{candidate.studentName}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-navy/60">
            <span>{candidate.role}</span>
            <Badge variant="secondary" className={STAGE_CLASS[stage] ?? ""}>
              {STAGE_LABEL[stage] ?? candidate.status}
            </Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {candidate.profile?.cvUrl ? (
            <Button variant="outline" size="sm" render={<a href={candidate.profile.cvUrl} target="_blank" rel="noopener noreferrer" />}>
              <ExternalLink className="size-3.5" aria-hidden="true" />
              Open CV
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ExternalLink className="size-3.5" aria-hidden="true" />
              Open CV
            </Button>
          )}
          <DownloadFilesMenu files={files} />
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}>
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {candidate.submission && (
                <DropdownMenuItem render={<Link href={`/company/submissions/${candidate.submission.id}`} />}>
                  <FileSearch className="size-4" aria-hidden="true" />
                  Open full review
                </DropdownMenuItem>
              )}
              <DropdownMenuItem render={<a href={`mailto:${candidate.studentEmail}`} />}>Email candidate</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-5 flex gap-1 border-b border-navy/10">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "overview" ? `/company/candidates/${id}` : `/company/candidates/${id}?tab=${t.key}`}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 ${
              tab === t.key ? "border-teal text-teal-ink" : "border-transparent text-navy/50 hover:text-navy"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {tab === "overview" && (
            <>
              <section className="rounded-xl border border-navy/10 bg-white p-5">
                <h2 className="text-sm font-semibold text-navy">Candidate summary</h2>
                <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <div className="min-w-0 sm:col-span-2">
                    <dt className="text-xs text-navy/45">Email</dt>
                    <dd className="min-w-0">
                      <a
                        href={`mailto:${candidate.studentEmail}`}
                        title={candidate.studentEmail}
                        className="block truncate rounded-sm text-navy hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
                      >
                        {candidate.studentEmail}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-navy/45">Phone</dt>
                    <dd className="text-navy/60">Not provided</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-navy/45">Location</dt>
                    <dd className="text-navy">{candidate.profile?.location ?? "Not provided"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-navy/45">Education</dt>
                    <dd className="text-navy">{educationWithYear}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-navy/45">Availability</dt>
                    <dd className="text-navy">{candidate.profile?.availability ?? "Not provided"}</dd>
                  </div>
                </dl>
                {candidate.profile && candidate.profile.skills.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-navy/45">Skills</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {candidate.profile.skills.map((s) => (
                        <span key={s} className="rounded-full bg-gray-light px-2.5 py-1 text-xs text-navy/70">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {!candidate.profile && <p className="mt-2 text-sm text-navy/50">No profile details on file yet.</p>}
              </section>

              <section className="rounded-xl border border-navy/10 bg-white p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-navy">Submission materials</h2>
                  {candidate.submission && (
                    <Link href={`/company/candidates/${id}?tab=challenge`} className="rounded-sm text-xs font-medium text-teal-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
                      View all
                    </Link>
                  )}
                </div>
                {files.length > 0 ? (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {files.map((f) => (
                      <FileCard key={f.url} name={f.name} url={f.url} />
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-navy/50">No files submitted yet.</p>
                )}
              </section>

              <section className="rounded-xl border border-navy/10 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-navy">Challenge deliverables</h2>
                  {candidate.submission && (
                    <Link href={`/company/candidates/${id}?tab=challenge`} className="rounded-sm text-xs font-medium text-teal-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
                      View details
                    </Link>
                  )}
                </div>
                {candidate.challenge?.deliverables.length ? (
                  <ul className="mt-3 divide-y divide-navy/8">
                    {candidate.challenge.deliverables.map((deliverable) => (
                      <li key={deliverable} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                        <FileCheck2 className="mt-0.5 size-4 shrink-0 text-teal-ink" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-navy">{deliverable}</p>
                          <p className="mt-0.5 text-xs text-navy/45">Required challenge deliverable</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-navy/50">No challenge deliverables are available yet.</p>
                )}
              </section>

              <section className="rounded-xl border border-navy/10 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-navy">Resume preview</h2>
                  {candidate.profile?.cvUrl && (
                    <a
                      href={candidate.profile.cvUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-teal-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
                    >
                      View full CV
                    </a>
                  )}
                </div>
                <div className="mt-3 rounded-lg bg-gray-light/55 px-5 py-4">
                  <p className="text-lg font-semibold tracking-tight text-navy">{candidate.studentName}</p>
                  <p className="text-sm text-navy/60">{candidate.profile?.major ?? candidate.role}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy/50">
                    <span className="flex min-w-0 max-w-full items-center gap-1.5 sm:max-w-[70%]">
                      <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate" title={candidate.studentEmail}>{candidate.studentEmail}</span>
                    </span>
                    {candidate.profile?.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5" aria-hidden="true" />
                        {candidate.profile.location}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 border-t border-navy/10 pt-3">
                    <p className="text-xs font-medium text-navy/45">Education</p>
                    <p className="mt-1 text-sm text-navy">{educationWithYear}</p>
                  </div>
                </div>
              </section>
            </>
          )}

          {tab === "resume" && (
            <section className="rounded-xl border border-navy/10 bg-white p-6">
              <p className="text-lg font-semibold text-navy">{candidate.studentName}</p>
              {candidate.profile?.major && <p className="text-sm text-navy/60">{candidate.profile.major}</p>}
              <p className="mt-1 text-xs text-navy/45">
                {[candidate.profile?.location, candidate.studentEmail].filter(Boolean).join(" · ")}
              </p>
              {(candidate.profile?.university || candidate.profile?.graduationYear) && (
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Education</p>
                  <div className="mt-2 flex items-baseline justify-between text-sm">
                    <span className="text-navy">{candidate.profile?.university ?? "Not provided"}</span>
                    <span className="text-navy/50">{candidate.profile?.graduationYear ?? ""}</span>
                  </div>
                </div>
              )}
              {candidate.profile && candidate.profile.skills.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Skills</p>
                  <p className="mt-2 text-sm text-navy/80">{candidate.profile.skills.join(", ")}</p>
                </div>
              )}
              <div className="mt-6">
                {candidate.profile?.cvUrl ? (
                  <Button render={<a href={candidate.profile.cvUrl} target="_blank" rel="noopener noreferrer" />} className="bg-teal text-white hover:bg-teal/90">
                    View full CV
                  </Button>
                ) : (
                  <p className="text-sm text-navy/50">No CV on file.</p>
                )}
              </div>
            </section>
          )}

          {tab === "challenge" && (
            <section className="rounded-xl border border-navy/10 bg-white p-5">
              {candidate.challenge ? (
                <>
                  <h2 className="text-sm font-semibold text-navy">{candidate.challenge.title}</h2>
                  {candidate.submission && (
                    <p className="mt-1 text-xs text-navy/45">Submitted on {formatDeadline(candidate.submission.submittedAt)}</p>
                  )}
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Submitted files</p>
                    {candidate.submission && candidate.submission.artifacts.length > 0 ? (
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {candidate.submission.artifacts.map((a) => (
                          <FileCard key={a.url} name={a.name} url={a.url} />
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-navy/50">Written notes only, no files uploaded.</p>
                    )}
                  </div>
                  {candidate.submission?.notes && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Notes from the candidate</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-navy/80">{candidate.submission.notes}</p>
                    </div>
                  )}
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Expected deliverables</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-navy/70">
                      {candidate.challenge.deliverables.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <p className="text-sm text-navy/50">No challenge submission yet.</p>
              )}
            </section>
          )}

          {tab === "notes" && (
            <section className="rounded-xl border border-navy/10 bg-white p-5">
              <h2 className="text-sm font-semibold text-navy">Notes</h2>
              <div className="mt-3">
                <CandidateNotesPanel applicationId={candidate.applicationId} notes={candidate.notes} />
              </div>
            </section>
          )}

          {tab === "activity" && (
            <section className="rounded-xl border border-navy/10 bg-white p-5">
              <h2 className="text-sm font-semibold text-navy">Activity</h2>
              {candidate.activity.length === 0 ? (
                <p className="mt-2 text-sm text-navy/50">Nothing logged yet.</p>
              ) : (
                <ul className="mt-3 space-y-3 border-l border-navy/10 pl-4">
                  {candidate.activity.map((e) => (
                    <li key={e.id} className="relative text-sm">
                      <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-teal/50" aria-hidden="true" />
                      <p className="text-navy">{EVENT_LABEL[e.eventType] ?? e.eventType}</p>
                      <p className="text-xs text-navy/45">{formatDeadline(e.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <div className="space-y-5">
          <section className="rounded-xl border border-navy/10 bg-white p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-navy/45">Decision tools</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-navy/50">Applied</dt>
                <dd className="text-navy">{formatDeadline(candidate.appliedAt)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-navy/50">Submitted</dt>
                <dd className="text-navy">{candidate.submission ? formatDeadline(candidate.submission.submittedAt) : "Not yet"}</dd>
              </div>
              {candidate.submission && (
                <div className="flex items-center justify-between">
                  <dt className="text-navy/50">AI usage policy</dt>
                  <dd className="text-navy">{AI_USAGE_LABEL[candidate.submission.aiUsageMode]}</dd>
                </div>
              )}
            </dl>
          </section>

          {insights.length > 0 && (
            <section className="rounded-xl border border-navy/10 bg-white p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-navy/45">Quick insights</h2>
              <ul className="mt-3 space-y-2.5 text-sm text-navy/75">
                {insights.map((insight) => (
                  <li key={`${insight.label}-${insight.value ?? ""}`} className="grid grid-cols-[0.875rem_minmax(0,1fr)] items-start gap-x-2">
                    <CheckCircle2 className="mt-0.5 size-3.5 text-teal-ink" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block">{insight.label}</span>
                      {insight.value && <span className="block text-xs text-navy/50">{insight.value}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-teal/20 bg-teal/5 p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-ink">
                <Sparkles className="size-3.5" aria-hidden="true" />
                AI summary
              </h2>
              <span className="text-xs text-navy/40">Assistive only</span>
            </div>
            {assistiveSummary ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-navy/80">{assistiveSummary.summary}</p>
                <p className="text-xs text-navy/60">
                  <span className="font-medium text-teal-ink">Strength: </span>
                  {assistiveSummary.strength}
                </p>
                <p className="text-xs text-navy/60">
                  <span className="font-medium text-navy/70">Watch for: </span>
                  {assistiveSummary.watchFor}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-navy/50">{summaryUnavailableMessage}</p>
            )}
          </section>

          <section aria-labelledby="candidate-decision-actions" className="rounded-xl border border-navy/10 bg-white p-5">
            <h2 id="candidate-decision-actions" className="text-xs font-semibold uppercase tracking-wide text-navy/45">
              Decision actions
            </h2>
            <div className="mt-3">
              <CandidateActionsPanel
                applicationId={candidate.applicationId}
                candidateName={candidate.studentName}
                submissionId={candidate.submission?.id ?? null}
                status={candidate.status}
                offerStatus={candidate.offer?.status ?? null}
                hasEvidence={!!candidate.evidence}
              />
            </div>
          </section>
        </div>
      </div>
    </CompanyPageContainer>
  );
}
