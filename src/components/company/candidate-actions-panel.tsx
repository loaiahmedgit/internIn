"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  declineApplicationAction,
  inviteToInternshipAction,
  moveApplicationToReviewAction,
  shortlistApplicationAction,
  withdrawOfferAction,
} from "@/lib/opportunities/actions";
import { generateCandidateEvidenceAction } from "@/lib/opportunities/evidence-actions";
import { FileSearch, MoreHorizontal, Send, Sparkles, Star, Undo2, XCircle } from "lucide-react";

type Status = "applied" | "shortlisted" | "invited" | "declined" | "withdrawn";

/** The single UI for real candidate-stage transitions on the profile page. */
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
  const [rejectOpen, setRejectOpen] = useState(false);
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

  function renderSendOffer(primary: boolean) {
    return (
      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
        <DialogTrigger
          render={
            <Button
              variant={primary ? "default" : "outline"}
              className={primary ? "flex-1 bg-teal text-white hover:bg-teal/90" : "flex-1"}
              disabled={isPending}
            />
          }
        >
          <Send className="size-4" aria-hidden="true" />
          Send offer
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
    );
  }

  function renderMoreActions(items: "review" | "shortlisted" | "offer") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon" aria-label="More decision actions" disabled={isPending} />}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {items === "shortlisted" && (
            <DropdownMenuItem onClick={() => run(() => moveApplicationToReviewAction(applicationId))}>
              <Undo2 className="size-4" aria-hidden="true" />
              Move back to review
            </DropdownMenuItem>
          )}
          {(items === "review" || items === "shortlisted") && (
            <DropdownMenuItem variant="destructive" onClick={() => setRejectOpen(true)}>
              <XCircle className="size-4" aria-hidden="true" />
              Reject candidate
            </DropdownMenuItem>
          )}
          {items === "offer" && offerStatus === "pending" && (
            <DropdownMenuItem variant="destructive" onClick={() => setWithdrawOpen(true)}>
              <Undo2 className="size-4" aria-hidden="true" />
              Withdraw offer
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
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
        {status === "applied" && (
          <div className="flex items-center gap-2">
            <Button
              className="flex-1 bg-teal text-white hover:bg-teal/90"
              disabled={isPending}
              onClick={() => run(() => shortlistApplicationAction(applicationId))}
            >
              <Star className="size-4" aria-hidden="true" />
              Shortlist
            </Button>
            {renderSendOffer(false)}
            {renderMoreActions("review")}
          </div>
        )}

        {status === "shortlisted" && offerStatus !== "pending" && offerStatus !== "accepted" && (
          <div className="flex items-center gap-2">
            {renderSendOffer(true)}
            {renderMoreActions("shortlisted")}
          </div>
        )}

        {status === "invited" && submissionId && (
          <div className="flex items-center gap-2">
            <Button
              className="flex-1 bg-teal text-white hover:bg-teal/90"
              render={<Link href={`/company/submissions/${submissionId}`} />}
              nativeButton={false}
            >
              <FileSearch className="size-4" aria-hidden="true" />
              View offer
            </Button>
            {offerStatus === "pending" && renderMoreActions("offer")}
          </div>
        )}

        {(status === "declined" || status === "withdrawn") && (offerStatus === null || offerStatus === "declined") && (
          <Button
            variant="outline"
            className="w-full"
            disabled={isPending}
            onClick={() => run(() => moveApplicationToReviewAction(applicationId))}
          >
            <Undo2 className="size-4" aria-hidden="true" />
            Restore to review
          </Button>
        )}
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {candidateName}?</DialogTitle>
            <DialogDescription>
              The candidate will move to rejected records and leave the active pipeline. You can restore them to review later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={isPending}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => run(() => declineApplicationAction(applicationId), () => setRejectOpen(false))}
            >
              {isPending ? "Rejecting…" : "Reject candidate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw {candidateName}&apos;s offer?</DialogTitle>
            <DialogDescription>
              This revokes the pending offer and returns the candidate to the shortlisted stage.
            </DialogDescription>
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
    </div>
  );
}
