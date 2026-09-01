/**
 * Shared with opportunity-from-challenge-actions.ts (a "use server" file,
 * which may only export async functions — plain helpers/constants live
 * here instead) and the setup page that reads them back.
 *
 * InternshipFormSchema requires duration/location non-empty and
 * hoursPerWeek >= 1 — a real empty marker isn't valid input there, so a
 * literal sentinel is what actually gets stored at creation time when the
 * Ask internIn conversation never collected these logistics. The review
 * screen treats exactly these values as "not yet set" and renders them as
 * empty inputs, never as if the AI had filled them in.
 */
export const DRAFT_DURATION_SENTINEL = "Not set yet";
export const DRAFT_LOCATION_SENTINEL = "Not set yet";
export const DRAFT_HOURS_SENTINEL = 1;

export function isUnsetDuration(value: string) {
  return value === DRAFT_DURATION_SENTINEL;
}
export function isUnsetLocation(value: string) {
  return value === DRAFT_LOCATION_SENTINEL;
}
export function isUnsetHoursPerWeek(value: number) {
  return value === DRAFT_HOURS_SENTINEL;
}
