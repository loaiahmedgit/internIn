"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { getSubmissionArtifactDownloadUrlAction } from "@/lib/challenges/resource-actions";
import { getArtifactVisual, formatBytes } from "@/lib/artifact-visual";

export interface SubmissionArtifactCardData {
  id: string;
  label: string;
  artifactKind: string;
  originalFilename: string | null;
  storagePath: string | null;
  externalUrl: string | null;
  textContent: string | null;
  sizeBytes: number | null;
}

/**
 * A real submitted artifact, company side — same private-bucket model as
 * the student's own submission summary: no persisted URL, a signed one is
 * minted on click after the server re-checks this reviewer is actually a
 * member of the company that owns the opportunity (see
 * getSubmissionArtifactDownloadUrlAction). A link artifact opens directly;
 * a text artifact shows its content inline instead of a dead "open" link.
 */
export function SubmissionArtifactCard({ artifact }: { artifact: SubmissionArtifactCardData }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { Icon, iconClassName, bgClassName } = getArtifactVisual(artifact.artifactKind);

  if (artifact.externalUrl) {
    return (
      <a
        href={artifact.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 rounded-lg border border-navy/10 bg-white px-3 py-2.5 transition-colors hover:border-teal/30 hover:bg-teal/5"
      >
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-md ${bgClassName}`}>
          <Icon className={`size-4 ${iconClassName}`} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-navy">{artifact.label}</span>
          <span className="block truncate text-xs text-navy/45">{artifact.externalUrl}</span>
        </span>
      </a>
    );
  }

  if (artifact.textContent !== null) {
    return (
      <div className="rounded-lg border border-navy/10 bg-white px-3 py-2.5">
        <p className="text-sm font-medium text-navy">{artifact.label}</p>
        <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-navy/60">{artifact.textContent}</p>
      </div>
    );
  }

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
    <button
      type="button"
      onClick={open}
      disabled={pending}
      className="flex w-full items-center gap-2.5 rounded-lg border border-navy/10 bg-white px-3 py-2.5 text-left transition-colors hover:border-teal/30 hover:bg-teal/5 disabled:opacity-60"
    >
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-md ${bgClassName}`}>
        {pending ? <Loader2 className="size-4 animate-spin text-navy/40" aria-hidden="true" /> : <Icon className={`size-4 ${iconClassName}`} aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-navy">{artifact.originalFilename ?? artifact.label}</span>
        <span className="block truncate text-xs text-navy/45">{error ?? (typeof artifact.sizeBytes === "number" ? formatBytes(artifact.sizeBytes) : artifact.label)}</span>
      </span>
    </button>
  );
}
