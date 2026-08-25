"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addSupervisorFeedbackAction } from "@/lib/opportunities/program-actions";

export function AddFeedbackForm({
  programId,
  weeks,
}: {
  programId: string;
  weeks: { id: string; weekNumber: number }[];
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [weekId, setWeekId] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!feedback.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addSupervisorFeedbackAction(programId, feedback.trim(), weekId || undefined);
        setFeedback("");
        setWeekId("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't post feedback.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <Textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={3}
        placeholder="Leave feedback for the intern…"
        aria-label="Supervisor feedback"
      />
      <div className="flex items-center gap-2">
        <select
          value={weekId}
          onChange={(e) => setWeekId(e.target.value)}
          aria-label="Attach feedback to a week"
          className="h-8 rounded-md border border-gray-cool/60 bg-white px-2 text-sm text-navy"
        >
          <option value="">General feedback</option>
          {weeks.map((w) => (
            <option key={w.id} value={w.id}>
              Week {w.weekNumber}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" disabled={isPending || !feedback.trim()}>
          {isPending ? "Posting…" : "Post feedback"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
