"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Loader2 } from "lucide-react";
import { getSubmissionArtifactDownloadUrlAction } from "@/lib/challenges/resource-actions";
import type { SubmissionArtifactCardData } from "./submission-artifact-card";

/**
 * There's no zip-bundling service behind this — each real file gets its own
 * real link. A single "download all" button would either fake a bundle or
 * silently only grab one file, so this lists them honestly instead.
 *
 * Two kinds of entries: `files` are already-resolvable plain URLs (CV, and
 * legacy pre-P0 submission.artifacts rows) — `artifacts` are real
 * new-model submission_artifacts rows in the private bucket, so each one
 * mints a signed URL on click instead of carrying a persisted link.
 */
export function DownloadFilesMenu({
  files,
  artifacts = [],
}: {
  files: { name: string; url: string }[];
  artifacts?: SubmissionArtifactCardData[];
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const downloadableArtifacts = artifacts.filter((a) => a.storagePath || a.externalUrl);

  if (files.length === 0 && downloadableArtifacts.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Download className="size-3.5" aria-hidden="true" />
        Download files
      </Button>
    );
  }

  async function openArtifact(artifact: SubmissionArtifactCardData) {
    if (artifact.externalUrl) {
      window.open(artifact.externalUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setError(null);
    setPendingId(artifact.id);
    try {
      const result = await getSubmissionArtifactDownloadUrlAction(artifact.id);
      if ("url" in result && result.url) window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open this file.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Download className="size-3.5" aria-hidden="true" />
        Download files
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {files.map((f) => (
          <DropdownMenuItem key={f.url} render={<a href={f.url} target="_blank" rel="noopener noreferrer" />}>
            {f.name}
          </DropdownMenuItem>
        ))}
        {downloadableArtifacts.map((a) => (
          <DropdownMenuItem key={a.id} onClick={() => openArtifact(a)} disabled={pendingId === a.id}>
            {pendingId === a.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            {a.originalFilename ?? a.label}
          </DropdownMenuItem>
        ))}
        {error && <p className="px-2 py-1.5 text-xs text-destructive">{error}</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
