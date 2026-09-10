import { z } from "zod";

export const EligibilityRequirementSchema = z.object({
  field: z.enum(["study_field", "education_level", "certification"]),
  acceptedValues: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
}).strict();
export const EligibilityRequirementsSchema = z.array(EligibilityRequirementSchema).max(12);
export type EligibilityRequirement = z.infer<typeof EligibilityRequirementSchema>;
export const ELIGIBILITY_FIELD_LABEL: Record<EligibilityRequirement["field"], string> = {
  study_field: "Study field / major",
  education_level: "Education credential level",
  certification: "Certification",
};

type ProfileFacts = {
  major?: string | null;
  education: { fieldOfStudy: string | null; level: string | null }[];
  certifications: { name: string; expiryDate: string | null }[];
};
const normalize = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");

/** Exact normalized matching against company-authored alternatives. No AI,
 * occupation inference, fuzzy matches, or claim of document verification. */
export function evaluateEligibility(requirements: EligibilityRequirement[], facts: ProfileFacts, today = new Date().toISOString().slice(0, 10)) {
  return requirements.map((requirement) => {
    const values = requirement.field === "study_field"
      ? [facts.major, ...facts.education.map((entry) => entry.fieldOfStudy)]
      : requirement.field === "education_level"
        ? facts.education.map((entry) => entry.level)
        : facts.certifications.filter((entry) => !entry.expiryDate || (/^\d{4}-\d{2}-\d{2}$/.test(entry.expiryDate) && entry.expiryDate >= today)).map((entry) => entry.name);
    const normalized = new Set(values.filter((value): value is string => Boolean(value)).map(normalize));
    return {
      requirement: `${ELIGIBILITY_FIELD_LABEL[requirement.field]}: ${requirement.acceptedValues.join(" or ")}`,
      met: requirement.acceptedValues.some((value) => normalized.has(normalize(value))),
      basis: "Profile-declared information; documents not independently verified" as const,
    };
  });
}

/** Reuses existing employer-authored questions. Historical postings without
 * questions receive a brief role-context exercise, with human review only. */
export function baselineQuestions(role: string, questions: string[]) {
  if (questions.length) return questions;
  return [
    `As a ${role}, you receive two tasks with the same deadline and cannot finish both. Write a short message asking your supervisor to clarify priorities, and explain what you would do while waiting.`,
    `Before handing in a small piece of work as a ${role}, you notice information is missing. Describe one realistic example, how you would check it, and when you would ask for help.`,
  ];
}

export const BaselineAnswersSchema = z.array(z.string().trim().min(1).max(3000)).max(10);
export type ApplicationEntryEvidence = {
  answers: { question: string; response: string }[];
  eligibility: ReturnType<typeof evaluateEligibility>;
};

export function captureBaselineEvidence(questions: string[], input: unknown) {
  const answers = BaselineAnswersSchema.parse(input);
  if (answers.length !== questions.length) throw new Error("Answer each short work question before applying.");
  return questions.map((question, index) => ({ question, response: answers[index] }));
}
