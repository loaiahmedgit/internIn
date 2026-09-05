"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { startChallengeAction } from "@/lib/opportunities/student-actions";

export function StartChallengeButton({ applicationId, className }: { applicationId: string; className?: string }) {
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
      <Button onClick={handleStart} disabled={isPending} className={cn("gap-2 bg-teal text-white hover:bg-teal-ink", className)}>
        {isPending ? "Starting…" : "Start challenge"}
        {!isPending && <ArrowRight className="size-4" aria-hidden="true" />}
      </Button>
      {error && <p className="mt-2 text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
