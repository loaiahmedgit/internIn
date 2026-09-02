/**
 * ONE canonical challenge-duration display, used everywhere a challenge's
 * length is shown (Challenge Draft, Internship review, Challenge tab,
 * opportunity detail) — fixes the "4–6 hours" vs "60 min" mismatch: those
 * were two independently-tracked values (a human label vs a hardcoded
 * numeric fallback). The human label, when the model gave one, always
 * wins; `estimatedMinutes` is only ever a fallback for older data that
 * predates the label field.
 */
export function formatChallengeDuration(estimatedMinutes: number, estimatedDurationLabel?: string | null): string {
  if (estimatedDurationLabel) return estimatedDurationLabel;
  return `${estimatedMinutes} min`;
}

/**
 * Best-effort minutes estimate from a human label like "4–6 hours" or
 * "45-60 min" — ONLY used to fill the database's required numeric column
 * when the model didn't also give durationMinutes directly. Never the
 * value shown to a user (formatChallengeDuration always prefers the label
 * itself); this just keeps estimatedMinutes roughly meaningful for any
 * code that still sorts/filters on it.
 */
export function estimateMinutesFromLabel(label: string | null | undefined): number | null {
  if (!label) return null;
  const match = label.match(/(\d+(?:\.\d+)?)\s*(?:[-–—to]+\s*(\d+(?:\.\d+)?))?\s*(hour|hr|minute|min)/i);
  if (!match) return null;
  const low = Number(match[1]);
  const high = match[2] ? Number(match[2]) : low;
  const average = (low + high) / 2;
  const isHours = /^h/i.test(match[3]);
  const minutes = Math.round(isHours ? average * 60 : average);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}
