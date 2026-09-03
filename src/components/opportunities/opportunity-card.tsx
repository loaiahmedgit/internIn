import Link from "next/link";
import { BadgeCheck, Zap, ArrowRight, CalendarClock } from "lucide-react";
import { SaveButton } from "@/components/opportunities/save-button";
import type { ChallengeState } from "@/lib/opportunities/challenge-state";
import { matchTier } from "@/lib/matching";
import { formatDeadline } from "@/lib/format-date";
import { cn } from "@/lib/utils";

const WORK_MODE_LABEL: Record<"remote" | "onsite" | "hybrid", string> = {
  remote: "Remote",
  onsite: "On-site",
  hybrid: "Hybrid",
};

const MATCH_TIER_LABEL: Record<"strong" | "good", string> = {
  strong: "Strong match",
  good: "Good match",
};

function CompanyAvatar({ name }: { name: string }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal/10 text-sm font-semibold text-teal-ink">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function teaser(description: string): string {
  const firstTwoSentences = description.split(/(?<=[.!?])\s/).slice(0, 2).join(" ").trim();
  if (firstTwoSentences.length <= 160) return firstTwoSentences;
  return `${firstTwoSentences.slice(0, 157).trim()}…`;
}

const primaryCtaClass =
  "inline-flex shrink-0 items-center gap-1 text-sm font-medium text-teal-ink hover:underline focus-visible:outline-none focus-visible:underline";

function ChallengeCta({ state, opportunityId }: { state: ChallengeState; opportunityId: string }) {
  switch (state.kind) {
    case "unavailable":
    case "not_started":
      return (
        <Link href={`/opportunities/${opportunityId}`} className={primaryCtaClass}>
          View opportunity
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      );
    case "to_do":
      return (
        <Link href={`/student/applications/${state.applicationId}`} className={primaryCtaClass}>
          Start challenge
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      );
    case "in_progress":
      return (
        <Link href={`/student/applications/${state.applicationId}`} className={primaryCtaClass}>
          Continue challenge
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      );
    case "submitted":
      return (
        <Link href={`/student/applications/${state.applicationId}`} className={primaryCtaClass}>
          View application
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      );
    case "completed":
      return (
        <Link href={`/student/applications/${state.applicationId}`} className={primaryCtaClass}>
          View application
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      );
  }
}

function statusLine(state: ChallengeState): string | undefined {
  switch (state.kind) {
    case "to_do":
      return "Applied — challenge not started";
    case "in_progress":
      return "Challenge in progress";
    case "submitted":
      return "Submitted — awaiting review, not a hiring decision yet";
    case "completed":
      return "Reviewed by the company";
    default:
      return undefined;
  }
}

export interface OpportunityCardData {
  id: string;
  role: string;
  description: string;
  companyName: string;
  companyVerified: boolean;
  duration: string;
  hoursPerWeek: number;
  location: string;
  /** Optional: only Explore/For You currently select these — a card still
   * renders correctly without them (e.g. from the Challenges page's
   * narrower query), just omitting the mode/deadline line. */
  workMode?: "remote" | "onsite" | "hybrid" | null;
  applicationDeadline?: Date | null;
}

export function OpportunityCard({
  opportunity,
  skills,
  saved,
  challengeState,
  estimatedMinutes,
  matchScore,
  className,
}: {
  opportunity: OpportunityCardData;
  skills: string[];
  saved: boolean;
  challengeState: ChallengeState;
  estimatedMinutes?: number;
  /** Skill/interest overlap against the opportunity, 0-100 — rendered as a
   * qualitative "Strong match"/"Good match" cue only, never the raw number
   * (a percentage reads as a fake hiring-probability claim). */
  matchScore?: number;
  className?: string;
}) {
  const challengeRequired = challengeState.kind !== "unavailable";
  const status = statusLine(challengeState);
  const tier = typeof matchScore === "number" ? matchTier(matchScore) : null;

  return (
    <div className={cn("rounded-xl border border-navy/10 bg-white p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <CompanyAvatar name={opportunity.companyName} />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className="truncate text-xs font-medium uppercase tracking-wide text-navy/45">{opportunity.companyName}</p>
              {opportunity.companyVerified && (
                <BadgeCheck className="size-3.5 shrink-0 text-teal-ink" aria-label="Verified company" />
              )}
            </div>
            <Link
              href={`/opportunities/${opportunity.id}`}
              className="mt-0.5 block text-lg font-semibold tracking-[-0.01em] text-navy hover:text-teal-ink focus-visible:outline-none focus-visible:underline"
            >
              {opportunity.role}
            </Link>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {tier && (
            <span className="rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal-ink">
              {MATCH_TIER_LABEL[tier]}
            </span>
          )}
          <SaveButton opportunityId={opportunity.id} initialSaved={saved} />
        </div>
      </div>

      {opportunity.description && <p className="mt-3 line-clamp-2 text-sm text-navy/60">{teaser(opportunity.description)}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-navy/60">
        <span>{opportunity.location}</span>
        {opportunity.workMode && (
          <>
            <span className="text-navy/25" aria-hidden="true">·</span>
            <span>{WORK_MODE_LABEL[opportunity.workMode]}</span>
          </>
        )}
        <span className="text-navy/25" aria-hidden="true">·</span>
        <span>{opportunity.duration}</span>
        <span className="text-navy/25" aria-hidden="true">·</span>
        <span>{opportunity.hoursPerWeek}h/week</span>
        {opportunity.applicationDeadline && (
          <span className="flex items-center gap-1">
            <span className="text-navy/25" aria-hidden="true">·</span>
            <CalendarClock className="size-3.5" aria-hidden="true" />
            Deadline {formatDeadline(opportunity.applicationDeadline)}
          </span>
        )}
      </div>

      {skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {skills.slice(0, 4).map((s) => (
            <span key={s} className="rounded-full bg-gray-light px-2.5 py-1 text-xs text-navy/60">
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-navy/8 pt-4">
        <div className="min-w-0">
          {challengeRequired && (
            <div className="flex items-center gap-1.5 text-sm font-medium text-teal-ink">
              <Zap className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">
                Work challenge{typeof estimatedMinutes === "number" ? ` · about ${estimatedMinutes} min` : ""}
              </span>
            </div>
          )}
          {status && <p className="mt-1 truncate text-xs text-navy/50">{status}</p>}
        </div>
        <ChallengeCta state={challengeState} opportunityId={opportunity.id} />
      </div>
    </div>
  );
}
