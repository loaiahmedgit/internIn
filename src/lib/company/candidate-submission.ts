/**
 * "Submission" column text — replaces the old vague "Evidence" column.
 * Built only from what's actually verifiable: whether a CV is on file
 * (student_profiles.cv_url) and how many files came with the challenge
 * submission (submissions.artifacts). Never invents a "Portfolio" category —
 * internIn has no separate portfolio-upload concept, only named files.
 */
export function summarizeSubmission({
  hasCv,
  hasSubmission,
  artifactCount,
}: {
  hasCv: boolean;
  hasSubmission: boolean;
  artifactCount: number;
}): string {
  if (!hasCv && !hasSubmission) return "Not submitted";
  if (hasCv && !hasSubmission) return "CV only";
  if (!hasCv && hasSubmission) return artifactCount > 0 ? `Challenge + ${artifactCount} file${artifactCount === 1 ? "" : "s"}` : "Challenge only";
  // hasCv && hasSubmission
  if (artifactCount > 1) return `CV + ${artifactCount} files`;
  return "CV + challenge";
}
