import { z } from "zod";

export const EvidenceQuotesSchema = z.object({
  highlights: z
    .array(
      z.object({
        section: z.enum([
          "background",
          "requirements",
          "challenge",
          "strengths",
        ]),
        sourceId: z.string(),
        quote: z.string().min(12).max(350),
      }),
    )
    .max(12),
});
export type EvidenceSource = {
  id: string;
  label: string;
  text: string;
  kind: "cv" | "profile" | "submission";
};
export type EvidenceSummary = {
  version: 1;
  fingerprint: string;
  generatedAt: string;
  sources: { id: string; label: string; kind: EvidenceSource["kind"] }[];
  highlights: z.infer<typeof EvidenceQuotesSchema>["highlights"];
  unavailable: string[];
};
/** Retain exact source quotations only. The model cannot add a hiring recommendation. */
export function groundedHighlights(
  output: z.infer<typeof EvidenceQuotesSchema>,
  sources: EvidenceSource[],
) {
  const seen = new Set<string>();
  return output.highlights.filter((h) => {
    const source = sources.find((s) => s.id === h.sourceId);
    const key = `${h.sourceId}:${h.quote}`;
    if (!source || !source.text.includes(h.quote) || seen.has(key))
      return false;
    if (h.section === "background" && source.kind !== "cv") return false;
    if (h.section === "challenge" && source.kind !== "submission") return false;
    if (h.section === "strengths" && source.kind === "profile") return false;
    seen.add(key);
    return true;
  });
}
