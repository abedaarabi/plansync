type MatchInput = { id: string; name: string };

export type UploadNameMatch = {
  kind: "new_version" | "new_sheet";
  score: number;
  matched: MatchInput | null;
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\brev(?:ision)?\s*[a-z0-9]+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "");
}

function bigrams(s: string): string[] {
  if (s.length < 2) return s.length === 1 ? [s] : [];
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i += 1) out.push(s.slice(i, i + 2));
  return out;
}

function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  const aBigrams = bigrams(a);
  const bBigrams = bigrams(b);
  if (aBigrams.length === 0 || bBigrams.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const g of aBigrams) counts.set(g, (counts.get(g) ?? 0) + 1);
  let overlap = 0;
  for (const g of bBigrams) {
    const left = counts.get(g) ?? 0;
    if (left > 0) {
      overlap += 1;
      counts.set(g, left - 1);
    }
  }
  return (2 * overlap) / (aBigrams.length + bBigrams.length);
}

export function findBestUploadMatch(
  candidateName: string,
  existing: MatchInput[],
  opts?: { suggestThreshold?: number; acceptThreshold?: number },
): UploadNameMatch {
  const suggestThreshold = opts?.suggestThreshold ?? 0.82;
  const acceptThreshold = opts?.acceptThreshold ?? 0.9;
  const candidateNorm = normalizeName(candidateName);
  let best: MatchInput | null = null;
  let bestScore = 0;

  for (const file of existing) {
    const score = diceCoefficient(candidateNorm, normalizeName(file.name));
    if (score > bestScore) {
      bestScore = score;
      best = file;
    }
  }

  if (!best || bestScore < suggestThreshold) {
    return { kind: "new_sheet", score: bestScore, matched: null };
  }
  if (bestScore < acceptThreshold) {
    return { kind: "new_sheet", score: bestScore, matched: best };
  }
  return { kind: "new_version", score: bestScore, matched: best };
}
