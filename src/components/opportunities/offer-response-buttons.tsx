"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { respondToOfferAction } from "@/lib/opportunities/student-actions";

export function OfferResponseButtons({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function respond(decision: "accepted" | "declined") {
    setError(null);
    startTransition(async () => {
      try {
        await respondToOfferAction(applicationId, decision);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't record your response. Try again.");
      }
    });
  }

  return (
    <div className="mt-4">
      <div className="flex gap-3">
        <Button onClick={() => respond("accepted")} disabled={isPending} className="bg-teal text-white hover:bg-teal/90">
          Accept offer
        </Button>
        <Button onClick={() => respond("declined")} disabled={isPending} variant="outline">
          Decline
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
