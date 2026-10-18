// Fuzzy matching with the scores of rapidfuzz 3.14.6 (ML-27/ML-28, S4, decision D6). Ported by hand: no library.
// ratio = (1 - d / ls) * 100 in exactly this operation order, where ls = len(a) + len(b) and d = ls - 2 * LCS
// (LCS: longest common subsequence, over code points). The algebraically equal 200 * LCS / ls differs in the last bit
// for some inputs, so the operation order must not be changed. Plain TypeScript, no logging, no React Native, fs or
// path import.
import { engineConstants } from '../data';
import { stableSort } from './sort';

const WHITESPACE = new Set<number>(engineConstants.python_unicode.whitespace);
const LATIN1_NOT_SPACE = new Set<number>([0x85, 0xa0]);

/** The code points of s (not UTF-16 units). */
function codePoints(s: string): number[] {
  return Array.from(s, (ch) => ch.codePointAt(0) as number); // ch comes from Array.from, so it is never empty
}

/** Length of the longest common subsequence, with a rolling array. */
function lcsLength(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }
  let previous: number[] = new Array<number>(b.length + 1).fill(0);
  let current: number[] = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        current[j] = previous[j - 1] + 1;
      } else {
        current[j] = Math.max(previous[j], current[j - 1]);
      }
    }
    const swap = previous;
    previous = current;
    current = swap;
  }
  return previous[b.length];
}

/** rapidfuzz fuzz.ratio: 0 to 100; 100 for two empty strings. */
export function ratio(a: string, b: string): number {
  const x = codePoints(a);
  const y = codePoints(b);
  const ls = x.length + y.length;
  if (ls === 0) {
    return 100;
  }
  const d = ls - 2 * lcsLength(x, y);
  return (1 - d / ls) * 100;
}

/** Orders code point arrays by code point, then by length (Python's order for str); never by UTF-16 unit. */
function compareCodePoints(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    if (a[i] !== b[i]) {
      return a[i] < b[i] ? -1 : 1;
    }
  }
  return a.length === b.length ? 0 : a.length < b.length ? -1 : 1;
}

/**
 * The whitespace-separated tokens of s, as rapidfuzz splits them: Python's whitespace, except that U+0085 and U+00A0
 * separate tokens only when the string has a code point of 256 or above (rapidfuzz treats them as ordinary characters
 * in a string made only of Latin-1 characters; measured against rapidfuzz 3.14.6).
 */
function splitTokens(s: string): string[] {
  const wide = codePoints(s).some((code) => code >= 256);
  const tokens: string[] = [];
  let current = '';
  for (const ch of Array.from(s)) {
    const code = ch.codePointAt(0) as number;
    if (WHITESPACE.has(code) && (wide || !LATIN1_NOT_SPACE.has(code))) {
      if (current !== '') {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current !== '') {
    tokens.push(current);
  }
  return tokens;
}

/** The whitespace-separated tokens of s sorted by code point and joined with one space (the token sort key). */
export function sortedTokens(s: string): string {
  const tokens = splitTokens(s).map((token) => ({ text: token, points: codePoints(token) }));
  return stableSort(tokens, (x, y) => compareCodePoints(x.points, y.points))
    .map((token) => token.text)
    .join(' ');
}

/** rapidfuzz fuzz.token_sort_ratio: ratio of the two strings after their tokens are sorted. */
export function tokenSortRatio(a: string, b: string): number {
  return ratio(sortedTokens(a), sortedTokens(b));
}

/** rapidfuzz Levenshtein.distance with the default weights (1, 1, 1), over code points. */
export function levenshteinDistance(a: string, b: string): number {
  const x = codePoints(a);
  const y = codePoints(b);
  if (x.length === 0) {
    return y.length;
  }
  if (y.length === 0) {
    return x.length;
  }
  let previous: number[] = [];
  for (let j = 0; j <= y.length; j += 1) {
    previous.push(j);
  }
  let current: number[] = new Array<number>(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= y.length; j += 1) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    const swap = previous;
    previous = current;
    current = swap;
  }
  return previous[y.length];
}

export interface ExtractHit {
  choice: string;
  score: number;
  index: number;
}

export interface ExtractOptions {
  limit?: number;
  scoreCutoff?: number;
}

/**
 * rapidfuzz process.extract for a scorer where larger is better and no processor: keeps the choices whose score is at
 * or above scoreCutoff (rounded to float32, as rapidfuzz does), sorts them by score (high first) and then by input index, and returns the first `limit`
 * (all of them when limit is undefined).
 */
export function extract(
  query: string,
  choices: readonly string[],
  scorer: (a: string, b: string) => number,
  options: ExtractOptions = {},
): ExtractHit[] {
  const { limit, scoreCutoff } = options;
  // rapidfuzz rounds the cutoff to float32 before it compares, so a score equal to a cutoff that float32 cannot hold
  // exactly (for example 83.33333333333334) can be dropped; Math.fround is the same rounding.
  const cutoff = scoreCutoff === undefined ? undefined : Math.fround(scoreCutoff);
  const hits: ExtractHit[] = [];
  choices.forEach((choice, index) => {
    const score = scorer(query, choice);
    if (cutoff === undefined || score >= cutoff) {
      hits.push({ choice, score, index });
    }
  });
  const sorted = stableSort(hits, (x, y) => (x.score > y.score ? -1 : x.score < y.score ? 1 : 0));
  return limit === undefined ? sorted : sorted.slice(0, Math.max(0, limit));
}
