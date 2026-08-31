// Pure scoring math extracted from index.ts so it's testable under
// Node/Vitest without a Deno runtime — the per-answer weight/mapping
// fetches stay in index.ts (I/O), only the accumulation and normalization
// math lives here.

export interface DimensionTotal {
  sum: number;
  count: number;
}

export type DimensionTotals = Record<number, DimensionTotal>;

function addToDimension(totals: DimensionTotals, dimensionId: number, amount: number): void {
  if (!totals[dimensionId]) {
    totals[dimensionId] = { sum: 0, count: 0 };
  }
  totals[dimensionId].sum += amount;
  totals[dimensionId].count += 1;
}

export function applyOptionWeights(
  totals: DimensionTotals,
  weights: { dimension_id: number; weight: number }[]
): void {
  for (const w of weights) {
    addToDimension(totals, w.dimension_id, w.weight);
  }
}

export function applyScaleMapping(
  totals: DimensionTotals,
  scaleValue: number,
  mappings: { dimension_id: number; multiplier: number }[]
): void {
  // Scale questions always resolve to one of exactly 3 tiers — 0, 5, or 10
  // (see ZONE_SCALE_VALUE in personality-quiz.tsx and the tier CHECK
  // (0,1,2) constraint on personality_scale_labels). Option-weight
  // contributions are hand-picked in roughly [-0.9, 0.9], so summing a raw
  // 5 or 10 in alongside them saturates clampScore's [0,1] ceiling — a
  // dimension whose only contributor is this question scores the middle
  // tier (5) and the top tier (10) identically. Normalize into the same
  // ~[-1, 1] range first, with 5 (the neutral middle tier) mapping to 0.
  const normalized = (scaleValue - 5) / 5;
  for (const m of mappings) {
    addToDimension(totals, m.dimension_id, normalized * m.multiplier);
  }
}

export function clampScore(sum: number, count: number): number {
  return Math.min(1, Math.max(0, sum / count));
}

export interface ScoreRow {
  user_id: string;
  dimension_id: number;
  score: number;
  updated_at: string;
}

export function buildScoreRows(userId: string, totals: DimensionTotals, updatedAt: string): ScoreRow[] {
  return Object.entries(totals).map(([dimensionId, { sum, count }]) => ({
    user_id: userId,
    dimension_id: Number(dimensionId),
    score: clampScore(sum, count),
    updated_at: updatedAt,
  }));
}
