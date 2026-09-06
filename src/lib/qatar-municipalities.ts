/**
 * Qatar's 8 municipalities — the canonical set for a student's main profile
 * Location. Fixed, not sourced from a live feed; matches Qatar's official
 * municipal structure. Supersedes the old free-text 11-item QATAR_CITIES
 * list (which mixed in non-municipality places like Dukhan/Mesaieed/Lusail).
 */
export const MUNICIPALITY_OPTIONS = [
  "Doha",
  "Al Rayyan",
  "Al Wakrah",
  "Al Khor and Al Thakira",
  "Al Shamal",
  "Umm Salal",
  "Al Daayen",
  "Al Shahaniya",
] as const;

export type Municipality = (typeof MUNICIPALITY_OPTIONS)[number];

export function isMunicipality(value: string | null | undefined): value is Municipality {
  return typeof value === "string" && (MUNICIPALITY_OPTIONS as readonly string[]).includes(value);
}
