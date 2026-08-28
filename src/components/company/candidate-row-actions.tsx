"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { shortlistApplicationAction, declineApplicationAction, inviteToInternshipAction } from "@/lib/opportunities/actions";
import { MoreHorizontal } from "lucide-react";

/**
 * Human makes the hiring decision — these are the only three real actions a
 * company can take on an application (plus Review, a plain link to the
 * evidence page). No AI recommendation, no auto-decision.
 */
export function CandidateRowActions({
  applicationId,
  submissionId,
  status,
  hasOffer,
}: {
  applicationId: string;
  submissionId: string | null;
  status: "applied" | "shortlisted" | "invited" | "declined" | "withdrawn";
  hasOffer: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
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
    <div className="flex items-center justify-end gap-1.5">
      {error && <span className="text-xs text-red-600">{error}</span>}
      {submissionId && (
        <Button render={<Link href={`/company/submissions/${submissionId}`} />} nativeButton={false} variant="outline" size="sm">
          Review
        </Button>
      )}
      {status === "applied" && (
        <Button variant="outline" size="sm" disabled={isPending} onClick={() => run(() => shortlistApplicationAction(applicationId))}>
          Shortlist
        </Button>
      )}
      {(status === "applied" || status === "shortlisted") && !hasOffer && (
        <Button
          size="sm"
          className="bg-teal text-white hover:bg-teal/90"
          disabled={isPending}
          onClick={() => run(() => inviteToInternshipAction(applicationId).then(() => undefined))}
        >
          Invite
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status !== "declined" && status !== "withdrawn" && (
            <DropdownMenuItem onClick={() => run(() => declineApplicationAction(applicationId))} disabled={isPending}>
              Pass
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
