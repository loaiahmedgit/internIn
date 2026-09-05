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
 * card — real criteria/weights, no pill badges, no extra padding. */
export function RubricList({ rubric }: { rubric: RubricCriterion[] }) {
  return (
    <div className="divide-y divide-navy/8">
      {rubric.map((c) => (
        <div key={c.criterion} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="text-sm font-medium text-navy">{c.criterion}</p>
            <p className="mt-0.5 text-xs leading-5 text-navy/50">{c.description}</p>
          </div>
          <span className="shrink-0 text-sm font-medium text-navy/60">{c.weight}%</span>
        </div>
      ))}
    </div>
  );
}
