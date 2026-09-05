export interface RubricCriterion {
  criterion: string;
  description: string;
  weight: number;
}

/** Compact, wrapping inline rubric summary for the Start Challenge screen —
 * "Customer reasoning (50%) · Practicality (50%)". Never a giant card. */
export function RubricInline({ rubric }: { rubric: RubricCriterion[] }) {
  return (
    <p className="text-sm leading-6 text-navy/70">
      {rubric.map((c, index) => (
        <span key={c.criterion}>
          {index > 0 && <span className="text-navy/30"> · </span>}
          {c.criterion} <span className="text-navy/45">({c.weight}%)</span>
        </span>
      ))}
    </p>
  );
}

/** Compact row-per-criterion rubric for the Active Challenge Evaluation
 * card — criterion + weight only, no description, no pill badge. The
 * weighting is the main thing a student needs visible here; descriptions
 * are still real data (shown elsewhere), just not duplicated into this
 * intentionally compact list. */
export function RubricList({ rubric }: { rubric: RubricCriterion[] }) {
  return (
    <div className="divide-y divide-navy/8">
      {rubric.map((c) => (
        <div key={c.criterion} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <p className="min-w-0 truncate text-sm text-navy/75">{c.criterion}</p>
          <span className="shrink-0 text-sm font-medium text-navy/60">{c.weight}%</span>
        </div>
      ))}
    </div>
  );
}
