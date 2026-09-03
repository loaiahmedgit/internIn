import Link from "next/link";
import { BadgeCheck, Zap, ArrowRight, CalendarClock, Clock3, MapPin, Monitor } from "lucide-react";
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
    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-sm font-semibold text-teal-ink">
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
        <Link href={`/student/opportunities?opportunity=${opportunityId}`} className={primaryCtaClass}>
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
      return "Applied. Challenge not started";
    case "in_progress":
      return "Challenge in progress";
    case "submitted":
      return "Submitted. Awaiting company review";
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
  compact = false,
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
  /** Discovery-preview sizing (Home's Recommended grid): drops the
   * description line and tightens padding/gaps. The full opportunity
   * detail lives one click away — a preview card doesn't need to repeat
   * it, only scan fast. Explore's own list uses ExploreOpportunityCard,
   * not this prop. */
  compact?: boolean;
}) {
  const challengeRequired = challengeState.kind !== "unavailable";
  const status = statusLine(challengeState);
  const tier = typeof matchScore === "number" ? matchTier(matchScore) : null;

  return (
    <article
      className={cn(
        "rounded-xl border border-navy/10 bg-white transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-teal/25 hover:shadow-[0_14px_36px_rgba(33,50,72,0.07)]",
        compact ? "p-4" : "p-5 sm:p-6",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <CompanyAvatar name={opportunity.companyName} />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className="truncate text-xs font-medium text-navy/60">{opportunity.companyName}</p>
              {opportunity.companyVerified && (
                <BadgeCheck className="size-3.5 shrink-0 text-teal-ink" aria-label="Verified company" />
              )}
            </div>
            <Link
              href={`/opportunities/${opportunity.id}`}
              className={cn(
                "block font-semibold tracking-[-0.015em] text-navy hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40",
                compact ? "mt-0.5 text-base" : "mt-1 text-lg",
              )}
            >
              {opportunity.role}
            </Link>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {tier && !compact && (
            <span className="rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal-ink">
              {MATCH_TIER_LABEL[tier]}
            </span>
          )}
          <SaveButton opportunityId={opportunity.id} initialSaved={saved} />
        </div>
      </div>

      {!compact && opportunity.description && (
        <p className="mt-3 line-clamp-2 text-sm text-navy/60">{teaser(opportunity.description)}</p>
      )}

      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-navy/58", compact ? "mt-2.5" : "mt-4")}>
        <span className="flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden="true" />{opportunity.location}</span>
        {opportunity.workMode && (
          <span className="flex items-center gap-1.5"><Monitor className="size-3.5" aria-hidden="true" />{WORK_MODE_LABEL[opportunity.workMode]}</span>
        )}
        <span className="flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden="true" />{opportunity.duration}</span>
        <span>{opportunity.hoursPerWeek}h/week</span>
        {!compact && opportunity.applicationDeadline && (
          <span className="flex items-center gap-1">
            <CalendarClock className="size-3.5" aria-hidden="true" />
            Deadline {formatDeadline(opportunity.applicationDeadline)}
          </span>
        )}
      </div>

      {skills.length > 0 && (
        <div className={cn("flex flex-wrap gap-1.5", compact ? "mt-2.5" : "mt-3")}>
          {skills.slice(0, compact ? 3 : 4).map((s) => (
            <span key={s} className="rounded-full border border-navy/7 bg-[#f6f8f9] px-2.5 py-1 text-xs text-navy/58">
              {s}
            </span>
          ))}
        </div>
      )}

      <div className={cn("flex items-center justify-between gap-3 border-t border-navy/8", compact ? "mt-3 pt-3" : "mt-5 pt-4")}>
        <div className="min-w-0">
          {challengeRequired && (
            <div className="flex items-center gap-1.5 text-sm font-medium text-teal-ink">
              <Zap className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">
                Work challenge{typeof estimatedMinutes === "number" ? `, about ${estimatedMinutes} min` : ""}
              </span>
            </div>
          )}
          {!compact && status && <p className="mt-1 truncate text-xs text-navy/50">{status}</p>}
        </div>
        <ChallengeCta state={challengeState} opportunityId={opportunity.id} />
      </div>
    </article>
  );
}
