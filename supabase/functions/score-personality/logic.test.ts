import { describe, expect, it } from 'vitest';
import { applyOptionWeights, applyScaleMapping, clampScore, buildScoreRows, type DimensionTotals } from './logic';

describe('applyOptionWeights', () => {
  it('accumulates weights per dimension across multiple options', () => {
    const totals: DimensionTotals = {};
    applyOptionWeights(totals, [
      { dimension_id: 1, weight: 0.5 },
      { dimension_id: 1, weight: 0.3 },
      { dimension_id: 2, weight: 1 },
    ]);
    expect(totals).toEqual({
      1: { sum: 0.8, count: 2 },
      2: { sum: 1, count: 1 },
    });
  });

  it('merges into existing totals from a prior answer', () => {
    const totals: DimensionTotals = { 1: { sum: 0.2, count: 1 } };
    applyOptionWeights(totals, [{ dimension_id: 1, weight: 0.4 }]);
    expect(totals[1].count).toBe(2);
    expect(totals[1].sum).toBeCloseTo(0.6);
  });
});

describe('applyScaleMapping', () => {
  it('multiplies the scale value by each mapping multiplier', () => {
    const totals: DimensionTotals = {};
    applyScaleMapping(totals, 0.8, [
      { dimension_id: 3, multiplier: 1 },
      { dimension_id: 4, multiplier: -1 },
    ]);
    expect(totals).toEqual({
      3: { sum: 0.8, count: 1 },
      4: { sum: -0.8, count: 1 },
    });
  });
});

describe('clampScore', () => {
  it('leaves an in-range average unchanged', () => {
    expect(clampScore(1.5, 3)).toBeCloseTo(0.5);
  });

  it('clamps a sum/count average above 1 down to 1', () => {
    expect(clampScore(5, 2)).toBe(1);
  });

  it('clamps a negative average up to 0', () => {
    expect(clampScore(-3, 2)).toBe(0);
  });
});

describe('buildScoreRows', () => {
  it('builds one clamped, timestamped row per dimension', () => {
    const totals: DimensionTotals = {
      1: { sum: 0.6, count: 2 },
      2: { sum: 4, count: 2 },
    };
    const rows = buildScoreRows('user-1', totals, '2026-08-15T00:00:00.000Z');
    expect(rows).toEqual([
      { user_id: 'user-1', dimension_id: 1, score: 0.3, updated_at: '2026-08-15T00:00:00.000Z' },
      { user_id: 'user-1', dimension_id: 2, score: 1, updated_at: '2026-08-15T00:00:00.000Z' },
    ]);
  });

  it('returns an empty array when there are no dimension totals', () => {
    expect(buildScoreRows('user-1', {}, '2026-08-15T00:00:00.000Z')).toEqual([]);
  });
});
