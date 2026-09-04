/**
 * Rescales rubric weights to sum to exactly 100 when the model's arithmetic
 * comes out slightly off — a deterministic repair, not a reason to throw
 * away an otherwise-good challenge (Part 7: "do not rely purely on the
 * model to get arithmetic perfect... normalize or validate
 * deterministically"). Any leftover rounding remainder goes to the
 * heaviest criterion, so the total is exact without a fractional weight
 * anywhere.
 *
 * Its own module (not defined inside challenge-generation.ts) so both
 * challenge-generation.ts and gemma-provider.ts can import it without a
 * circular dependency — challenge-generation.ts already imports getModel
 * from gemma-provider.ts.
 */
export function normalizeRubricWeights<T extends { weight: number }>(rubric: T[]): T[] {
  const total = rubric.reduce((sum, r) => sum + r.weight, 0);
  if (rubric.length === 0 || total === 100 || total === 0) return rubric;

  const scaled = rubric.map((r) => ({ ...r, weight: Math.round((r.weight / total) * 100) }));
  const remainder = 100 - scaled.reduce((sum, r) => sum + r.weight, 0);
  if (remainder !== 0) {
    const heaviestIndex = scaled.reduce((best, r, i) => (r.weight > scaled[best].weight ? i : best), 0);
    scaled[heaviestIndex] = { ...scaled[heaviestIndex], weight: scaled[heaviestIndex].weight + remainder };
  }
  return scaled;
}
