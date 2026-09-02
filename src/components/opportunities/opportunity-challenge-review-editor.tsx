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
}: {
  opportunityId: string;
  role: string;
  initialChallenge: Challenge;
}) {
  const [challenge, setChallenge] = useState(initialChallenge);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 sm:py-10">
      <Button variant="ghost" size="sm" render={<Link href={`/company/opportunities/${opportunityId}/setup`} />} nativeButton={false}>
        <ArrowLeft className="size-3.5" /> Back to internship review
      </Button>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Attached challenge</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-navy">{role}</h1>
        <p className="mt-1 text-sm text-navy/55">Edit the same attached challenge. The internship remains a draft.</p>
      </div>
      <div className="mt-5">
        <ChallengeBuilder
          challenge={challenge}
          onChange={setChallenge}
          opportunityId={opportunityId}
          reviewMode
        />
      </div>
    </div>
  );
}
