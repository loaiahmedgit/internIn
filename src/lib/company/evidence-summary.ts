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
/** Same grounding rule as groundedHighlights, applied to rubric metrics —
 * extended with two real-evidence guarantees the plain quote-verification
 * check doesn't cover on its own:
 *
 * 1. A "strong" or "solid" level with no genuinely grounded quote behind it
 *    is downgraded to "insufficient" rather than trusted. A criterion whose
 *    real evidence (e.g. a Figma file) wasn't actually accessible to the
 *    evaluator must never read as confidently assessed just because the
 *    model wrote a plausible-sounding rationale.
 * 2. The exact same quote cannot ground two different criteria. Reusing one
 *    piece of text as "evidence" for several unrelated rubric criteria is
 *    the generic-reasoning failure mode this exists to catch — each metric
 *    needs evidence genuinely specific to that criterion, not one quote
 *    doing duty for all of them.
 *
 * The metric and its rationale are always kept; only the level and the
 * unverifiable/reused citation are adjusted — never a fabricated quote. */
export function groundedMetrics(metrics: RubricMetric[], sources: EvidenceSource[]): RubricMetric[] {
  const claimedQuotes = new Set<string>();
  return metrics.map((metric) => {
    const source = metric.sourceId ? sources.find((s) => s.id === metric.sourceId) : undefined;
    const isVerbatim = Boolean(metric.evidenceQuote && source && source.text.includes(metric.evidenceQuote));
    const isReused = Boolean(metric.evidenceQuote && claimedQuotes.has(metric.evidenceQuote));
    const isGrounded = isVerbatim && !isReused;

    if (isGrounded && metric.evidenceQuote) claimedQuotes.add(metric.evidenceQuote);
    if (isGrounded) return metric;

    const needsDowngrade = metric.level === "strong" || metric.level === "solid";
    return {
      ...metric,
      evidenceQuote: undefined,
      sourceId: undefined,
      level: needsDowngrade ? "insufficient" : metric.level,
      rationale: needsDowngrade
        ? `${metric.rationale} (Downgraded: no verifiable, criterion-specific evidence was found — requires human review.)`
        : metric.rationale,
    };
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
