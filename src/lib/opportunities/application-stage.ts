/**
 * Named hiring-funnel stages shown instead of a percentage — percentages are
 * reserved for things with real measurable completion (challenge tasks,
 * profile completion). "Interview" has no dedicated status in the schema
 * (the real pipeline is applied -> shortlisted -> invited/offer); it is kept
 * as a funnel milestone that reads as passed once an offer exists, the same
 * way a shipping tracker shows a step it can't independently confirm.
 */
export const APPLICATION_STAGES = ["Applied", "Challenge", "Under review", "Interview", "Offer"] as const;

export function getApplicationStageIndex(params: {
  status: string;
  hasSubmission: boolean;
  hasOffer: boolean;
}): number {
  if (params.hasOffer || params.status === "invited") return 4;
  if (params.status === "shortlisted") return 2;
  if (params.hasSubmission) return 1;
  return 0;
}
