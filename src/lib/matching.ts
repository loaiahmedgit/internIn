/**
 * Smart Matching (docs/02): match % is guidance, never a gate. Nothing here
 * should ever block or filter what a student can apply to — only decides
 * display order and the badge shown on /opportunities.
 */
export function computeMatchScore(
  studentSkills: string[],
  studentInterests: string[],
  opportunitySkills: string[],
): number {
  if (opportunitySkills.length === 0) return 0;

  const studentTerms = new Set(
    [...studentSkills, ...studentInterests].map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
  if (studentTerms.size === 0) return 0;

  const matched = opportunitySkills.filter((skill) => studentTerms.has(skill.trim().toLowerCase())).length;
  return Math.round((matched / opportunitySkills.length) * 100);
}

/**
 * A qualitative compatibility cue only — never the raw percentage. Showing
 * "87%" reads as a fake success/hiring probability; "Strong match" /
 * "Good match" communicates the same signal without that false precision.
 */
export function matchTier(score: number): "strong" | "good" | null {
  if (score >= 70) return "strong";
  if (score >= 40) return "good";
  return null;
}
