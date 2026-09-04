import { z } from "zod";
import type { RubricMetric } from "@/lib/ai/schemas";

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
  /** Adaptive, rubric-driven evaluation — absent on evidence generated
   * before this existed (never backfilled), and whenever there was no
   * evaluable source to run it against. */
  metrics?: RubricMetric[];
  strengths?: string[];
  gaps?: string[];
  confidence?: "low" | "medium" | "high";
};
/** Same grounding rule as groundedHighlights, applied to rubric metrics: a
 * metric's evidenceQuote/sourceId is kept only if it's a real, exact
 * substring of that source's text — otherwise the citation is stripped
 * (the metric itself, and its rationale, are kept; only the unverifiable
 * quote is dropped, never fabricated into a fake one). */
export function groundedMetrics<T extends { evidenceQuote?: string | null; sourceId?: string | null }>(
  metrics: T[],
  sources: EvidenceSource[],
): T[] {
  return metrics.map((metric) => {
    if (!metric.evidenceQuote || !metric.sourceId) return { ...metric, evidenceQuote: undefined, sourceId: undefined };
    const source = sources.find((s) => s.id === metric.sourceId);
    if (!source || !source.text.includes(metric.evidenceQuote)) {
      return { ...metric, evidenceQuote: undefined, sourceId: undefined };
    }
    return metric;
  });
}

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
