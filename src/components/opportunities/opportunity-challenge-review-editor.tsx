"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Challenge } from "@/lib/ai";
import { Button } from "@/components/ui/button";
import { ChallengeBuilder } from "@/components/challenges/challenge-builder";

export function OpportunityChallengeReviewEditor({
  opportunityId,
  role,
  initialChallenge,
  isDraft = true,
}: {
  opportunityId: string;
  role: string;
  initialChallenge: Challenge;
  isDraft?: boolean;
}) {
  const [challenge, setChallenge] = useState(initialChallenge);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 sm:py-10">
      <Button variant="ghost" size="sm" render={<Link href={isDraft ? `/company/opportunities/${opportunityId}/setup` : `/company/opportunities/${opportunityId}?tab=challenge`} />} nativeButton={false}>
        <ArrowLeft className="size-3.5" /> {isDraft ? "Back to internship review" : "Back to internship"}
      </Button>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Attached challenge</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-navy">{role}</h1>
        <p className="mt-1 text-sm text-navy/55">{isDraft ? "Edit the same attached challenge. The internship remains a draft." : "Approve and publish a new version for future starts. Students who already started retain their assigned version."}</p>
      </div>
      <div className="mt-5">
        <ChallengeBuilder
          challenge={challenge}
          onChange={setChallenge}
          opportunityId={opportunityId}
          reviewMode={isDraft}
        />
      </div>
    </div>
  );
}
