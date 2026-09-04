"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { getSubmissionUploadUrlAction, submitChallengeAction } from "@/lib/opportunities/student-actions";
import type { SubmissionRequirement } from "@/lib/challenges/submission-model";

interface ArtifactPayload {
  requirementId: string;
  inputMode: SubmissionRequirement["inputMode"];
  artifactKind: SubmissionRequirement["artifactKind"];
  label: string;
  storagePath?: string;
  originalFilename?: string;
  externalUrl?: string;
  textContent?: string;
}

interface UploadedFile {
  path: string;
  name: string;
  size: number;
}

/** Text/url/uploaded-file-path state — never a raw browser File object,
 * which can't survive a refresh. Files are uploaded to their final
 * location the moment they're chosen (see handleFileChange), so the
 * draft here only ever holds a real, already-uploaded storage path. */
interface RequirementDraft {
  files: UploadedFile[];
  url: string;
  text: string;
}

function emptyDraft(): RequirementDraft {
  return { files: [], url: "", text: "" };
}

function draftStorageKey(applicationId: string) {
  return `internin-challenge-draft-${applicationId}`;
}

function isSatisfied(requirement: SubmissionRequirement, draft: RequirementDraft): boolean {
  switch (requirement.inputMode) {
    case "file":
      return draft.files.length >= 1;
    case "multiple_files": {
      const min = requirement.minFiles ?? 1;
      const max = requirement.maxFiles;
      return draft.files.length >= min && (!max || draft.files.length <= max);
    }
    case "url":
      return draft.url.trim().length > 0;
    case "text":
      return draft.text.trim().length > 0;
  }
}

