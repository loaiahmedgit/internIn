import type { CandidateRow } from "@/lib/company/candidates-data";

/**
 * The single source of truth for "which of the 4 pipeline stages is this
 * candidate in" — used by the tab counts, the summary cards, the table's
 * Stage badge, and the profile page, so they can never drift into
 * disagreeing with each other. Declined and withdrawn are deliberately
 * collapsed into one archived "not_selected" bucket — two negative-outcome stages
 * in the tab bar is exactly the confusing extra-stage clutter product
 * wants gone; the underlying status stays distinct in the database for
 * anything (like Restore to review) that needs it.
 */
export function stageKeyOf(row: Pick<CandidateRow, "status" | "hasSubmission">): string {
  if (row.status === "applied" && row.hasSubmission) return "to_review";
  if (row.status === "declined" || row.status === "withdrawn") return "not_selected";
  return row.status;
}

export const STAGE_LABEL: Record<string, string> = {
  applied: "Awaiting submission",
  to_review: "To review",
  shortlisted: "Shortlisted",
  invited: "Offer sent",
  not_selected: "Rejected",
};

// One hue per stage, reused verbatim for the stage badge (table + profile)
// AND the matching summary-card icon color — see STAGE_ICON_COLOR below and
// SUMMARY_META in candidates/page.tsx. Never invent a second recipe for the
// same stage.
export const STAGE_CLASS: Record<string, string> = {
  to_review: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  shortlisted: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  invited: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  not_selected: "bg-red-500/10 text-red-700 dark:text-red-400",
};

/** Plain icon color (no fill/background) for the same stages — see the summary-card icon rule: colored icon only, never a filled badge behind it. */
export const STAGE_ICON_COLOR: Record<string, string> = {
  to_review: "text-blue-600",
  shortlisted: "text-amber-600",
  invited: "text-emerald-600",
  not_selected: "text-red-600",
};
