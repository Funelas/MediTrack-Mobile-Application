// Fuzzy matching (ML-27/ML-28, S4): every case of docs/engine_vectors/fuzz.json must be reproduced exactly, scores
// included (decision D4), plus direct checks of the behaviour the port exists to get right. Only counts and case ids
// are ever reported, never case text.
import { extract, levenshteinDistance, ratio, sortedTokens, tokenSortRatio } from '../py/fuzz';
import { stableSort } from '../py/sort';
import { compareWithHeader, describeVectors, Json } from './helpers/vectors';

type Fields = { [key: string]: Json };
type Handler = (input: Fields, choiceSets: { [name: string]: string[] }) => Json;

function str(value: Json | undefined): string {
  if (typeof value !== 'string') {
    throw new Error('expected a string field');
  }
  return value;
}

function strings(value: Json | undefined): string[] {
  if (!Array.isArray(value)) {
    throw new Error('expected a list field');
  }
  return value.map(str);
}

function optionalNumber(value: Json | undefined): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number') {
    throw new Error('expected a number field');
  }
  return value;
}

const SCORERS: { [name: string]: (a: string, b: string) => number } = {
  ratio,
  token_sort_ratio: tokenSortRatio,
};

function extractResult(input: Fields, choiceSets: { [name: string]: string[] }): Json {
  const scorer = SCORERS[str(input.scorer)];
  if (scorer === undefined) {
    throw new Error('unknown scorer');
  }
  let choices: string[];
  if (input.choices_ref !== undefined) {
    const named = choiceSets[str(input.choices_ref)];
    if (named === undefined) {
      throw new Error('unknown choice set');
    }
    choices = named;
  } else {
    choices = strings(input.choices);
  }
  const hits = extract(str(input.query), choices, scorer, {
    limit: optionalNumber(input.limit),
    scoreCutoff: optionalNumber(input.score_cutoff),
  });
  return hits.map((hit) => [hit.choice, hit.score, hit.index]);
}

const HANDLERS: { [fn: string]: Handler } = {
  'fuzz.ratio': (input) => ratio(str(input.a), str(input.b)),
  'fuzz.token_sort_ratio': (input) => tokenSortRatio(str(input.a), str(input.b)),
  'Levenshtein.distance': (input) => levenshteinDistance(str(input.a), str(input.b)),
  'process.extract': extractResult,
};

interface VectorCase {
  id: string;
  fn: string;
  input: Fields;
  expected: Json;
}

describeVectors('fuzz', (file) => {
  const cases = file.cases as unknown as VectorCase[];
  const choiceSets = (file as unknown as { choice_sets: { [name: string]: string[] } }).choice_sets;

  it('has cases, unique ids, choice sets, and a handler for every fn', () => {
    expect(cases.length).toBeGreaterThan(0);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    expect(Object.keys(choiceSets).length).toBeGreaterThan(0);
    const unknown = Array.from(new Set(cases.map((c) => c.fn))).filter((fn) => HANDLERS[fn] === undefined);
    expect(unknown).toEqual([]);
  });

  const fns = Array.from(new Set(cases.map((c) => c.fn)));
  it.each(fns)('reproduces every case of %s', (fn) => {
    const mine = cases.filter((c) => c.fn === fn);
    const failed: string[] = [];
    for (const c of mine) {
      const handler = HANDLERS[c.fn];
      if (handler === undefined) {
        failed.push(c.id + ' (no handler)');
        continue;
      }
      let actual: Json;
      try {
        actual = handler(c.input, choiceSets);
      } catch (error) {
        failed.push(c.id + ' (threw)');
        continue;
      }
      if (compareWithHeader(file, c.expected, actual).length > 0) {
        failed.push(c.id);
      }
    }
    expect(failed).toEqual([]);
    expect(mine.length).toBeGreaterThan(0);
  });
});

