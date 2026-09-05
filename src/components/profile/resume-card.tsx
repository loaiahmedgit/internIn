"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCvUploadUrlAction } from "@/lib/opportunities/student-actions";
import { removeStudentCvAction, updateStudentCvFileAction } from "@/lib/opportunities/student-profile-sections-actions";

const buttonClass =
  "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-navy/12 bg-white px-3.5 text-sm font-medium text-navy transition-colors hover:border-teal/25 hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40";

/**
 * Resume is a self-contained rail card — the ONE place CV is edited (no
 * duplicate "CV" field inside the main Edit Profile sheet). Plain upload,
 * no AI skill/interest extraction here (that stays onboarding-only), so
 * adding a resume never silently changes the Skills section.
 */
export function ResumeCard({ hasCv, cvUrl }: { hasCv: boolean; cvUrl: string | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const { token, path } = await getCvUploadUrlAction(file.name);
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from("student-cvs").uploadToSignedUrl(path, token, file);
      if (uploadError) throw new Error(`Couldn't upload the file: ${uploadError.message}`);
      await updateStudentCvFileAction(path);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that file.");
    } finally {
      setUploading(false);
    }
  }

  function remove() {
    startTransition(async () => {
      await removeStudentCvAction();
      router.refresh();
    });
  }

  const inputId = "resume-card-upload";

  return (
    <div>
      <h2 className="text-sm font-semibold text-navy">Resume</h2>
      <p className="mt-0.5 text-xs text-navy/55">Optional supporting document for your profile.</p>

      {hasCv ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 rounded-lg bg-[#f6f8f9] px-3 py-2">
            <FileText className="size-4 shrink-0 text-teal-ink" aria-hidden="true" />
            <span className="min-w-0 truncate text-sm font-medium text-navy">{cvUrl ? "CV link added" : "CV on file"}</span>
          </div>
          {cvUrl ? (
            <a href={cvUrl} target="_blank" rel="noreferrer" className={buttonClass}>View CV</a>
          ) : (
            <>
              <label htmlFor={inputId} className={`${buttonClass} cursor-pointer`}>{uploading ? "Uploading…" : "Upload new CV"}</label>
              <input id={inputId} type="file" accept="application/pdf" disabled={uploading} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
            </>
          )}
          <button type="button" onClick={remove} disabled={isPending} className="w-full text-xs font-medium text-navy/45 hover:text-destructive">Remove</button>
        </div>
      ) : (
        <div className="mt-2">
          <label htmlFor={inputId} className="inline-block cursor-pointer text-sm font-medium text-teal-ink hover:underline">{uploading ? "Uploading…" : "Add resume →"}</label>
          <input id={inputId} type="file" accept="application/pdf" disabled={uploading} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}
