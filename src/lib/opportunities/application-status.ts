/**
 * The single source of truth for a student-facing application's display
 * stage — mirrors the company side's own stated rationale in
 * candidate-stage.ts ("so they can never drift into disagreeing with each
 * other"). Both the list badge and StatusRail call this same function with
 * the same inputs, so they cannot show contradictory text for one card.
 *
 * Derived strictly from real write paths (verified against every
 * `.set({ status: ... })` in student-actions.ts / actions.ts before writing
 * this): applications.status only ever becomes "applied" (default, and also
 * the value moveApplicationToReviewAction restores it to), "shortlisted",
 * "invited" (always set in the same transaction that creates the
 * internshipOffer row — never invited without an offer), or "declined"
 * (company decline, or student declining an offer). "withdrawn" is a real
 * schema value with no current write path — handled defensively, not
 * invented as a live state.
 *
 * Offer status is checked ahead of applications.status for the open states
 * (pending/accepted), but NOT for "closed" — closed is driven by
 * applications.status alone, matching candidate-stage.ts's own pattern.
 * Using a stale declined offerStatus for "closed" was the actual bug: after
 * moveApplicationToReviewAction restores status to "applied" (keeping the
 * old declined offer for audit), a stale-offerStatus check would still show
 * "Closed" for an application the company just reopened.
 */
export type ApplicationStage =
  | "not_started"
  | "in_progress"
  | "under_review"
  | "shortlisted"
  | "offer_pending"
  | "offer_accepted"
  | "closed";

export function applicationStage(params: {
  status: string;
  hasSubmission: boolean;
  challengeStarted: boolean;
  offerStatus?: string;
}): ApplicationStage {
  if (params.offerStatus === "accepted") return "offer_accepted";
  if (params.offerStatus === "pending" || params.status === "invited") return "offer_pending";
  if (params.status === "declined" || params.status === "withdrawn") return "closed";
  if (params.status === "shortlisted") return "shortlisted";
  if (params.hasSubmission) return "under_review";
  return params.challengeStarted ? "in_progress" : "not_started";
}

export const APPLICATION_STAGE_LABEL: Record<ApplicationStage, string> = {
  not_started: "Challenge to complete",
  in_progress: "Challenge in progress",
  under_review: "Under review",
  shortlisted: "Shortlisted",
  offer_pending: "Offer received",
  offer_accepted: "Offer accepted",
  closed: "Closed",
};

export const APPLICATION_STAGE_BADGE_CLASS: Record<ApplicationStage, string> = {
  not_started: "bg-amber-50 text-amber-700",
  in_progress: "bg-amber-50 text-amber-700",
  under_review: "bg-blue-50 text-blue-700",
  shortlisted: "bg-blue-50 text-blue-700",
  offer_pending: "bg-emerald-50 text-emerald-700",
  offer_accepted: "bg-teal/10 text-teal-ink",
  closed: "bg-red-50 text-red-700",
};

export function applicationCtaLabel(stage: ApplicationStage): string {
  switch (stage) {
    case "offer_pending":
      return "View offer";
    case "offer_accepted":
      return "Open workspace";
    case "closed":
      return "Open application";
    case "not_started":
      return "Complete challenge";
    case "in_progress":
      return "Continue challenge";
    default:
      return "Open application";
  }
}
