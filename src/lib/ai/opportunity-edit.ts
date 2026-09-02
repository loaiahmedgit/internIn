import { generateObject } from "ai";
import { z } from "zod";

import { getModel } from "./gemma-provider";
import { withGenerateRetries } from "./challenge-generation";

const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable();
const nullableDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Invalid calendar date")
  .nullable();

/** A flat, reviewable patch. Null always means "leave unchanged". The
 * model cannot publish, delete, close, or alter ownership through this
 * shape. Those state changes remain in their existing explicit flows. */
export const OpportunityEditPatchSchema = z.object({
  role: nullableText(120),
  department: nullableText(120),
  shortDescription: nullableText(500),
  description: nullableText(6000),
  whatYouWillLearn: nullableText(3000),
  requirements: z.array(z.string().trim().min(1).max(200)).max(20).nullable(),
  niceToHave: z.array(z.string().trim().min(1).max(200)).max(20).nullable(),
  duration: nullableText(80),
  hoursPerWeek: z.number().int().min(1).max(60).nullable(),
  location: nullableText(120),
  workMode: z.enum(["remote", "onsite", "hybrid"]).nullable(),
  applicationDeadline: nullableDate,
  startDate: nullableDate,
  slots: z.number().int().min(1).max(100).nullable(),
  skills: z.array(z.string().trim().min(1).max(60)).max(20).nullable(),
  requireCv: z.boolean().nullable(),
  applicationQuestions: z.array(z.string().trim().min(1).max(300)).max(10).nullable(),
});
export type OpportunityEditPatch = z.infer<typeof OpportunityEditPatchSchema>;

const EDIT_ATTEMPTS = [{ temperature: 0 }, { temperature: 0 }] as const;

export async function generateOpportunityEditPatch(params: {
  current: Record<string, unknown>;
  instruction: string;
}): Promise<OpportunityEditPatch> {
  return withGenerateRetries("generateOpportunityEditPatch", EDIT_ATTEMPTS, async ({ temperature }) => {
    const { object } = await generateObject({
      model: getModel(),
      schema: OpportunityEditPatchSchema,
      temperature,
      maxOutputTokens: 1200,
      abortSignal: AbortSignal.timeout(25_000),
      system: `Convert one explicit employer instruction into a minimal patch for an existing internship posting.

Return null for EVERY field the employer did not explicitly ask to change. Preserve wording and values unless the instruction changes them. Never infer company facts, dates, locations, requirements, or logistics. Never publish, close, delete, or duplicate the internship. Dates must be YYYY-MM-DD.`,
      prompt: `Current internship (trusted database values):\n${JSON.stringify(params.current)}\n\nEmployer instruction:\n${params.instruction}`,
    });
    return object;
  });
}

export function opportunityEditEntries(patch: OpportunityEditPatch): Array<{ field: keyof OpportunityEditPatch; value: NonNullable<OpportunityEditPatch[keyof OpportunityEditPatch]> }> {
  return Object.entries(patch)
    .filter((entry): entry is [keyof OpportunityEditPatch, NonNullable<OpportunityEditPatch[keyof OpportunityEditPatch]>] => entry[1] !== null)
    .map(([field, value]) => ({ field, value }));
}

const FIELD_LABELS: Record<keyof OpportunityEditPatch, string> = {
  role: "Title",
  department: "Department",
  shortDescription: "Short description",
  description: "Description",
  whatYouWillLearn: "What they'll learn",
  requirements: "Requirements",
  niceToHave: "Nice to have",
  duration: "Duration",
  hoursPerWeek: "Hours per week",
  location: "Location",
  workMode: "Work mode",
  applicationDeadline: "Application deadline",
  startDate: "Start date",
  slots: "Number of interns",
  skills: "Skills",
  requireCv: "CV requirement",
  applicationQuestions: "Application questions",
};

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (Array.isArray(value)) return value.join(", ") || "None";
  if (typeof value === "boolean") return value ? "Required" : "Not required";
  return String(value);
}

export function describeOpportunityEdit(patch: OpportunityEditPatch, current: Record<string, unknown>) {
  return opportunityEditEntries(patch).map(({ field, value }) => ({
    label: FIELD_LABELS[field],
    before: displayValue(current[field]),
    after: displayValue(value),
  }));
}
