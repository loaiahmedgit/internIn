import type { CandidateDetail } from "./candidate-detail-data";

export type CandidateInsight = { label: string; value?: string };
export function submissionDurationMinutes(
  detail: CandidateDetail,
): number | null {
  if (!detail.submission || !detail.challengeStartedAt) return null;
  const minutes = Math.floor(
    (detail.submission.submittedAt.getTime() -
      detail.challengeStartedAt.getTime()) /
      60_000,
  );
  return minutes >= 0 ? minutes : null;
}
export function formatSubmissionDuration(minutes: number) {
  return minutes < 1
    ? "under 1m"
    : minutes < 60
      ? `${minutes}m`
      : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
export function relevantSkills(detail: CandidateDetail): string[] {
  const requirements = new Set(
    (detail.requirements?.skills ?? detail.challenge?.skills ?? []).map((s) =>
      s.trim().toLowerCase(),
    ),
  );
  return [...new Set(detail.profile?.skills ?? [])].filter((s) =>
    requirements.has(s.trim().toLowerCase()),
  );
}
/** Submission existence and legacy seeded task counts are not task-completion evidence. */
export function candidateInsights(detail: CandidateDetail): CandidateInsight[] {
  const insights: CandidateInsight[] = [];
  const skills = relevantSkills(detail);
  if (skills.length)
    insights.push({
      label: "Relevant skills",
      value: `${skills.join(" · ")} (profile)`,
    });
  const minutes = submissionDurationMinutes(detail);
  if (minutes !== null)
    insights.push({
      label: `Submitted in ${formatSubmissionDuration(minutes)}`,
    });
  if (detail.profile?.availability?.trim())
    insights.push({
      label: `${detail.profile.availability.trim()} availability`,
    });
  // Real per-artifact rows (every submission made after the P0 rewrite)
  // take priority — the legacy jsonb only ever has data for pre-rewrite rows.
  const count = detail.submission
    ? detail.submission.submissionArtifacts.length || detail.submission.artifacts.length
    : 0;
  if (count)
    insights.push({
      label: `${count} submitted ${count === 1 ? "file" : "files"}`,
    });
  return insights;
}
export function candidateSummaryUnavailableMessage(detail: CandidateDetail) {
  if (detail.submission?.submissionArtifacts.length || detail.submission?.artifacts.length)
    return "Submission files are available, but there is not enough evaluated evidence yet to generate a reliable summary.";
  if (detail.submission?.notes.trim())
    return "A written submission is available, but there is not enough evaluated evidence yet to generate a reliable summary.";
  return "No readable submission content is available yet. Uploaded materials remain available for human review.";
}
