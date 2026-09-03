"use client";

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { toggleSaveOpportunityAction } from "@/lib/opportunities/student-actions";

export function SaveButton({
  opportunityId,
  initialSaved,
  showLabel = false,
  className = "",
}: {
  opportunityId: string;
  initialSaved: boolean;
  showLabel?: boolean;
  className?: string;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      try {
        const result = await toggleSaveOpportunityAction(opportunityId);
        setSaved(result);
      } catch {
        setSaved(!next);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved opportunities" : "Save opportunity"}
      className={`flex shrink-0 items-center justify-center gap-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 ${
        showLabel ? "h-11 px-4 text-sm font-medium" : "size-8"
      } ${saved ? "text-teal-ink" : "text-navy/50 hover:text-navy"} ${className}`}
    >
      <Bookmark className="size-4" fill={saved ? "currentColor" : "none"} aria-hidden="true" />
      {showLabel ? <span>{saved ? "Saved" : "Save"}</span> : null}
    </button>
  );
}
