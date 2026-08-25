"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateCandidateEvidenceAction } from "@/lib/opportunities/evidence-actions";
import { Sparkles } from "lucide-react";

export function GenerateEvidenceButton({
  submissionId,
  hasExisting,
}: {
  submissionId: string;
  hasExisting: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      try {
        await generateCandidateEvidenceAction(submissionId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't generate a summary. Try again.");
      }
    });
  }

  return (
    <div>
      <Button onClick={handleGenerate} disabled={isPending} variant={hasExisting ? "outline" : "default"}>
        <Sparkles className="mr-1.5 size-4" />
        {isPending ? "Generating…" : hasExisting ? "Regenerate AI summary" : "Generate AI summary"}
      </Button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
