"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { getSubmissionUploadUrlAction, submitChallengeAction } from "@/lib/opportunities/student-actions";
import { describeSubmissionRequirement, type SubmissionRequirement } from "@/lib/challenges/submission-model";
import { formatBytes } from "@/lib/artifact-visual";

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
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    try {
      localStorage.setItem(draftStorageKey(applicationId), JSON.stringify(drafts));
      // Deferred, not called synchronously in the effect body — avoids the
      // cascading-render lint rule while still reflecting a real save.
      const timeout = setTimeout(() => setLastSavedAt(new Date()), 0);
      return () => clearTimeout(timeout);
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
    <form onSubmit={handleSubmit}>
      <section className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)]">
        <div className="flex items-center gap-2">
          <Upload className="size-4 text-teal-ink" aria-hidden="true" />
          <h2 className="text-base font-semibold text-navy">Submission</h2>
        </div>
        <p className="mt-0.5 text-xs text-navy/50">Submit the following deliverables when you&apos;re ready.</p>

        <div className="mt-3 divide-y divide-navy/8">
          {requirements.map((requirement) => {
            const draft = drafts[requirement.id] ?? emptyDraft();
            const uploading = uploadingId === requirement.id;
            return (
              <div key={requirement.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="text-sm font-medium text-navy">{requirement.label}</p>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${requirement.required ? "bg-navy/8 text-navy/55" : "bg-navy/5 text-navy/40"}`}>
                    {requirement.required ? "Required" : "Optional"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-navy/50">{describeSubmissionRequirement(requirement)}</p>

                <div className="mt-2">
                  {(requirement.inputMode === "file" || requirement.inputMode === "multiple_files") && (
                    <>
                      <input
                        ref={(el) => { fileInputRefs.current[requirement.id] = el; }}
                        type="file"
                        multiple={requirement.inputMode === "multiple_files"}
                        accept={requirement.acceptedFormats?.join(",")}
                        onChange={(e) => handleFileChange(requirement, e.target.files)}
                        disabled={uploading}
                        className="hidden"
                      />
                      {draft.files.length > 0 && (
                        <ul className="space-y-1.5">
                          {draft.files.map((file) => (
                            <li key={file.path} className="flex items-center justify-between gap-2 rounded-lg bg-[#f6f8f9] px-2.5 py-1.5">
                              <span className="min-w-0 truncate text-xs font-medium text-navy/75">{file.name} <span className="text-navy/40">· {formatBytes(file.size)}</span></span>
                              <button type="button" onClick={() => removeFile(requirement.id, file.path)} className="shrink-0 text-navy/35 hover:text-destructive" aria-label={`Remove ${file.name}`}>
                                <Trash2 className="size-3.5" aria-hidden="true" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {(requirement.inputMode === "file" ? draft.files.length === 0 : !requirement.maxFiles || draft.files.length < requirement.maxFiles) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploading}
                          onClick={() => fileInputRefs.current[requirement.id]?.click()}
                          className="mt-1.5 h-8 border-navy/12 text-xs text-navy/70 hover:bg-navy/5"
                        >
                          {uploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Upload className="size-3.5" aria-hidden="true" />}
                          {uploading ? "Uploading…" : "Upload file"}
                        </Button>
                      )}
                    </>
                  )}
                  {requirement.inputMode === "url" && (
                    <Input
                      type="url"
                      placeholder={requirement.providers?.length ? `https://${requirement.providers[0]}/...` : "https://..."}
                      value={draft.url}
                      onChange={(e) => updateDraft(requirement.id, { url: e.target.value })}
                      className="h-9 bg-[#f6f8f9] text-sm"
                    />
                  )}
                  {requirement.inputMode === "text" && (
                    <Textarea
                      value={draft.text}
                      onChange={(e) => updateDraft(requirement.id, { text: e.target.value })}
                      rows={3}
                      placeholder="Write your response…"
                      className="bg-[#f6f8f9] text-sm"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 border-t border-navy/8 pt-3">
          <label htmlFor="submission-notes" className="text-xs font-medium text-navy/50">
            Notes for reviewer <span className="text-navy/35">(optional)</span>
          </label>
          <p className="mt-0.5 text-xs text-navy/50">Anything else you&apos;d like to add?</p>
          <Textarea id="submission-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a note (optional)…" rows={2} className="mt-1.5 bg-[#f6f8f9] text-sm" />
        </div>
        {lastSavedAt && (
          <p className="mt-1.5 text-[11px] text-navy/35">Draft saved automatically · Last saved {lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={isPending || !allRequiredSatisfied || uploadingId !== null} className="mt-4 h-11 w-full gap-2 bg-teal text-white hover:bg-teal-ink disabled:bg-navy/10 disabled:text-navy/35">
          {isPending ? "Submitting…" : "Submit challenge"}
          {!isPending && <ArrowRight className="size-4" aria-hidden="true" />}
        </Button>
        {!allRequiredSatisfied && <p className="mt-1.5 text-center text-xs text-navy/40">Complete all required items to submit.</p>}
      </section>
    </form>
  );
}
