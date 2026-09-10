import { getApplicationStages, getApplicationStageIndex } from "@/lib/opportunities/application-stage";
import { applicationStage, APPLICATION_STAGE_BADGE_CLASS, APPLICATION_STAGE_LABEL, challengeState, CHALLENGE_STATE_BADGE_CLASS, CHALLENGE_STATE_LABEL } from "@/lib/opportunities/application-status";
import type { ApplicationMode } from "@/lib/opportunities/application-mode";

/**
 * The application's real hiring funnel, shown as named stages rather than a
 * percentage — percentages are reserved for things with real measurable
 * completion (challenge tasks, profile fields), not for a hiring pipeline.
 *
 * The closed state renders the SAME label/class constants the list badge
 * uses (via the shared applicationStage() function) instead of the raw
 * capitalized status string — previously this showed "declined"/"withdrawn"
 * here while the badge said "Closed" on the same card, a real contradiction.
 *
 * R2 §12 — Challenge state is a separate row from the funnel, mode-aware,
 * and never rendered at all for quick_apply (challengeState() returns null).
 */
export function StatusRail({
  status,
  applicationMode,
  hasSubmission = false,
  challengeStarted = false,
  offerStatus,
}: {
  status: string;
  applicationMode: ApplicationMode;
  hasSubmission?: boolean;
  challengeStarted?: boolean;
  offerStatus?: string;
}) {
  const stage = applicationStage({ status, hasSubmission, offerStatus });
  const challenge = challengeState({ applicationMode, hasSubmission, challengeStarted });

  if (stage === "closed") {
    return (
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${APPLICATION_STAGE_BADGE_CLASS.closed}`}>
        {APPLICATION_STAGE_LABEL.closed}
      </span>
    );
  }

  const hasOffer = stage === "offer_pending" || stage === "offer_accepted";
  const stages = getApplicationStages(applicationMode);
  const current = getApplicationStageIndex({ status, hasSubmission, hasOffer, applicationMode });

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-y-1.5">
        {stages.map((label, i) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="flex items-center gap-1">
              <span
                className={`size-1.5 rounded-full ${i <= current ? "bg-teal" : "bg-gray-cool"}`}
                aria-hidden="true"
              />
              <span className={`text-xs font-medium ${i === current ? "text-teal-ink" : "text-navy/40"}`}>
                {label}
              </span>
            </div>
            {i < stages.length - 1 && <span className="h-px w-4 bg-gray-cool" aria-hidden="true" />}
          </div>
        ))}
      </div>
      {challenge && (
        <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${CHALLENGE_STATE_BADGE_CLASS[challenge]}`}>
          {CHALLENGE_STATE_LABEL[challenge]}
        </span>
      )}
    </div>
  );
}
