import { describe, expect, it } from 'vitest';
import {
  cosineSimilarity,
  averagePairwiseSimilarity,
  averageSimilarityToGroup,
  outlierMemberIndexes,
  type ScoreVector,
} from './compatibility';

const DIMS = [1, 2, 3];

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    const a: ScoreVector = { 1: 0.5, 2: 0.8, 3: 0.2 };
    expect(cosineSimilarity(a, a, DIMS)).toBeCloseTo(1);
  });

  it('is 0 for orthogonal vectors', () => {
    const a: ScoreVector = { 1: 1, 2: 0, 3: 0 };
    const b: ScoreVector = { 1: 0, 2: 1, 3: 0 };
    expect(cosineSimilarity(a, b, DIMS)).toBeCloseTo(0);
  });

  it('returns null when either vector is entirely zero across the given dimensions', () => {
    const zero: ScoreVector = { 1: 0, 2: 0, 3: 0 };
    const nonZero: ScoreVector = { 1: 1, 2: 1, 3: 1 };
    expect(cosineSimilarity(zero, nonZero, DIMS)).toBeNull();
  });

  it('treats a missing dimension as 0', () => {
    const a: ScoreVector = { 1: 1 };
    const b: ScoreVector = { 1: 1, 2: 1 };
    // dimension 2 contributes 0*1=0 to the dot product, 1 to normB only
    expect(cosineSimilarity(a, b, [1, 2])).toBeCloseTo(1 / Math.sqrt(2));
  });
});

describe('averagePairwiseSimilarity', () => {
  it('returns null for a group of fewer than 2 members', () => {
    expect(averagePairwiseSimilarity([{ 1: 1 }], DIMS)).toBeNull();
    expect(averagePairwiseSimilarity([], DIMS)).toBeNull();
  });

  it('averages the pairwise similarity across every pair in a 3-member group', () => {
    const a: ScoreVector = { 1: 1, 2: 0, 3: 0 };
    const b: ScoreVector = { 1: 1, 2: 0, 3: 0 };
    const c: ScoreVector = { 1: 0, 2: 1, 3: 0 };
    // pair(a,b) = 1, pair(a,c) = 0, pair(b,c) = 0 -> average 1/3
    expect(averagePairwiseSimilarity([a, b, c], DIMS)).toBeCloseTo(1 / 3);
  });

  it('excludes zero-vector pairs from the average rather than treating them as 0', () => {
    const a: ScoreVector = { 1: 1, 2: 0, 3: 0 };
    const zero: ScoreVector = { 1: 0, 2: 0, 3: 0 };
    // The only pair is (a, zero), which cosineSimilarity treats as null and
    // excludes — so the average has no terms at all.
    expect(averagePairwiseSimilarity([a, zero], DIMS)).toBeNull();
  });
});

describe('averageSimilarityToGroup', () => {
  it('returns null for an empty group', () => {
    expect(averageSimilarityToGroup({ 1: 1 }, [], DIMS)).toBeNull();
  });

  it('averages the candidate\'s similarity to each existing member', () => {
    const candidate: ScoreVector = { 1: 1, 2: 0, 3: 0 };
    const memberA: ScoreVector = { 1: 1, 2: 0, 3: 0 };
    const memberB: ScoreVector = { 1: 0, 2: 1, 3: 0 };
    expect(averageSimilarityToGroup(candidate, [memberA, memberB], DIMS)).toBeCloseTo(0.5);
  });
});

describe('outlierMemberIndexes', () => {
  it('returns empty for fewer than 3 members', () => {
    const a: ScoreVector = { 1: 1, 2: 0, 3: 0 };
    const b: ScoreVector = { 1: 0, 2: 1, 3: 0 };
    expect(outlierMemberIndexes([a, b], DIMS)).toEqual(new Set());
  });

  it('flags the one member who shares nothing with two otherwise-identical members', () => {
    const a: ScoreVector = { 1: 1, 2: 1, 3: 0 };
    const b: ScoreVector = { 1: 1, 2: 1, 3: 0 };
    const outlier: ScoreVector = { 1: 0, 2: 0, 3: 1 };
    expect(outlierMemberIndexes([a, b, outlier], DIMS)).toEqual(new Set([2]));
  });

  it('flags nobody when everyone is similarly matched', () => {
    const a: ScoreVector = { 1: 1, 2: 0.9, 3: 0 };
    const b: ScoreVector = { 1: 0.9, 2: 1, 3: 0 };
    const c: ScoreVector = { 1: 0.8, 2: 0.8, 3: 0.1 };
    expect(outlierMemberIndexes([a, b, c], DIMS)).toEqual(new Set());
  });
});
