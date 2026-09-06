/**
 * Credential level for one Education entry (student_education.level) —
 * deliberately separate from education-stages.ts's STAGE_OPTIONS, which
 * describes the student's overall PROFILE stage ("Recent graduate" etc.),
 * not a specific credential. An education entry needs real degree/
 * credential levels instead.
 */
export const EDUCATION_CREDENTIAL_LEVELS = [
  { value: "secondary", label: "Secondary / High school" },
  { value: "vocational", label: "Diploma / Vocational" },
  { value: "associate", label: "Associate" },
  { value: "bachelors", label: "Bachelor's" },
  { value: "masters", label: "Master's" },
  { value: "doctorate", label: "Doctorate" },
  { value: "other", label: "Other" },
] as const;

export type EducationCredentialLevel = (typeof EDUCATION_CREDENTIAL_LEVELS)[number]["value"];

export function credentialLevelLabel(value: string): string | null {
  return EDUCATION_CREDENTIAL_LEVELS.find((option) => option.value === value)?.label ?? null;
}

/** True when `level` is a real value produced by an older schema
 * (education_stage enum slugs: high_school/university/graduate/vocational/
 * other) that doesn't exact-match one of the new credential values above —
 * used to render a "Previous value" note instead of silently hiding or
 * misrepresenting the entry. */
export function isLegacyCredentialLevel(value: string | null): boolean {
  if (!value) return false;
  return !EDUCATION_CREDENTIAL_LEVELS.some((option) => option.value === value);
}

const LEGACY_LEVEL_DISPLAY: Record<string, string> = {
  high_school: "High school student",
  university: "University / college student",
  graduate: "Recent graduate",
  vocational: "Diploma / vocational student",
  other: "Other",
};

export function legacyCredentialLevelDisplay(value: string): string {
  return LEGACY_LEVEL_DISPLAY[value] ?? value;
}
