import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { SaveButton } from "@/components/opportunities/save-button";
import type { ChallengeState } from "@/lib/opportunities/challenge-state";

function CompanyAvatar({ name }: { name: string }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal/10 text-sm font-semibold text-teal-ink">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function ChallengeCta({ state }: { state: ChallengeState }) {
  const buttonClass =
    "mt-3 block w-full rounded-lg border border-teal/30 px-3 py-2 text-center text-sm font-medium text-teal-ink transition-colors hover:bg-teal/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40";

  switch (state.kind) {
    case "unavailable":
      return null;
    case "not_started":
      return (
        <div className="mt-3 border-t border-navy/8 pt-3">
          <p className="text-xs font-medium text-navy/50">Not started</p>
        </div>
      );
    case "in_progress":
      return (
        <div className="mt-3 border-t border-navy/8 pt-3">
          <p className="text-xs font-semibold text-teal-ink">Challenge in progress</p>
          <Link href={`/student/applications/${state.applicationId}`} className={buttonClass}>
            Continue challenge
          </Link>
        </div>
      );
    case "submitted":
      return (
        <div className="mt-3 border-t border-navy/8 pt-3">
          <p className="text-xs font-semibold text-teal-ink">Submitted</p>
          <p className="text-xs text-navy/50">Awaiting review</p>
          <Link href={`/student/applications/${state.applicationId}`} className={buttonClass}>
            View application
          </Link>
        </div>
      );
    case "reviewed":
      return (
        <div className="mt-3 border-t border-navy/8 pt-3">
          <p className="text-xs font-semibold text-teal-ink">Reviewed</p>
          <Link href={`/student/applications/${state.applicationId}`} className={buttonClass}>
            View application
          </Link>
        </div>
      );
  }
}

export interface OpportunityCardData {
  id: string;
  role: string;
  companyName: string;
  companyVerified: boolean;
  duration: string;
  hoursPerWeek: number;
  location: string;
  skills: string[];
}

export function OpportunityCard({
  opportunity,
  saved,
  challengeState,
}: {
  opportunity: OpportunityCardData;
  saved: boolean;
  challengeState: ChallengeState;
}) {
  return (
    <div className="rounded-xl border border-navy/10 bg-white p-5 shadow-[0_1px_2px_rgba(33,50,72,0.04)] transition-shadow hover:shadow-[0_8px_24px_rgba(33,50,72,0.08)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <CompanyAvatar name={opportunity.companyName} />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className="truncate text-xs font-semibold uppercase tracking-wide text-navy/40">
                {opportunity.companyName}
              </p>
              {opportunity.companyVerified && (
                <BadgeCheck className="size-3.5 shrink-0 text-teal-ink" aria-label="Verified company" />
              )}
            </div>
            <Link
              href={`/opportunities/${opportunity.id}`}
              className="mt-1 block text-base font-semibold text-navy hover:text-teal-ink focus-visible:outline-none focus-visible:underline"
            >
              {opportunity.role}
            </Link>
          </div>
        </div>
        <SaveButton opportunityId={opportunity.id} initialSaved={saved} />
      </div>

      <p className="mt-3 text-sm text-navy/68">
        {opportunity.duration} · {opportunity.hoursPerWeek}h/week · {opportunity.location}
      </p>

      {opportunity.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {opportunity.skills.slice(0, 3).map((s) => (
            <span key={s} className="rounded-full bg-gray-light px-2 py-0.5 text-xs text-navy/60">
              {s}
            </span>
          ))}
        </div>
      )}

      <ChallengeCta state={challengeState} />
    </div>
  );
}
