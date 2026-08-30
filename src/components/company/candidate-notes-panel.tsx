"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addCandidateNoteAction } from "@/lib/opportunities/notes-actions";
import { formatDeadline } from "@/lib/format-date";

export interface NoteItem {
  id: string;
  body: string;
  authorName: string;
  createdAt: Date;
}

export function CandidateNotesPanel({ applicationId, notes }: { applicationId: string; notes: NoteItem[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addCandidateNoteAction(applicationId, value);
        setValue("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save that note.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add a private note about this candidate…"
          className="min-h-20"
        />
        <div className="flex items-center justify-between">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" size="sm" disabled={isPending || !value.trim()} className="ml-auto bg-teal text-white hover:bg-teal/90">
            {isPending ? "Saving…" : "Add note"}
          </Button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-navy/50">No notes yet — only your team can see these.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-navy/10 bg-white p-3">
              <p className="whitespace-pre-wrap text-sm text-navy/85">{n.body}</p>
              <p className="mt-2 text-xs text-navy/40">
                {n.authorName} · {formatDeadline(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
