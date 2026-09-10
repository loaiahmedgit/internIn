import { z } from "zod";

/**
 * R2 — one canonical, opportunity-wide application mode. Never a
 * per-candidate/per-application field, never client-supplied at apply time
 * (the student apply action never accepts this — it only ever reads the
 * real opportunity row). See schema.ts's applicationModeEnum comment.
 */
export const ApplicationModeSchema = z.enum(["quick_apply", "optional_challenge", "challenge_required"]);
export type ApplicationMode = z.infer<typeof ApplicationModeSchema>;

export const APPLICATION_MODE_LABEL: Record<ApplicationMode, string> = {
  quick_apply: "Quick Apply",
  optional_challenge: "Optional Challenge",
  challenge_required: "Challenge Required",
};

export const APPLICATION_MODE_COMPANY_DESCRIPTION: Record<ApplicationMode, string> = {
  quick_apply: "Apply with their internIn profile and brief work responses.",
  optional_challenge: "Students apply with their profile and brief work responses, then optionally complete a realistic Challenge to add demonstrated evidence.",
  challenge_required: "Students apply with their profile and brief work responses, and must submit the Challenge before their application can progress to shortlist or offer.",
};

/** Student-facing, shown on Explore before applying. */
export const APPLICATION_MODE_STUDENT_DESCRIPTION: Record<ApplicationMode, string> = {
  quick_apply: "Apply with your internIn profile and brief work responses. No additional Challenge.",
  optional_challenge: "Apply with your profile and brief work responses. The optional Challenge adds evidence.",
  challenge_required: "Apply with your profile and brief work responses, then complete the Challenge before your application can progress.",
};
