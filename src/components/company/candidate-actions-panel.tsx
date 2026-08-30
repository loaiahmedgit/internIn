"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  candidateName,
  submissionId,
  status,
  offerStatus,
  hasEvidence,
}: {
  applicationId: string;
  candidateName: string;
  submissionId: string | null;
  status: Status;
  offerStatus: "pending" | "accepted" | "declined" | null;
  hasEvidence: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  function run(action: () => Promise<unknown>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        onSuccess?.();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

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

      <div className="border-t border-navy/10 pt-3">
        {(status === "applied" || status === "shortlisted") && (
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
            <Button
              variant="outline"
              disabled={isPending || status === "shortlisted"}
              onClick={() => run(() => shortlistApplicationAction(applicationId))}
            >
              <Star className="size-4" aria-hidden="true" />
              {status === "shortlisted" ? "Shortlisted" : "Shortlist"}
            </Button>

            {offerStatus ? (
              <Button className="bg-teal text-white hover:bg-teal/90" disabled>
                <Send className="size-4" aria-hidden="true" />
                Offer closed
              </Button>
            ) : (
              <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
                <DialogTrigger render={<Button className="bg-teal text-white hover:bg-teal/90" disabled={isPending} />}>
                  <Send className="size-4" aria-hidden="true" />
                  Offer
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send an offer to {candidateName}?</DialogTitle>
                    <DialogDescription>
                      This creates the internship offer and unlocks the program workflow. The QAR 499 placement fee is recorded for this successful hire.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOfferOpen(false)} disabled={isPending}>Cancel</Button>
                    <Button
                      className="bg-teal text-white hover:bg-teal/90"
                      disabled={isPending}
                      onClick={() => run(() => inviteToInternshipAction(applicationId), () => setOfferOpen(false))}
                    >
                      {isPending ? "Sending…" : "Send offer"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
              <DialogTrigger
                render={
                  <Button
                    variant="outline"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10"
                    disabled={isPending}
                  />
                }
              >
                <XCircle className="size-4" aria-hidden="true" />
                Not selected
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mark {candidateName} as not selected?</DialogTitle>
                  <DialogDescription>
                    The candidate will leave the active pipeline. You can restore them to review later.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeclineOpen(false)} disabled={isPending}>Cancel</Button>
                  <Button
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => run(() => declineApplicationAction(applicationId), () => setDeclineOpen(false))}
                  >
                    {isPending ? "Updating…" : "Mark as not selected"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {status === "shortlisted" && !offerStatus && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full text-navy/55"
            disabled={isPending}
            onClick={() => run(() => moveApplicationToReviewAction(applicationId))}
          >
            <Undo2 className="size-4" aria-hidden="true" />
            Move back to review
          </Button>
        )}

        {status === "invited" && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {submissionId ? (
              <Button className="bg-teal text-white hover:bg-teal/90" render={<Link href={`/company/submissions/${submissionId}`} />} nativeButton={false}>
                <FileSearch className="size-4" aria-hidden="true" />
                View offer
              </Button>
            ) : (
              <Button className="bg-teal text-white" disabled>
                <Send className="size-4" aria-hidden="true" />
                Offer sent
              </Button>
            )}
            {offerStatus === "pending" && (
              <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
                <DialogTrigger
                  render={
                    <Button
                      variant="outline"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10"
                      disabled={isPending}
                    />
                  }
                >
                  <XCircle className="size-4" aria-hidden="true" />
                  Withdraw offer
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Withdraw {candidateName}&apos;s offer?</DialogTitle>
                    <DialogDescription>The candidate will return to the shortlisted stage.</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setWithdrawOpen(false)} disabled={isPending}>Cancel</Button>
                    <Button
                      variant="destructive"
                      disabled={isPending}
                      onClick={() => run(() => withdrawOfferAction(applicationId), () => setWithdrawOpen(false))}
                    >
                      {isPending ? "Withdrawing…" : "Withdraw offer"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}

        {(status === "declined" || status === "withdrawn") && (
          <Button variant="outline" className="w-full" disabled={isPending || !!offerStatus} onClick={() => run(() => moveApplicationToReviewAction(applicationId))}>
            <Undo2 className="size-4" aria-hidden="true" />
            {offerStatus ? "Offer history prevents restore" : "Restore to review"}
          </Button>
        )}
      </div>
    </div>
  );
}
