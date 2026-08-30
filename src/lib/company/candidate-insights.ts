import type { CandidateDetail } from "@/lib/company/candidate-detail-data";

type TaskProgress = { completed: number; total: number };

export type CandidateInsight = {
  label: string;
  value?: string;
};

export type CandidateAssistiveSummary = {
  summary: string;
  strength: string;
  watchFor: string;
};

function parsedTaskProgress(detail: CandidateDetail): TaskProgress | null {
  const match = detail.evidence?.tasksCompleted.match(/\b(\d+)\s*(?:\/|of)\s*(\d+)\b/i);
  if (!match) return null;

  const completed = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0 || completed > total) return null;
  return { completed, total };
}

/** Only expose progress when the evidence total agrees with the real challenge. */
function verifiedTaskProgress(detail: CandidateDetail): TaskProgress | null {
  const progress = parsedTaskProgress(detail);
  const expectedTotal = detail.challenge?.tasks.length ?? 0;
  if (!progress || expectedTotal === 0 || progress.total !== expectedTotal) return null;
  return progress;
}

function relevantSkills(detail: CandidateDetail): string[] {
  if (!detail.profile || !detail.challenge) return [];
  const challengeSkills = new Set(detail.challenge.skills.map((skill) => skill.trim().toLowerCase()));
  const seen = new Set<string>();

  return detail.profile.skills.filter((skill) => {
    const normalized = skill.trim().toLowerCase();
    if (!normalized || !challengeSkills.has(normalized) || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function submissionDuration(detail: CandidateDetail): string | null {
  if (!detail.submission) return null;
  const elapsedMinutes = Math.floor((detail.submission.submittedAt.getTime() - detail.appliedAt.getTime()) / 60_000);
  if (elapsedMinutes < 0) return null;

  const days = Math.floor(elapsedMinutes / 1_440);
  const hours = Math.floor((elapsedMinutes % 1_440) / 60);
  const minutes = elapsedMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Every insight traces to current stored data and contains no fit judgment. */
export function candidateInsights(detail: CandidateDetail): CandidateInsight[] {
  const insights: CandidateInsight[] = [];
  const progress = verifiedTaskProgress(detail);
  const duration = submissionDuration(detail);
  const skills = relevantSkills(detail);
  const deliverableCount = detail.challenge?.deliverables.length ?? 0;

  if (skills.length > 0) insights.push({ label: "Relevant skills", value: skills.join(" · ") });
  if (progress) insights.push({ label: `Completed ${progress.completed}/${progress.total} tasks` });
  if (duration) insights.push({ label: `Submitted in ${duration}` });
  if (detail.profile?.availability?.trim()) insights.push({ label: `${detail.profile.availability.trim()} availability` });
  if (deliverableCount > 0) insights.push({ label: `${deliverableCount} challenge ${pluralize(deliverableCount, "deliverable")}` });

  return insights;
}

/**
 * Build the assistive summary from the same verified current facts as Quick
 * Insights. Stale free-form AI fields are deliberately not rendered.
 */
export function candidateAssistiveSummary(detail: CandidateDetail): CandidateAssistiveSummary | null {
  if (!detail.submission || !detail.challenge || !detail.evidence) return null;

  const progress = verifiedTaskProgress(detail);
  const skills = relevantSkills(detail);
  const fileCount = detail.submission.artifacts.length;
  const hasWrittenNotes = detail.submission.notes.trim().length > 0;

  if (!progress || (fileCount === 0 && !hasWrittenNotes)) return null;

  const facts = [
    `Recorded evidence shows ${progress.completed}/${progress.total} challenge tasks completed.`,
    fileCount > 0
      ? `The submission includes ${fileCount} ${pluralize(fileCount, "file")}.`
      : "The submission contains written notes and no uploaded files.",
  ];
  if (skills.length > 0) facts.push(`${skills.length} profile ${pluralize(skills.length, "skill")} match the challenge requirements.`);

  const strength = skills.length > 0
    ? `${skills.join(", ")} align with the challenge requirements.`
    : progress.completed === progress.total
      ? `Recorded evidence shows all ${progress.total} challenge tasks completed.`
      : fileCount > 0
        ? `${fileCount} submitted ${pluralize(fileCount, "file")} are available for review.`
        : "Written submission notes are available for review.";

  const watchFor = progress.completed < progress.total
    ? `Recorded evidence shows ${progress.completed}/${progress.total} challenge tasks completed.`
    : fileCount === 0
      ? "No files were uploaded. Review the written notes against the challenge requirements."
      : "Review the submitted evidence against the challenge rubric before deciding.";

  return { summary: facts.join(" "), strength, watchFor };
}
