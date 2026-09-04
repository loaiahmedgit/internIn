"use client";

import { useState } from "react";
import { CheckCircle2, Circle, FileText, Link as LinkIcon, Loader2 } from "lucide-react";
import { getSubmissionArtifactDownloadUrlAction } from "@/lib/challenges/resource-actions";

export interface SubmissionSummaryArtifact {
  id: string;
  label: string;
  inputMode: string;
  storagePath: string | null;
  externalUrl: string | null;
  textContent: string | null;
  originalFilename: string | null;
}

function FileArtifactRow({ artifact }: { artifact: SubmissionSummaryArtifact }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="flex min-w-0 items-center gap-2.5 text-sm text-navy">
        <FileText className="size-4 shrink-0 text-navy/40" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block truncate font-medium">{artifact.label}</span>
          <span className="block truncate text-xs text-navy/50">{artifact.originalFilename ?? "Submitted"}</span>
        </span>
      </span>
      <div className="shrink-0 text-right">
        <button type="button" onClick={open} disabled={pending} className="text-sm font-medium text-teal-ink hover:underline disabled:opacity-60">
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : "Open"}
        </button>
        {error && <p className="mt-0.5 text-xs text-destructive">{error}</p>}
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
}: {
  submission: { status: "submitted" | "reviewed"; submittedAt: Date };
  offer: { status: "pending" | "accepted" | "declined" } | null;
  artifacts: SubmissionSummaryArtifact[];
}) {
  const reviewed = submission.status === "reviewed";
  const hasOutcome = Boolean(offer);

  return (
    <div className="mt-4 space-y-5">
      <div className="rounded-xl border border-navy/10 bg-white p-4">
        <p className="text-sm font-semibold text-navy">Status</p>
        <ol className="mt-3 space-y-3">
          <li className="flex items-center gap-2.5 text-sm">
            <CheckCircle2 className="size-4 shrink-0 text-teal-ink" aria-hidden="true" />
            <span className="text-navy">Submitted</span>
            <span className="ml-auto text-xs text-navy/45">{submission.submittedAt.toLocaleDateString()}</span>
          </li>
          <li className="flex items-center gap-2.5 text-sm">
            {reviewed ? (
              <CheckCircle2 className="size-4 shrink-0 text-teal-ink" aria-hidden="true" />
            ) : (
              <Circle className="size-4 shrink-0 text-navy/25" aria-hidden="true" />
            )}
            <span className={reviewed ? "text-navy" : "text-navy/50"}>{reviewed ? "Reviewed" : "Under review"}</span>
          </li>
          <li className="flex items-center gap-2.5 text-sm">
            {hasOutcome ? (
              <CheckCircle2 className="size-4 shrink-0 text-teal-ink" aria-hidden="true" />
            ) : (
              <Circle className="size-4 shrink-0 text-navy/25" aria-hidden="true" />
            )}
            <span className={hasOutcome ? "text-navy" : "text-navy/50"}>
              {offer ? (offer.status === "pending" ? "Offer received" : offer.status === "accepted" ? "Offer accepted" : "Offer declined") : "Outcome"}
            </span>
          </li>
        </ol>
      </div>

      {artifacts.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-navy">Submission summary</p>
          <div className="mt-3 divide-y divide-navy/8 overflow-hidden rounded-xl border border-navy/10 bg-white">
            {artifacts.map((artifact) => {
              if (artifact.storagePath) return <FileArtifactRow key={artifact.id} artifact={artifact} />;
              if (artifact.externalUrl) {
                return (
                  <div key={artifact.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="flex min-w-0 items-center gap-2.5 text-sm text-navy">
                      <LinkIcon className="size-4 shrink-0 text-navy/40" aria-hidden="true" />
                      <span className="truncate font-medium">{artifact.label}</span>
                    </span>
                    <a href={artifact.externalUrl} target="_blank" rel="noreferrer" className="shrink-0 truncate text-sm font-medium text-teal-ink hover:underline">
                      {artifact.externalUrl}
                    </a>
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
    </div>
  );
}
