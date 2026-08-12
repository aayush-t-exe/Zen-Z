// Compatibility scoring over whatever personality dimensions are
// currently active — never a fixed set of named fields, so adding
// dimension #6+ (via new quiz questions) changes nothing here.

export type ScoreVector = Record<number, number>;

export function cosineSimilarity(
  a: ScoreVector,
  b: ScoreVector,
  dimensionIds: number[]
): number | null {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const id of dimensionIds) {
    const va = a[id] ?? 0;
    const vb = b[id] ?? 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }

  if (normA === 0 || normB === 0) return null;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function averagePairwiseSimilarity(
  memberScores: ScoreVector[],
  dimensionIds: number[]
): number | null {
  if (memberScores.length < 2) return null;

  let total = 0;
  let count = 0;
  for (let i = 0; i < memberScores.length; i++) {
    for (let j = i + 1; j < memberScores.length; j++) {
      const sim = cosineSimilarity(memberScores[i], memberScores[j], dimensionIds);
      if (sim !== null) {
        total += sim;
        count += 1;
      }
    }
  }
  return count > 0 ? total / count : null;
}

export function averageSimilarityToGroup(
  candidate: ScoreVector,
  memberScores: ScoreVector[],
  dimensionIds: number[]
): number | null {
  if (memberScores.length === 0) return null;

  let total = 0;
  let count = 0;
  for (const member of memberScores) {
    const sim = cosineSimilarity(candidate, member, dimensionIds);
    if (sim !== null) {
      total += sim;
      count += 1;
    }
  }
  return count > 0 ? total / count : null;
}
