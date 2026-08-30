import type { CandidateDetail } from "@/lib/company/candidate-detail-data";

/**
 * Real, derived, factual bullets only — never invented flattery like "Strong
 * academic background" or "Active & engaged" with no data behind it. Each
 * bullet here traces to an actual field; if nothing is derivable, the list
 * is empty and the section is skipped entirely.
 */
export function candidateInsights(detail: CandidateDetail): string[] {
  const insights: string[] = [];

  if (detail.profile && detail.challenge) {
    const challengeSkills = new Set(detail.challenge.skills.map((s) => s.toLowerCase()));
    const overlap = detail.profile.skills.filter((s) => challengeSkills.has(s.toLowerCase()));
    if (overlap.length > 0) insights.push(`Skills overlap with this challenge: ${overlap.join(", ")}`);
  }

  if (detail.evidence) {
    const match = detail.evidence.tasksCompleted.match(/^(\d+)\/(\d+)$/);
    if (match && match[1] === match[2] && Number(match[1]) > 0) {
      insights.push(`Completed all ${match[1]} tasks`);
    }
    if (detail.evidence.timeSpentMinutes > 0) {
      const hours = Math.floor(detail.evidence.timeSpentMinutes / 60);
      const minutes = detail.evidence.timeSpentMinutes % 60;
      const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      insights.push(`Submitted in ${duration}`);
    }
  }

  return insights;
}
