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
