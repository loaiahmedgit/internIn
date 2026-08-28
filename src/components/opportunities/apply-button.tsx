"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { applyToOpportunityAction } from "@/lib/opportunities/student-actions";

export function ApplyButton({ opportunityId }: { opportunityId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleApply() {
    setError(null);
    startTransition(async () => {
      try {
        const applicationId = await applyToOpportunityAction(opportunityId, document.referrer || undefined);
        router.push(`/student/applications/${applicationId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't apply. Try again.");
      }
    });
  }

  return (
    <div>
      <Button onClick={handleApply} disabled={isPending}>
        {isPending ? "Applying…" : "Apply"}
      </Button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
