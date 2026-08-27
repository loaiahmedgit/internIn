/**
 * Shared across the Home dashboard, /student/opportunities, and
 * /student/challenges so the same opportunity never shows a different
 * challenge state depending on which page rendered it.
 */
export type ChallengeState =
  | { kind: "unavailable" }
  | { kind: "not_started" }
  | { kind: "in_progress"; applicationId: string }
  | { kind: "submitted"; applicationId: string }
  | { kind: "reviewed"; applicationId: string };

export function getChallengeState(params: {
  challengePublished: boolean;
  application?: { id: string };
  submission?: { status: string };
}): ChallengeState {
  if (!params.challengePublished) return { kind: "unavailable" };
  if (!params.application) return { kind: "not_started" };
  if (!params.submission) return { kind: "in_progress", applicationId: params.application.id };
  if (params.submission.status === "reviewed") {
    return { kind: "reviewed", applicationId: params.application.id };
  }
  return { kind: "submitted", applicationId: params.application.id };
}
