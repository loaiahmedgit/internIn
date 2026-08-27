/**
 * Shared across the Home dashboard, /student/opportunities, and
 * /student/challenges so the same opportunity never shows a different
 * challenge state depending on which page rendered it.
 *
 * "not_started" means the student hasn't applied — it should only ever be
 * used on discovery surfaces (Home recommendations, /student/opportunities),
 * never on /student/challenges, which only lists opportunities the student
 * has actually applied to. "to_do" vs "in_progress" is real: it's driven by
 * applications.challengeStartedAt, set only when the student explicitly
 * clicks "Start challenge" — never inferred from a page view.
 */
export type ChallengeState =
  | { kind: "unavailable" }
  | { kind: "not_started" }
  | { kind: "to_do"; applicationId: string }
  | { kind: "in_progress"; applicationId: string }
  | { kind: "submitted"; applicationId: string }
  | { kind: "completed"; applicationId: string };

export function getChallengeState(params: {
  challengePublished: boolean;
  application?: { id: string; challengeStartedAt: Date | null };
  submission?: { hasEvidence: boolean };
}): ChallengeState {
  if (!params.challengePublished) return { kind: "unavailable" };
  if (!params.application) return { kind: "not_started" };
  if (!params.submission) {
    return params.application.challengeStartedAt
      ? { kind: "in_progress", applicationId: params.application.id }
      : { kind: "to_do", applicationId: params.application.id };
  }
  return params.submission.hasEvidence
    ? { kind: "completed", applicationId: params.application.id }
    : { kind: "submitted", applicationId: params.application.id };
}
