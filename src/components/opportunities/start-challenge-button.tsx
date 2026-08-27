"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { startChallengeAction } from "@/lib/opportunities/student-actions";

export function StartChallengeButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleStart() {
    setError(null);
    startTransition(async () => {
      try {
        await startChallengeAction(applicationId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't start the challenge. Try again.");
      }
    });
  }

  return (
    <div>
      <Button onClick={handleStart} disabled={isPending} className="bg-teal text-white hover:bg-teal/90">
        {isPending ? "Starting…" : "Start challenge"}
      </Button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
