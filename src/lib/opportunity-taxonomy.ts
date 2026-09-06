/**
 * Career-field and opportunity-type option lists for student preferences.
 * Previously byte-identical duplicates in preferences-editor.tsx and
 * student-profile-form.tsx — consolidated here, both now import from this
 * single source. List content unchanged (not a taxonomy redesign).
 */
export const FIELD_OPTIONS = [
  "Software Engineering",
  "Data & Analytics",
  "Marketing",
  "Finance",
  "Design",
  "Business & Operations",
  "Sales",
  "Human Resources",
  "Research",
  "Product Management",
  "Customer Support",
] as const;

export const OPPORTUNITY_TYPE_OPTIONS = ["Internship", "Part-time", "Full-time", "Volunteer"] as const;
