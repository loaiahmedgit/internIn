import { APPLICATION_STAGES, getApplicationStageIndex } from "@/lib/opportunities/application-stage";
import { applicationStage, APPLICATION_STAGE_BADGE_CLASS, APPLICATION_STAGE_LABEL } from "@/lib/opportunities/application-status";

/**
 * The application's real hiring funnel, shown as named stages rather than a
 * percentage — percentages are reserved for things with real measurable
 * completion (challenge tasks, profile fields), not for a hiring pipeline.
 *
 * The closed state renders the SAME label/class constants the list badge
 * uses (via the shared applicationStage() function) instead of the raw
 * capitalized status string — previously this showed "declined"/"withdrawn"
 * here while the badge said "Closed" on the same card, a real contradiction.
 */
export function StatusRail({
  status,
  hasSubmission = false,
  challengeStarted = false,
  offerStatus,
}: {
  status: string;
  hasSubmission?: boolean;
  challengeStarted?: boolean;
  offerStatus?: string;
}) {
  const stage = applicationStage({ status, hasSubmission, challengeStarted, offerStatus });

  if (stage === "closed") {
    return (
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${APPLICATION_STAGE_BADGE_CLASS.closed}`}>
        {APPLICATION_STAGE_LABEL.closed}
      </span>
    );
  }

  const hasOffer = stage === "offer_pending" || stage === "offer_accepted";
  const current = getApplicationStageIndex({ status, hasSubmission, hasOffer });

  return (
    <div className="flex flex-wrap items-center gap-y-1.5">
      {APPLICATION_STAGES.map((label, i) => (
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
          {i < APPLICATION_STAGES.length - 1 && <span className="h-px w-4 bg-gray-cool" aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}