describe('fuzzy matching, direct checks', () => {
  it('empty strings follow rapidfuzz: two empty strings are 100, one empty string is 0', () => {
    expect(ratio('', '')).toBe(100);
    expect(ratio('', 'abc')).toBe(0);
    expect(ratio('abc', '')).toBe(0);
    expect(tokenSortRatio('', '')).toBe(100);
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('', '')).toBe(0);
  });

  it('ratio keeps the operation order (1 - d / ls) * 100', () => {
    // 7 characters against 6 with 6 in common: d = 1, ls = 13
    expect(ratio('abcdefg', 'abcdef')).toBe((1 - 1 / 13) * 100);
    expect(ratio('abc', 'abc')).toBe(100);
  });

  it('works on code points, not UTF-16 units', () => {
    expect(ratio('\u{1F600}', '\u{1F600}')).toBe(100);
    expect(levenshteinDistance('\u{1F600}', 'a')).toBe(1);
    expect(levenshteinDistance('\u{1F600}', '\u{1F600}')).toBe(0);
  });

  it('token sort ignores order and spacing, and splits on Python whitespace', () => {
    expect(tokenSortRatio('b a', 'a  b')).toBe(100);
    expect(tokenSortRatio('a\u{2003}b', 'b\ta')).toBe(100);
    expect(sortedTokens('  c  b a ')).toBe('a b c');
  });

  it('a code-point sort differs from the default string sort for an astral and a BMP character', () => {
    // U+1F600 is the UTF-16 pair D83D DE00, which the default sort places before U+FF21 (a single unit, FF21).
    // Python (and rapidfuzz) order by code point, so U+FF21 comes first.
    const astral = '\u{1F600}';
    const bmp = '\u{FF21}';
    expect([astral, bmp].sort()).toEqual([astral, bmp]);
    expect(sortedTokens(astral + ' ' + bmp)).toBe(bmp + ' ' + astral);
    expect(sortedTokens(bmp + ' ' + astral)).toBe(bmp + ' ' + astral);
  });

  it('U+00A0 and U+0085 split tokens only in a string that has a code point of 256 or above', () => {
    // rapidfuzz 3.14.6 does not treat them as whitespace in an all-Latin-1 string; values taken from rapidfuzz
    expect(tokenSortRatio('a\u{A0}b', 'b a')).toBe(66.66666666666667);
    expect(sortedTokens('a\u{A0}b')).toBe('a\u{A0}b');
    expect(tokenSortRatio('a\u{A0}b\u{100}', 'b a\u{100}')).toBe(75);
    expect(sortedTokens('a\u{A0}b\u{100}')).toBe('a b\u{100}');
    expect(tokenSortRatio('a\u{85}b', 'b a')).toBe(66.66666666666667);
    expect(tokenSortRatio('a\u{85}b\u{100}', 'b a\u{100}')).toBe(75);
    expect(sortedTokens('a\u{1C}b')).toBe('a b'); // other Python whitespace splits in a Latin-1 string too
  });

  it('extract rounds the cutoff to float32 as rapidfuzz does', () => {
    // 20 + 20 characters with 17 in common: the score is exactly 85.0, and the cutoff 85.0 keeps it
    const a = 'abcdefghijklmnopqrst';
    const b = 'abcdefghijklmnopqXYZ';
    expect(ratio(a, b)).toBe(85);
    expect(extract(a, [b], ratio, { scoreCutoff: 85 }).map((h) => h.index)).toEqual([0]);
    // 85.00000000000001 is 85 in float32, so the score 85 still passes
    expect(extract(a, [b], ratio, { scoreCutoff: 85.00000000000001 }).map((h) => h.index)).toEqual([0]);
    // 83.33333333333334 is the score of two choices; as float32 the cutoff is 83.33333587646484, above both scores
    const choices = ['abcdeX', 'Xbcdef', 'abcde'];
    expect(ratio('abcdef', 'abcdeX')).toBe(83.33333333333334);
    expect(extract('abcdef', choices, ratio, { scoreCutoff: 83.33333333333334 }).map((h) => h.index)).toEqual([2]);
    expect(extract('abcdef', choices, ratio, { scoreCutoff: 83.3333 }).map((h) => h.index)).toEqual([2, 0, 1]);
    expect(extract('abcdef', choices, ratio, { scoreCutoff: 83 }).map((h) => h.index)).toEqual([2, 0, 1]);
  });

  it('the stable sort that extract uses keeps input order on ties', () => {
    const items = [
      { name: 'a', k: 1 },
      { name: 'b', k: 1 },
      { name: 'c', k: 1 },
      { name: 'd', k: 2 },
    ];
    expect(stableSort(items, (x, y) => (x.k > y.k ? -1 : x.k < y.k ? 1 : 0)).map((i) => i.name)).toEqual([
      'd',
      'a',
      'b',
      'c',
    ]);
    const hits = extract('abc', ['abd', 'abe', 'abc', 'abf', 'abc'], ratio);
    expect(hits.map((h) => h.index)).toEqual([2, 4, 0, 1, 3]);
  });

  it('extract applies the cutoff with >= and the limit after sorting', () => {
    const choices = ['abd', 'abc', 'xyz'];
    const exact = ratio('abc', 'abd');
    expect(extract('abc', choices, ratio, { scoreCutoff: exact }).map((h) => h.index)).toEqual([1, 0]);
    expect(extract('abc', choices, ratio, { limit: 1 }).map((h) => h.index)).toEqual([1]);
    expect(extract('abc', choices, ratio, { limit: 10 })).toHaveLength(3);
    expect(extract('abc', [], ratio)).toEqual([]);
  });
});
