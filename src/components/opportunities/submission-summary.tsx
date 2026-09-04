"use client";

import { useState } from "react";
import { CheckCircle2, Download, Loader2, MessageSquare, ShieldCheck, UserCheck } from "lucide-react";
import { getSubmissionArtifactDownloadUrlAction } from "@/lib/challenges/resource-actions";
import { getArtifactVisual, formatBytes } from "@/lib/artifact-visual";

export interface SubmissionSummaryArtifact {
  id: string;
  label: string;
  inputMode: string;
  artifactKind: string;
  storagePath: string | null;
  externalUrl: string | null;
  textContent: string | null;
  originalFilename: string | null;
  sizeBytes?: number | null;
}

function FileArtifactRow({ artifact }: { artifact: SubmissionSummaryArtifact }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { Icon, iconClassName, bgClassName } = getArtifactVisual(artifact.artifactKind);

  async function open() {
    setError(null);
    setPending(true);
    try {
      const result = await getSubmissionArtifactDownloadUrlAction(artifact.id);
      if ("url" in result && result.url) window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open this file.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2.5 px-4 py-3">
      <div className={`flex size-8 shrink-0 items-center justify-center rounded-md ${bgClassName}`}>
        <Icon className={`size-4 ${iconClassName}`} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-navy">{artifact.originalFilename ?? artifact.label}</p>
        <p className="truncate text-xs text-navy/45">{typeof artifact.sizeBytes === "number" ? formatBytes(artifact.sizeBytes) : artifact.label}</p>
      </div>
      <button type="button" onClick={open} disabled={pending} aria-label={`Download ${artifact.label}`} className="flex size-8 shrink-0 items-center justify-center rounded-md text-navy/45 transition-colors hover:bg-teal/8 hover:text-teal-ink disabled:opacity-60">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
      </button>
      {error && <p className="mt-0.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function TimelineStep({ label, sublabel, done }: { label: string; sublabel?: string; done: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 text-center">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${done ? "bg-teal text-white" : "border-2 border-navy/15 bg-white text-navy/25"}`}>
        {done ? <CheckCircle2 className="size-4.5" aria-hidden="true" /> : <span className="size-2 rounded-full bg-current" />}
      </span>
      <div>
        <p className={`text-sm font-medium ${done ? "text-navy" : "text-navy/45"}`}>{label}</p>
        {sublabel && <p className="text-xs text-navy/40">{sublabel}</p>}
      </div>
    </div>
  );
}

/** Real submission review page — exactly what was submitted, nothing
 * inferred. Only real backend states light up a timeline stage; nothing
 * is marked done without a real flag behind it. */
export function SubmissionSummary({
  submission,
  offer,
  artifacts,
  deliverables = [],
}: {
  submission: { status: "submitted" | "reviewed"; submittedAt: Date };
  offer: { status: "pending" | "accepted" | "declined" } | null;
  artifacts: SubmissionSummaryArtifact[];
  deliverables?: string[];
}) {
  const reviewed = submission.status === "reviewed";
  const hasOutcome = Boolean(offer);
  const outcomeLabel = offer ? (offer.status === "pending" ? "Offer received" : offer.status === "accepted" ? "Offer accepted" : "Offer declined") : "Outcome";

  return (
    <div className="mt-3 space-y-5">
      <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-teal/10 text-teal-ink">
              <CheckCircle2 className="size-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-base font-semibold text-navy">Submission submitted!</p>
              <p className="text-sm text-navy/56">Your work has been submitted successfully.</p>
            </div>
          </div>
          <p className="shrink-0 text-xs text-navy/45">Submitted on {submission.submittedAt.toLocaleDateString()}</p>
        </div>

        <div className="mt-6 flex items-start">
          <TimelineStep label="Submitted" sublabel={submission.submittedAt.toLocaleDateString()} done />
          <div className={`mt-4.5 h-0.5 flex-1 ${reviewed || hasOutcome ? "bg-teal" : "bg-navy/10"}`} />
          <TimelineStep label="Under review" done={reviewed || hasOutcome} />
          <div className={`mt-4.5 h-0.5 flex-1 ${hasOutcome ? "bg-teal" : "bg-navy/10"}`} />
          <TimelineStep label="Outcome" sublabel={hasOutcome ? outcomeLabel : undefined} done={hasOutcome} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {artifacts.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-navy">Your submission</p>
            <div className="mt-2 divide-y divide-navy/8 overflow-hidden rounded-2xl border border-black/[0.04] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)]">
              {artifacts.map((artifact) => {
                if (artifact.storagePath) return <FileArtifactRow key={artifact.id} artifact={artifact} />;
                if (artifact.externalUrl) {
                  const { Icon, iconClassName, bgClassName } = getArtifactVisual(artifact.artifactKind);
                  return (
                    <div key={artifact.id} className="flex items-center gap-2.5 px-4 py-3">
                      <div className={`flex size-8 shrink-0 items-center justify-center rounded-md ${bgClassName}`}>
                        <Icon className={`size-4 ${iconClassName}`} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-navy">{artifact.label}</p>
                        <a href={artifact.externalUrl} target="_blank" rel="noreferrer" className="block truncate text-xs text-teal-ink hover:underline">{artifact.externalUrl}</a>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={artifact.id} className="px-4 py-3">
                    <p className="text-sm font-medium text-navy">{artifact.label}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-navy/70">{artifact.textContent}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <p className="text-sm font-semibold text-navy">What happens next?</p>
          <div className="mt-2 space-y-3 rounded-2xl border border-black/[0.04] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)]">
            <div className="flex items-start gap-2.5">
              <UserCheck className="mt-0.5 size-4 shrink-0 text-teal-ink" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-navy">A person reviews your submission</p>
                <p className="text-xs leading-5 text-navy/55">The employer looks at everything you submitted, not just a summary.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <MessageSquare className="mt-0.5 size-4 shrink-0 text-teal-ink" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-navy">You&apos;ll see updates here</p>
                <p className="text-xs leading-5 text-navy/55">This page updates once it&apos;s reviewed, and again if you&apos;re invited forward.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-ink" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-navy">This isn&apos;t a hiring decision yet</p>
                <p className="text-xs leading-5 text-navy/55">A person at the company makes that call — not an automated score.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {deliverables.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-navy">Challenge deliverables</p>
          <ul className="mt-2 space-y-1.5 rounded-2xl border border-black/[0.04] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)]">
            {deliverables.map((deliverable) => (
              <li key={deliverable} className="flex items-start gap-2 text-sm leading-6 text-navy/70">
                <CheckCircle2 className="mt-1 size-3.5 shrink-0 text-teal-ink" aria-hidden="true" />
                <span>{deliverable}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
