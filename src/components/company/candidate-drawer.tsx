"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { shortlistApplicationAction, declineApplicationAction, inviteToInternshipAction } from "@/lib/opportunities/actions";
import { generateCandidateEvidenceAction } from "@/lib/opportunities/evidence-actions";
import { formatDeadline } from "@/lib/format-date";
import type { CandidateRow } from "@/lib/company/candidates-data";
import { stageKeyOf, STAGE_LABEL, STAGE_CLASS } from "@/lib/company/candidate-stage";
import { Sparkles, MoreHorizontal, FileText } from "lucide-react";

const AI_USAGE_LABEL: Record<string, string> = {
  open: "Open",
  ai_allowed: "AI allowed",
  restricted_ai: "Restricted AI",
  controlled: "Controlled",
};

export function CandidateDrawer({ candidates }: { candidates: CandidateRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const candidateId = searchParams.get("candidate");
  const candidate = candidateId ? (candidates.find((c) => c.applicationId === candidateId) ?? null) : null;

  function close() {
    const next = new URLSearchParams(searchParams);
    next.delete("candidate");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <Sheet open={!!candidate} onOpenChange={(next) => !next && close()}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-[42vw] sm:min-w-[440px]">
        {candidate && (
          <>
            <SheetHeader className="border-b border-navy/10 pb-4">
              <div className="flex items-center gap-3 pr-8">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal/10 text-sm font-semibold text-teal-ink">
                  {candidate.studentName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <SheetTitle className="truncate">{candidate.studentName}</SheetTitle>
                  <SheetDescription className="truncate">{candidate.studentEmail}</SheetDescription>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-navy/65">
                <span>{candidate.role}</span>
                <span className="text-navy/30">·</span>
                <Badge variant="secondary" className={STAGE_CLASS[stageKeyOf(candidate)] ?? ""}>
                  {STAGE_LABEL[stageKeyOf(candidate)] ?? candidate.status}
                </Badge>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-navy/45">Overview</h3>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-navy/45">Internship</dt>
                    <dd className="text-navy">{candidate.role}</dd>
                  </div>
                  <div>
                    <dt className="text-navy/45">Applied</dt>
                    <dd className="text-navy">{formatDeadline(candidate.appliedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-navy/45">Submitted</dt>
                    <dd className="text-navy">{candidate.submittedAt ? formatDeadline(candidate.submittedAt) : "Not yet"}</dd>
                  </div>
                  <div>
                    <dt className="text-navy/45">AI usage policy</dt>
                    <dd className="text-navy">{candidate.aiUsageMode ? AI_USAGE_LABEL[candidate.aiUsageMode] : "—"}</dd>
                  </div>
                </dl>
              </section>

              <section className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-navy/45">Evidence</h3>
                {candidate.hasSubmission ? (
                  <div className="mt-2 space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div>
                        <dt className="text-navy/45">Tasks completed</dt>
                        <dd className="text-navy">{candidate.evidence?.tasksCompleted ?? "Not evaluated yet"}</dd>
                      </div>
                      {candidate.evidence && (
                        <div>
                          <dt className="text-navy/45">Time spent</dt>
                          <dd className="text-navy">{candidate.evidence.timeSpentMinutes} min</dd>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-navy/45">Files</p>
                      {candidate.artifacts.length > 0 ? (
                        <ul className="mt-1 space-y-1">
                          {candidate.artifacts.map((a) => (
                            <li key={a.url}>
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-teal-ink hover:underline"
                              >
                                <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                                {a.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-navy/60">Written notes only, no files uploaded.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-navy/60">No submission yet.</p>
                )}
              </section>

              <section className="mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-navy/45">AI summary</h3>
                  <span className="text-xs text-navy/40">Summary, not a decision</span>
                </div>
                {candidate.evidence ? (
                  <div className="mt-2 space-y-3">
                    <p className="text-sm text-navy/80">{candidate.evidence.aiSummary}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-teal/30 bg-teal/5 p-3">
                        <p className="text-xs font-semibold uppercase text-teal-ink">Strength</p>
                        <p className="mt-1 text-sm text-navy/80">{candidate.evidence.strength}</p>
                      </div>
                      <div className="rounded-lg border border-navy/10 bg-white p-3">
                        <p className="text-xs font-semibold uppercase text-navy/50">Areas to examine</p>
                        <p className="mt-1 text-sm text-navy/80">{candidate.evidence.weakness}</p>
                      </div>
                    </div>
                  </div>
                ) : candidate.submissionId ? (
                  <div className="mt-2">
                    <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => generateCandidateEvidenceAction(candidate.submissionId!))}>
                      <Sparkles className="size-3.5" aria-hidden="true" />
                      {isPending ? "Generating…" : "Generate AI summary"}
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-navy/60">Nothing to summarize until a submission comes in.</p>
                )}
              </section>
            </div>

            <SheetFooter className="border-t border-navy/10 pt-3">
              <div className="flex items-center justify-between gap-2">
                {candidate.submissionId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/company/submissions/${candidate.submissionId}`} />}
                    nativeButton={false}
                  >
                    Open full review
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Open full review
                  </Button>
                )}

                <div className="flex items-center gap-2">
                  {stageKeyOf(candidate) === "invited" && candidate.offer && (
                    <Button
                      size="sm"
                      className="bg-teal text-white hover:bg-teal/90"
                      render={
                        <Link
                          href={
                            candidate.offer.status === "accepted"
                              ? `/company/offers/${candidate.offer.id}/program`
                              : `/company/submissions/${candidate.submissionId}`
                          }
                        />
                      }
                      nativeButton={false}
                    >
                      View invitation
                    </Button>
                  )}

                  {(candidate.status === "applied" || candidate.status === "shortlisted") && (
                    <>
                      {candidate.status === "applied" && (
                        <Button variant="outline" size="sm" disabled={isPending} onClick={() => run(() => shortlistApplicationAction(candidate.applicationId))}>
                          Shortlist
                        </Button>
                      )}
                      {!candidate.offer && (
                        <Button
                          size="sm"
                          className="bg-teal text-white hover:bg-teal/90"
                          disabled={isPending}
                          onClick={() => run(() => inviteToInternshipAction(candidate.applicationId))}
                        >
                          Invite
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More decisions" disabled={isPending} />}>
                          <MoreHorizontal className="size-4" aria-hidden="true" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={isPending}
                            onClick={() => run(() => declineApplicationAction(candidate.applicationId))}
                          >
                            Pass
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