export function ChallengeSubmissionForm({
  applicationId,
  requirements,
}: {
  applicationId: string;
  requirements: SubmissionRequirement[];
}) {
  const router = useRouter();
  // Lazy initializer, not an effect: reading localStorage here (guarded by
  // the SSR check) restores a saved draft on the client's first render
  // without ever calling setState inside an effect body. Never a raw File
  // object — those can't survive localStorage, so only already-uploaded
  // file paths, text, and URLs are restored (see handleFileChange).
  const [drafts, setDrafts] = useState<Record<string, RequirementDraft>>(() => {
    const initial = Object.fromEntries(requirements.map((r) => [r.id, emptyDraft()]));
    if (typeof window === "undefined") return initial;
    try {
      const raw = localStorage.getItem(draftStorageKey(applicationId));
      if (raw) return { ...initial, ...JSON.parse(raw) };
    } catch {
      // A corrupt/unreadable draft just means starting fresh — never fatal.
    }
    return initial;
  });
  const [notes, setNotes] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(draftStorageKey(applicationId), JSON.stringify(drafts));
    } catch {
      // Best-effort autosave — a full localStorage quota is not worth failing over.
    }
  }, [applicationId, drafts]);

  function updateDraft(requirementId: string, patch: Partial<RequirementDraft>) {
    setDrafts((prev) => ({ ...prev, [requirementId]: { ...prev[requirementId], ...patch } }));
  }

  async function handleFileChange(requirement: SubmissionRequirement, fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    setError(null);
    setUploadingId(requirement.id);
    try {
      const uploaded: UploadedFile[] = [];
      for (const file of files) {
        const { path, token } = await getSubmissionUploadUrlAction(applicationId, file.name);
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage.from("submission-artifacts").uploadToSignedUrl(path, token, file);
        if (uploadError) throw new Error(`Couldn't upload "${file.name}": ${uploadError.message}`);
        uploaded.push({ path, name: file.name, size: file.size });
      }
      const current = drafts[requirement.id] ?? emptyDraft();
      const nextFiles = requirement.inputMode === "multiple_files" ? [...current.files, ...uploaded] : uploaded;
      updateDraft(requirement.id, { files: nextFiles });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that file.");
    } finally {
      setUploadingId(null);
    }
  }

  function removeFile(requirementId: string, path: string) {
    const current = drafts[requirementId] ?? emptyDraft();
    updateDraft(requirementId, { files: current.files.filter((f) => f.path !== path) });
  }

  const allRequiredSatisfied = requirements.every((r) => !r.required || isSatisfied(r, drafts[r.id] ?? emptyDraft()));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      const artifacts = requirements.flatMap((requirement): ArtifactPayload[] => {
        const draft = drafts[requirement.id] ?? emptyDraft();
        if (requirement.inputMode === "file" || requirement.inputMode === "multiple_files") {
          return draft.files.map((file) => ({
            requirementId: requirement.id,
            inputMode: requirement.inputMode,
            artifactKind: requirement.artifactKind,
            label: requirement.label,
            storagePath: file.path,
            originalFilename: file.name,
          }));
        }
        if (requirement.inputMode === "url" && draft.url.trim()) {
          return [{ requirementId: requirement.id, inputMode: "url" as const, artifactKind: requirement.artifactKind, label: requirement.label, externalUrl: draft.url.trim() }];
        }
        if (requirement.inputMode === "text" && draft.text.trim()) {
          return [{ requirementId: requirement.id, inputMode: "text" as const, artifactKind: requirement.artifactKind, label: requirement.label, textContent: draft.text.trim() }];
        }
        return [];
      });

      await submitChallengeAction({ applicationId, artifacts, notes: notes.trim() || undefined });
      try {
        localStorage.removeItem(draftStorageKey(applicationId));
      } catch {
        // Non-fatal — the submission itself already succeeded.
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit. Try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      {requirements.map((requirement) => {
        const draft = drafts[requirement.id] ?? emptyDraft();
        const satisfied = isSatisfied(requirement, draft);
        return (
          <div key={requirement.id} className="rounded-xl border border-navy/10 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-navy">
                {satisfied ? (
                  <CheckCircle2 className="size-4 shrink-0 text-teal-ink" aria-hidden="true" />
                ) : (
                  <Circle className="size-4 shrink-0 text-navy/25" aria-hidden="true" />
                )}
                {requirement.label}
              </label>
              <span className={`shrink-0 text-xs ${requirement.required ? "text-navy/45" : "text-navy/35"}`}>
                {requirement.required ? "Required" : "Optional"}
              </span>
            </div>
            {requirement.instructions && <p className="mt-1 pl-6 text-xs text-navy/50">{requirement.instructions}</p>}

            <div className="mt-3 pl-6">
              {(requirement.inputMode === "file" || requirement.inputMode === "multiple_files") && (
                <>
                  <Input
                    type="file"
                    multiple={requirement.inputMode === "multiple_files"}
                    accept={requirement.acceptedFormats?.join(",")}
                    onChange={(e) => handleFileChange(requirement, e.target.files)}
                    disabled={uploadingId === requirement.id}
                  />
                  {requirement.acceptedFormats && (
                    <p className="mt-1 text-xs text-navy/45">Accepted: {requirement.acceptedFormats.join(", ")}</p>
                  )}
                  {uploadingId === requirement.id && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-navy/50">
                      <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Uploading…
                    </p>
                  )}
                  {draft.files.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {draft.files.map((file) => (
                        <li key={file.path} className="flex items-center justify-between gap-2 rounded-md bg-[#f6f8f9] px-2.5 py-1.5 text-xs text-navy/70">
                          <span className="truncate">{file.name}</span>
                          <button type="button" onClick={() => removeFile(requirement.id, file.path)} className="shrink-0 text-navy/40 hover:text-navy">
                            <X className="size-3.5" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {requirement.inputMode === "url" && (
                <Input
                  type="url"
                  placeholder={requirement.providers?.length ? `https://${requirement.providers[0]}/...` : "https://..."}
                  value={draft.url}
                  onChange={(e) => updateDraft(requirement.id, { url: e.target.value })}
                />
              )}
              {requirement.inputMode === "text" && (
                <Textarea
                  value={draft.text}
                  onChange={(e) => updateDraft(requirement.id, { text: e.target.value })}
                  rows={5}
                  placeholder="Write your response…"
                />
              )}
            </div>
          </div>
        );
      })}

      <div className="rounded-xl border border-navy/10 bg-white p-4">
        <label htmlFor="submission-notes" className="text-sm font-medium text-navy">
          Notes for the reviewer <span className="text-navy/40">(optional)</span>
        </label>
        <Textarea id="submission-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1.5" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending || !allRequiredSatisfied || uploadingId !== null} className="bg-teal text-white hover:bg-teal-ink">
        {isPending ? "Submitting…" : "Submit challenge"}
      </Button>
    </form>
  );
}
