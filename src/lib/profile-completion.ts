interface ProfileCompletionFields {
  educationStage: string | null;
  university: string | null;
  major: string | null;
  graduationYear: number | null;
  location: string | null;
  skills: string[];
  interests: string[];
  cvFileKey: string | null;
}

const CHECKS: { key: keyof ProfileCompletionFields; label: string }[] = [
  { key: "educationStage", label: "Education stage" },
  { key: "university", label: "University or school" },
  { key: "major", label: "Major or field of study" },
  { key: "graduationYear", label: "Expected graduation" },
  { key: "location", label: "Location" },
  { key: "skills", label: "Skills" },
  { key: "interests", label: "Interests" },
  { key: "cvFileKey", label: "CV" },
];

export function getProfileCompletion(profile: ProfileCompletionFields | undefined) {
  if (!profile) return { percent: 0, missing: CHECKS.map((c) => c.label) };

  const missing: string[] = [];
  let filled = 0;
  for (const check of CHECKS) {
    const value = profile[check.key];
    const isFilled = Array.isArray(value) ? value.length > 0 : Boolean(value);
    if (isFilled) filled += 1;
    else missing.push(check.label);
  }

  return { percent: Math.round((filled / CHECKS.length) * 100), missing };
}
