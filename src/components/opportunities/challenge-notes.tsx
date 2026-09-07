"use client";

import { useEffect, useState } from "react";
import { ChevronDown, NotebookPen } from "lucide-react";
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
  // Real bug fixed here (same pattern as ChallengeSubmissionForm's own
  // documented fix): a lazy initializer branching on `typeof window` reads
  // localStorage during the CLIENT's first render but not the server's —
  // that's a hydration mismatch (both `value` and the `expanded` state that
  // derives from it). Render the same empty/collapsed state on both, then
  // restore after mount.
  const [value, setValue] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        const saved = localStorage.getItem(notesStorageKey(applicationId)) ?? "";
        setValue(saved);
        // Collapsed by default so an unused scratch pad never lengthens the
        // sidebar — a student who already jotted something down sees it
        // expanded so the note isn't hidden away.
        if (saved.trim().length > 0) setExpanded(true);
      } catch {
        // A corrupt/unreadable note just means starting fresh — never fatal.
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(notesStorageKey(applicationId), value);
        setSavedAt(new Date());
      } catch {
        // Best-effort — losing a scratch note is not worth failing over.
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [applicationId, value, hydrated]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-start gap-2 text-left"
        aria-expanded={expanded}
      >
        <NotebookPen className="mt-0.5 size-3.5 shrink-0 text-navy/45" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-medium text-navy/70">
            Private notes
            <ChevronDown className={`size-3.5 shrink-0 text-navy/40 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
          </span>
          {!expanded && <span className="block text-xs text-navy/45">Only visible to you</span>}
        </span>
      </button>
      {expanded && (
        <div className="mt-2 rounded-lg border border-navy/10 p-3">
          <p className="text-xs text-navy/45">Private scratch space — only visible to you, never submitted.</p>
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={3}
            placeholder="Jot down ideas, links, or reminders while you work…"
            className="mt-2 bg-[#f6f8f9] text-sm"
          />
          {savedAt && <p className="mt-1.5 text-[11px] text-navy/35">Saved {savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>}
        </div>
      )}
    </div>
  );
}
