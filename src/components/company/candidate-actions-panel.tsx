"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  shortlistApplicationAction,
  declineApplicationAction,
  inviteToInternshipAction,
  moveApplicationToReviewAction,
  withdrawOfferAction,
} from "@/lib/opportunities/actions";
import { generateCandidateEvidenceAction } from "@/lib/opportunities/evidence-actions";
import { Sparkles, Star, Send, XCircle, Undo2, FileSearch } from "lucide-react";

type Status = "applied" | "shortlisted" | "invited" | "declined" | "withdrawn";

/**
 * The one place every real status transition lives on this page — the
 * decision buttons below all call the exact same real server actions, so
 * they can never attempt a transition the backend doesn't actually support.
 */
export function CandidateActionsPanel({
  applicationId,
  submissionId,
  status,
  offerStatus,
  hasEvidence,
}: {
  applicationId: string;
  submissionId: string | null;
  status: Status;
  offerStatus: "pending" | "accepted" | "declined" | null;
  hasEvidence: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!hasEvidence && submissionId && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={isPending}
          onClick={() => run(() => generateCandidateEvidenceAction(submissionId))}
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          {isPending ? "Generating…" : "Generate AI summary"}
        </Button>
      )}

      <div className="space-y-2 border-t border-navy/10 pt-3">
        {(status === "applied" || status === "shortlisted") && !offerStatus && (
          <>
            {status === "applied" && (
              <Button variant="outline" className="w-full" disabled={isPending} onClick={() => run(() => shortlistApplicationAction(applicationId))}>
                <Star className="size-4" aria-hidden="true" />
                Shortlist
              </Button>
            )}
            <Button
              className="w-full bg-teal text-white hover:bg-teal/90"
              disabled={isPending}
              onClick={() => run(() => inviteToInternshipAction(applicationId))}
            >
              <Send className="size-4" aria-hidden="true" />
              Send offer
            </Button>
            {status === "shortlisted" && (
              <Button variant="outline" className="w-full" disabled={isPending} onClick={() => run(() => moveApplicationToReviewAction(applicationId))}>
                <Undo2 className="size-4" aria-hidden="true" />
                Move back to review
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
              disabled={isPending}
              onClick={() => run(() => declineApplicationAction(applicationId))}
            >
              <XCircle className="size-4" aria-hidden="true" />
              Not selected
            </Button>
          </>
        )}

        {status === "invited" && (
          <>
            {submissionId && (
              <Button variant="outline" className="w-full" render={<Link href={`/company/submissions/${submissionId}`} />} nativeButton={false}>
                <FileSearch className="size-4" aria-hidden="true" />
                View offer
              </Button>
            )}
            {offerStatus === "pending" && (
              <Button
                variant="outline"
                className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
                disabled={isPending}
                onClick={() => run(() => withdrawOfferAction(applicationId))}
              >
                <XCircle className="size-4" aria-hidden="true" />
                Withdraw offer
              </Button>
            )}
          </>
        )}

        {(status === "declined" || status === "withdrawn") && (
          <Button variant="outline" className="w-full" disabled={isPending} onClick={() => run(() => moveApplicationToReviewAction(applicationId))}>
            <Undo2 className="size-4" aria-hidden="true" />
            Restore to review
          </Button>
        )}
      </div>
    </div>
  );
}
