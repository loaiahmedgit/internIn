import type { ApplicationMode } from "@/lib/opportunities/application-mode";

/**
 * The single source of truth for a student-facing application's display
 * stage — mirrors the company side's own stated rationale in
 * candidate-stage.ts ("so they can never drift into disagreeing with each
 * other"). Both the list badge and StatusRail call this same function with
 * the same inputs, so they cannot show contradictory text for one card.
 *
 * R2 §12 — hiring stage and Challenge state are deliberately two separate
 * concepts now. This function used to fold "no submission yet" into the
 * stage itself as "not_started"/"in_progress", labeled "Challenge to
 * complete" in an amber warning badge — correct for challenge_required, but
 * flat-out wrong for quick_apply (there is no challenge) and for
 * optional_challenge (not completing it is never a failure state). The
 * stage now only ever reflects the real hiring pipeline; use
 * challengeState() below for the separate, mode-aware Challenge row.
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
  | "applied"
  | "under_review"
  | "shortlisted"
  | "offer_pending"
  | "offer_accepted"
  | "closed";

export function applicationStage(params: {
  status: string;
  hasSubmission: boolean;
  offerStatus?: string;
}): ApplicationStage {
  if (params.offerStatus === "accepted") return "offer_accepted";
  if (params.offerStatus === "pending" || params.status === "invited") return "offer_pending";
  if (params.status === "declined" || params.status === "withdrawn") return "closed";
  if (params.status === "shortlisted") return "shortlisted";
  // A real submission is positive signal worth surfacing ("under review")
  // regardless of mode — this is never a penalty for NOT having one, it's
  // only ever reached when one genuinely exists.
  if (params.hasSubmission) return "under_review";
  return "applied";
}

export const APPLICATION_STAGE_LABEL: Record<ApplicationStage, string> = {
  applied: "Applied",
  under_review: "Under review",
  shortlisted: "Shortlisted",
  offer_pending: "Offer received",
  offer_accepted: "Offer accepted",
  closed: "Closed",
};

export const APPLICATION_STAGE_BADGE_CLASS: Record<ApplicationStage, string> = {
  applied: "bg-navy/6 text-navy/60",
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
    default:
      return "Open application";
  }
}

/**
 * R2 §8/§10/§11/§12 — the separate, mode-aware Challenge row. `null` means
 * "don't render a Challenge row at all" (quick_apply — there is nothing to
 * show, never a fake "No challenge required" clutter card per §20's
 * company-side equivalent). Optional-and-not-attempted is deliberately its
 * own neutral state, never conflated with the required-and-blocking one.
 */
export type ChallengeState = "optional_not_started" | "optional_in_progress" | "optional_submitted" | "required_not_started" | "required_in_progress" | "required_submitted";

export function challengeState(params: { applicationMode: ApplicationMode; hasSubmission: boolean; challengeStarted: boolean }): ChallengeState | null {
  if (params.applicationMode === "quick_apply") return null;
  const required = params.applicationMode === "challenge_required";
  if (params.hasSubmission) return required ? "required_submitted" : "optional_submitted";
  if (params.challengeStarted) return required ? "required_in_progress" : "optional_in_progress";
  return required ? "required_not_started" : "optional_not_started";
}

export const CHALLENGE_STATE_LABEL: Record<ChallengeState, string> = {
  optional_not_started: "Optional Challenge · Not attempted",
  optional_in_progress: "Optional Challenge · In progress",
  optional_submitted: "Optional Challenge · Submitted",
  required_not_started: "Required Challenge · Not started",
  required_in_progress: "Required Challenge · In progress",
  required_submitted: "Required Challenge · Submitted",
};

// Optional non-completion is always neutral (never amber/warning/red) —
// R2 §12's core requirement. required_not_started/in_progress use the same
// amber the old universal state used, but now correctly scoped to only the
// mode where it's a genuine blocker.
export const CHALLENGE_STATE_BADGE_CLASS: Record<ChallengeState, string> = {
  optional_not_started: "bg-navy/6 text-navy/55",
  optional_in_progress: "bg-blue-50 text-blue-700",
  optional_submitted: "bg-teal/10 text-teal-ink",
  required_not_started: "bg-amber-50 text-amber-700",
  required_in_progress: "bg-amber-50 text-amber-700",
  required_submitted: "bg-teal/10 text-teal-ink",
};

export function challengeCtaLabel(state: ChallengeState | null): string | null {
  switch (state) {
    case "required_not_started":
      return "Start required Challenge";
    case "required_in_progress":
      return "Continue required Challenge";
    case "optional_not_started":
      return "Show what you can do";
    case "optional_in_progress":
      return "Continue Challenge";
    default:
      return null;
  }
}
