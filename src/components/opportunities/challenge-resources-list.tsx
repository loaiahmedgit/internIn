"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { getChallengeResourceDownloadUrlAction } from "@/lib/challenges/resource-actions";
import { getArtifactVisual, formatBytes } from "@/lib/artifact-visual";

export interface ChallengeResourceListItem {
  id: string;
  name: string;
  artifactKind: string;
  resourceType: "file" | "link";
  generationStatus: "pending" | "generating" | "ready" | "failed" | "requires_upload";
  sizeBytes?: number | null;
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
    <div className="mt-2 space-y-1.5">
      {resources.map((resource) => {
        const ready = resource.generationStatus === "ready";
        const { Icon, iconClassName, bgClassName } = getArtifactVisual(resource.artifactKind);
        return (
          <div key={resource.id} className="flex items-center gap-2.5 rounded-lg border border-black/[0.04] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className={`flex size-8 shrink-0 items-center justify-center rounded-md ${bgClassName}`}>
              <Icon className={`size-4 ${iconClassName}`} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-navy">{resource.name}</p>
              <p className="truncate text-xs text-navy/45">
                {resource.artifactKind.replace(/_/g, " ")}
                {typeof resource.sizeBytes === "number" ? ` · ${formatBytes(resource.sizeBytes)}` : ""}
              </p>
            </div>
            {ready ? (
              <button
                type="button"
                onClick={() => open(resource.id)}
                disabled={pendingId === resource.id}
                aria-label={`Download ${resource.name}`}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-navy/45 transition-colors hover:bg-teal/8 hover:text-teal-ink disabled:opacity-60"
              >
                {pendingId === resource.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
              </button>
            ) : (
              <span className="shrink-0 text-[11px] text-navy/40">Not available yet</span>
            )}
          </div>
        );
      })}
      {error && <p className="px-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
