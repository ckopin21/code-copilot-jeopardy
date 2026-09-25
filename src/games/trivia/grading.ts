import type { AutoGradeConfidence } from './types';

/** Answer matching for typed responses. Kept free of heavy dependencies because every Host screen loads it. */
export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function answerMatches(input: string, accepted: string[]): boolean {
  const normalized = normalizeAnswer(input);
  return accepted.some((candidate) => normalizeAnswer(candidate) === normalized);
}

function editDistance(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= b.length; column += 1) {
      const above = previous[column];
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      previous[column] = Math.min(previous[column] + 1, previous[column - 1] + 1, diagonal + cost);
      diagonal = above;
    }
  }
  return previous[b.length];
}

export function autoGradeAnswer(input: string, accepted: string[]): { correct: boolean; confidence: AutoGradeConfidence; matchedAnswer?: string } {
  const normalizedInput = normalizeAnswer(input);
  if (!normalizedInput) return { correct: false, confidence: 'high' };

  for (const candidate of accepted) {
    const normalizedCandidate = normalizeAnswer(candidate);
    if (normalizedInput === normalizedCandidate) return { correct: true, confidence: 'high', matchedAnswer: candidate };
  }

  let best: { candidate: string; ratio: number } | null = null;
  for (const candidate of accepted) {
    const normalizedCandidate = normalizeAnswer(candidate);
    const length = Math.max(normalizedInput.length, normalizedCandidate.length);
    if (!length) continue;
    const ratio = editDistance(normalizedInput, normalizedCandidate) / length;
    if (!best || ratio < best.ratio) best = { candidate, ratio };
  }

  if (best && best.ratio <= 0.12) return { correct: true, confidence: 'medium', matchedAnswer: best.candidate };
  return { correct: false, confidence: best && best.ratio <= 0.24 ? 'medium' : 'high' };
}
