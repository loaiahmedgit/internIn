import type { ApplicationMode } from "@/lib/opportunities/application-mode";

/**
 * Named hiring-funnel stages shown instead of a percentage — percentages are
 * reserved for things with real measurable completion (challenge tasks,
 * profile completion). "Interview" has no dedicated status in the schema
 * (the real pipeline is applied -> shortlisted -> invited/offer); it is kept
 * as a funnel milestone that reads as passed once an offer exists, the same
 * way a shipping tracker shows a step it can't independently confirm.
 *
 * R2 — a quick_apply opportunity has no Challenge step at all (never a
 * permanently-unreachable step sitting in the funnel); optional/required
 * both keep it, since a Challenge genuinely exists for that opportunity
 * either way — the two modes differ only in whether reaching later steps
 * requires it, never in whether the step itself is shown.
 */
export function getApplicationStages(applicationMode: ApplicationMode): readonly string[] {
  if (applicationMode === "quick_apply") return ["Applied", "Under review", "Interview", "Offer"];
  return ["Applied", "Challenge", "Under review", "Interview", "Offer"];
}

export function getApplicationStageIndex(params: {
  status: string;
  hasSubmission: boolean;
  hasOffer: boolean;
  applicationMode: ApplicationMode;
}): number {
  const hasChallengeStep = params.applicationMode !== "quick_apply";
  if (params.hasOffer || params.status === "invited") return hasChallengeStep ? 4 : 3;
  if (params.status === "shortlisted") return hasChallengeStep ? 2 : 1;
  if (hasChallengeStep && params.hasSubmission) return 1;
  return 0;
}
