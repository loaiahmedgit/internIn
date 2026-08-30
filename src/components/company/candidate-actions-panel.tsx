"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { shortlistApplicationAction, declineApplicationAction, inviteToInternshipAction } from "@/lib/opportunities/actions";
import { generateCandidateEvidenceAction } from "@/lib/opportunities/evidence-actions";
import { Sparkles, Star, Send, XCircle } from "lucide-react";

type Status = "applied" | "shortlisted" | "invited" | "declined" | "withdrawn";

const STAGE_OPTION_LABEL: Record<Status, string> = {
  applied: "To review",
  shortlisted: "Shortlisted",
  invited: "Invited",
  declined: "Passed",
  withdrawn: "Withdrawn",
};

/**
 * The one place every real status transition lives on this page — the Stage
 * select and the three decision buttons below both call the exact same
 * shortlist/decline/invite server actions, so they can never disagree with
 * each other or attempt a transition the backend doesn't actually support.
 */
export function CandidateActionsPanel({
  applicationId,
  submissionId,
  status,
  hasOffer,
  hasEvidence,
}: {
  applicationId: string;
  submissionId: string | null;
  status: Status;
  hasOffer: boolean;
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

  const stageOptions: Status[] =
    status === "applied" || status === "shortlisted"
      ? [status, ...(hasOffer ? [] : (["invited"] as Status[])), "declined" as Status].filter(
          (v, i, arr) => arr.indexOf(v) === i,
        )
      : [status];

  function handleStageChange(next: string) {
    if (next === status) return;
    if (next === "shortlisted") run(() => shortlistApplicationAction(applicationId));
    else if (next === "invited") run(() => inviteToInternshipAction(applicationId));
    else if (next === "declined") run(() => declineApplicationAction(applicationId));
  }

  const canDecide = status === "applied" || status === "shortlisted";

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="stage-select" className="mb-1 block text-xs text-navy/45">
          Stage
        </label>
        <select
          id="stage-select"
          value={status}
          disabled={isPending || stageOptions.length <= 1}
          onChange={(e) => handleStageChange(e.target.value)}
          className="h-8 w-full rounded-lg border border-navy/15 bg-white px-2.5 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 disabled:opacity-60"
        >
          {stageOptions.map((s) => (
            <option key={s} value={s}>
              {STAGE_OPTION_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

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

      {canDecide && (
        <div className="space-y-2 border-t border-navy/10 pt-3">
          {status === "applied" && (
            <Button variant="outline" className="w-full" disabled={isPending} onClick={() => run(() => shortlistApplicationAction(applicationId))}>
              <Star className="size-4" aria-hidden="true" />
              Shortlist
            </Button>
          )}
          {!hasOffer && (
            <Button
              className="w-full bg-teal text-white hover:bg-teal/90"
              disabled={isPending}
              onClick={() => run(() => inviteToInternshipAction(applicationId))}
            >
              <Send className="size-4" aria-hidden="true" />
              Invite
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
            disabled={isPending}
            onClick={() => run(() => declineApplicationAction(applicationId))}
          >
            <XCircle className="size-4" aria-hidden="true" />
            Pass
          </Button>
        </div>
      )}
    </div>
  );
}
