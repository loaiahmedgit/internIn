"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateCandidateEvidenceAction } from "@/lib/opportunities/evidence-actions";
export function GenerateEvidenceButton({
  submissionId,
  hasSummary,
}: {
  submissionId: string;
  hasSummary: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <div className="mt-4">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError("");
          start(async () => {
            try {
              await generateCandidateEvidenceAction(submissionId);
              router.refresh();
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "Could not evaluate evidence. Try again.",
              );
            }
          });
        }}
      >
        {pending
          ? "Evaluating evidence…"
          : hasSummary
            ? "Refresh evidence summary"
            : "Evaluate evidence"}
      </Button>
      <p role="alert" className="mt-2 text-xs text-red-700">
        {error}
      </p>
    </div>
  );
}
