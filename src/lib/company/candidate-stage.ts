import type { CandidateRow } from "@/lib/company/candidates-data";

/**
 * The single source of truth for "which of the 4 stages is this candidate
 * in" — used by the tab counts, the table's Stage badge, and the drawer, so
 * they can never drift into disagreeing with each other.
 */
export function stageKeyOf(row: Pick<CandidateRow, "status" | "hasSubmission">): string {
  if (row.status === "applied" && row.hasSubmission) return "to_review";
  return row.status;
}

export const STAGE_LABEL: Record<string, string> = {
  applied: "Awaiting submission",
  to_review: "To review",
  shortlisted: "Shortlisted",
  invited: "Offer sent",
  declined: "Not selected",
  withdrawn: "Withdrawn",
};

// Neutral gray (no override, secondary variant's own color) for anything
// pre-review or terminal; blue for shortlisted; teal for offer sent — matches
// the "soft blue / soft green-teal / neutral gray" spec exactly, and must
// stay identical everywhere a stage is shown (summary cards, table badge,
// profile badge) — see candidates/page.tsx's SUMMARY array.
export const STAGE_CLASS: Record<string, string> = {
  shortlisted: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  invited: "bg-teal/10 text-teal-ink",
};
