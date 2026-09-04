"use client";

import { useEffect, useState } from "react";
import { NotebookPen } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

function notesStorageKey(applicationId: string) {
  return `internin-challenge-notes-${applicationId}`;
}

/**
 * Private scratch space for the student's own thinking while working a
 * challenge — never submitted, never sent anywhere, purely a localStorage
 * convenience distinct from ChallengeSubmissionForm's "Notes for the
 * reviewer" field (which IS submitted with the application).
 */
export function ChallengeNotes({ applicationId }: { applicationId: string }) {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(notesStorageKey(applicationId)) ?? "";
    } catch {
      return "";
    }
  });
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(notesStorageKey(applicationId), value);
        setSavedAt(new Date());
      } catch {
        // Best-effort — losing a scratch note is not worth failing over.
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [applicationId, value]);

  return (
    <section className="rounded-2xl border border-black/[0.04] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)]">
      <div className="flex items-center gap-1.5">
        <NotebookPen className="size-3.5 text-navy/40" aria-hidden="true" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy/45">Your notes</h2>
      </div>
      <p className="mt-1 text-xs text-navy/45">Private scratch space — only visible to you, never submitted.</p>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder="Jot down ideas, links, or reminders while you work…"
        className="mt-2.5 bg-[#f6f8f9] text-sm"
      />
      {savedAt && <p className="mt-1.5 text-[11px] text-navy/35">Saved {savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>}
    </section>
  );
}
