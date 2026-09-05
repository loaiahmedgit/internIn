interface ProfileCompletionFields {
  educationStage: string | null;
  university: string | null;
  major: string | null;
  graduationYear: number | null;
  location: string | null;
  skills: string[];
  interests: string[];
  /** No longer weighted — see CHECKS' own comment. Kept optional so
   * existing callers (e.g. the dashboard checklist, which still shows its
   * own separate "Add CV" step) don't need to change their call shape. */
  cvFileKey?: string | null;
  bio?: string | null;
  experienceCount?: number;
  portfolioCount?: number;
}

/**
 * internIn is not CV-first (see docs/product principle): a student's
 * profile should be able to reach strong completion without ever touching
 * a CV, and verified work/portfolio/experience matter more than a resume
 * file. CV is deliberately absent from this checklist — it stays an
 * optional, secondary card on the profile regardless of this percentage.
 */
const CHECKS: { key: keyof ProfileCompletionFields; label: string; isFilled: (f: ProfileCompletionFields) => boolean }[] = [
  { key: "educationStage", label: "Education stage", isFilled: (f) => Boolean(f.educationStage) },
  { key: "university", label: "University or school", isFilled: (f) => Boolean(f.university) },
  { key: "major", label: "Major or field of study", isFilled: (f) => Boolean(f.major) },
  { key: "location", label: "Location", isFilled: (f) => Boolean(f.location) },
  { key: "bio", label: "About me", isFilled: (f) => Boolean(f.bio) },
  { key: "skills", label: "Skills", isFilled: (f) => f.skills.length > 0 },
  { key: "interests", label: "Interests", isFilled: (f) => f.interests.length > 0 },
  { key: "experienceCount", label: "Experience", isFilled: (f) => (f.experienceCount ?? 0) > 0 },
  { key: "portfolioCount", label: "Portfolio", isFilled: (f) => (f.portfolioCount ?? 0) > 0 },
];

export function getProfileCompletion(profile: ProfileCompletionFields | undefined) {
  if (!profile) return { percent: 0, missing: CHECKS.map((c) => c.label) };

  const missing: string[] = [];
  let filled = 0;
  for (const check of CHECKS) {
    if (check.isFilled(profile)) filled += 1;
    else missing.push(check.label);
  }

  return { percent: Math.round((filled / CHECKS.length) * 100), missing };
}
