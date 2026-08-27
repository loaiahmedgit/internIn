export type EducationStage = "high_school" | "university" | "graduate" | "vocational" | "other";

export const STAGE_OPTIONS: { value: EducationStage; label: string }[] = [
  { value: "high_school", label: "High school student" },
  { value: "university", label: "University / college student" },
  { value: "graduate", label: "Recent graduate" },
  { value: "vocational", label: "Diploma / vocational student" },
  { value: "other", label: "Other" },
];
