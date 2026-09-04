"use client";

import { useState } from "react";
import { FileText, Link as LinkIcon, Loader2 } from "lucide-react";
import { getChallengeResourceDownloadUrlAction } from "@/lib/challenges/resource-actions";

export interface ChallengeResourceListItem {
  id: string;
  name: string;
  artifactKind: string;
  resourceType: "file" | "link";
  generationStatus: "pending" | "generating" | "ready" | "failed" | "requires_upload";
}

/**
 * "Resources provided" — every real resource row for this challenge
 * version, always named, but only `ready` ones get a working link. A
 * signed URL is minted on click, per request, after the server re-checks
 * the caller is authorized (never a pre-rendered/persisted URL).
 */
export function ChallengeResourcesList({ resources }: { resources: ChallengeResourceListItem[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(resourceId: string) {
    setError(null);
    setPendingId(resourceId);
    try {
      const { url } = await getChallengeResourceDownloadUrlAction(resourceId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open this resource.");
    } finally {
      setPendingId(null);
    }
  }

  if (resources.length === 0) return null;

  return (
    <div className="mt-3 divide-y divide-navy/8 overflow-hidden rounded-xl border border-navy/10 bg-white">
      {resources.map((resource) => {
        const ready = resource.generationStatus === "ready";
        return (
          <div key={resource.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="flex min-w-0 items-center gap-2.5 text-sm text-navy">
              {resource.resourceType === "link" ? (
                <LinkIcon className="size-4 shrink-0 text-navy/40" aria-hidden="true" />
              ) : (
                <FileText className="size-4 shrink-0 text-navy/40" aria-hidden="true" />
              )}
              <span className="truncate">{resource.name}</span>
              <span className="shrink-0 text-xs text-navy/45">· {resource.artifactKind.replace(/_/g, " ")}</span>
            </span>
            {ready ? (
              <button
                type="button"
                onClick={() => open(resource.id)}
                disabled={pendingId === resource.id}
                className="shrink-0 text-sm font-medium text-teal-ink hover:underline disabled:opacity-60"
              >
                {pendingId === resource.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : "Download"}
              </button>
            ) : (
              <span className="shrink-0 text-xs text-navy/40">Not available yet</span>
            )}
          </div>
        );
      })}
      {error && <p className="px-4 py-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
