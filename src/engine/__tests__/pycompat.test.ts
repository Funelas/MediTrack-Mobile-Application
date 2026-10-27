// Python-compatibility helpers (ML-27/ML-28, S3): every case of docs/engine_vectors/pycompat.json must be reproduced
// exactly (decision D4), plus direct checks of JavaScript behaviour that the helpers exist to hide. Only counts and
// case ids are ever reported, never case text.
import { engineConstants } from '../data';
import { pyMean } from '../py/mean';
import { pyRound } from '../py/round';
import { firstMax, firstMin, pyMedian, stableSort } from '../py/sort';
import { pySum } from '../py/sum';
import {
  digitsToAscii,
  PY_DIGIT_CLASS,
  PY_DOT,
  PY_END,
  PY_SPACE_CLASS,
  PY_WORD_CLASS,
  pyEscape,
  pyFloat,
  pyIgnoreCase,
  pyIsDecimal,
  pyIsDigit,
  pyIsSpace,
  pyLower,
  pySlice,
  pySplit,
  pyStrip,
} from '../py/text';
import { compareWithHeader, decodeNonfinite, describeVectors, Json } from './helpers/vectors';

type Fields = { [key: string]: Json };
type Handler = (input: Fields) => Json;

function str(value: Json | undefined): string {
  if (typeof value !== 'string') {
    throw new Error('expected a string field');
  }
  return value;
}

function num(value: Json | undefined): number {
  if (typeof value !== 'number') {
    throw new Error('expected a number field');
  }
  return value;
}

function numbers(value: Json | undefined): number[] {
  if (!Array.isArray(value)) {
    throw new Error('expected a list field');
  }
  return value.map(num);
}

function sumTerms(value: Json | undefined): number[] {
  if (!Array.isArray(value)) {
    throw new Error('expected a list field');
  }
  return value.map((item) => num(decodeNonfinite(item)));
}

/** Exact equality for sum results: NaN equals NaN, -0 equals 0, numbers otherwise compare with ===. */
function sameSum(expected: Json, actual: Json): boolean {
  if (typeof expected !== 'number' || typeof actual !== 'number') {
    return false;
  }
  return (Number.isNaN(expected) && Number.isNaN(actual)) || expected === actual;
}

// Regexes are built only from the exported helpers, never from the Python pattern text.
const CONSTRUCTS: { [construct: string]: RegExp } = {
  dot: new RegExp('^a' + PY_DOT + 'b' + PY_END, 'u'),
  end: new RegExp('^abc' + PY_END, 'u'),
  digit: new RegExp('^' + PY_DIGIT_CLASS + '+' + PY_END, 'u'),
  space: new RegExp('^' + PY_SPACE_CLASS + '+' + PY_END, 'u'),
  word: new RegExp('^' + PY_WORD_CLASS + '+' + PY_END, 'u'),
  ignorecase_i: new RegExp('^' + pyIgnoreCase('i') + PY_END, 'iu'),
  ignorecase_k: new RegExp('^' + pyIgnoreCase('k') + PY_END, 'iu'),
  ignorecase_s: new RegExp('^' + pyIgnoreCase('s') + PY_END, 'iu'),
  ignorecase_kit: new RegExp('^' + pyIgnoreCase('kit') + PY_END, 'iu'),
};

function regexResult(input: Fields): Json {
  const construct = str(input.construct);
  const subject = str(input.subject);
  const pattern = construct === 'escape' ? new RegExp('^' + pyEscape(subject) + '$', 'u') : CONSTRUCTS[construct];
  if (pattern === undefined) {
    throw new Error('unknown construct');
  }
  const match = pattern.exec(subject);
  return { matched: match !== null, text: match === null ? null : match[0] };
}

const HANDLERS: { [fn: string]: Handler } = {
  round: (input) => pyRound(num(input.x), num(input.n)),
  sum: (input) => pySum(sumTerms(input.xs)),
  'statistics.mean': (input) => pyMean(numbers(input.xs)),
  'statistics.median': (input) => pyMedian(numbers(input.xs)),
  'str.isspace': (input) => pyIsSpace(str(input.s)),
  'str.strip': (input) => pyStrip(str(input.s)),
  'str.split': (input) => pySplit(str(input.s)),
  'str.isdigit': (input) => pyIsDigit(str(input.s)),
  'str.isdecimal': (input) => pyIsDecimal(str(input.s)),
  slice: (input) => pySlice(str(input.s), num(input.n)),
  'str.lower': (input) => pyLower(str(input.s)),
  float: (input) => {
    const value = pyFloat(str(input.s));
    return value === null ? { error: 'ValueError' } : value;
  },
  re: regexResult,
};

interface VectorCase {
  id: string;
  fn: string;
  input: Fields;
  expected: Json;
}

describeVectors('pycompat', (file) => {
  const cases = file.cases as unknown as VectorCase[];

  it('has cases, unique ids, and a handler for every fn', () => {
    expect(cases.length).toBeGreaterThan(0);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
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
        actual = handler(c.input);
      } catch (error) {
        failed.push(c.id + ' (threw)');
        continue;
      }
      const different =
        c.fn === 'sum' ? !sameSum(decodeNonfinite(c.expected), actual) : compareWithHeader(file, c.expected, actual).length > 0;
      if (different) {
        failed.push(c.id);
      }
    }
    expect(failed).toEqual([]);
    expect(mine.length).toBeGreaterThan(0);
  });
});

describe('JavaScript behaviour the helpers hide', () => {
  it('toFixed rounds 0.125 up where Python round() goes to the even digit', () => {
    expect((0.125).toFixed(2)).toBe('0.13');
    expect(pyRound(0.125, 2)).toBe(0.12);
    expect(pyRound(0.375, 2)).toBe(0.38);
    expect(pyRound(-0.125, 2)).toBe(-0.12);
    expect(pyRound(2.675, 2)).toBe(2.67);
  });

  it('a plain JavaScript mean is not the exact mean', () => {
    expect((0.1 + 0.2 + 0.3) / 3).not.toBe(0.2);
    expect(pyMean([0.1, 0.2, 0.3])).toBe(0.2);
    expect(pyMean([1e16, 1, -1e16])).toBe(1 / 3);
    expect(pyMean([5e-324, 0])).toBe(0);
    expect(pyMean([5e-324, 1e-323])).toBe(1e-323);
    expect(pyMean([Number.MAX_VALUE, Number.MAX_VALUE])).toBe(Number.MAX_VALUE);
  });

  it('a plain JavaScript sum is not the compensated sum of Python sum()', () => {
    expect(1.1 + 3.5999999999999996 + 1.3).not.toBe(6);
    expect(pySum([1.1, 3.5999999999999996, 1.3])).toBe(6);
    expect(1e16 + 1 + 1).toBe(1e16);
    expect(pySum([1e16, 1, 1])).toBe(1.0000000000000002e16);
    expect(1 + 1e100 + 1 + -1e100).toBe(0);
    expect(pySum([1, 1e100, 1, -1e100])).toBe(2);
    expect(pySum([])).toBe(0);
    expect(pySum([1e308, 1e308])).toBe(Infinity);
    expect(Number.isNaN(pySum([NaN, 1]))).toBe(true);
    expect(Number.isNaN(pySum([Infinity, -Infinity]))).toBe(true);
    expect(Object.is(pySum([-0]), 0)).toBe(true);
  });

  it('Number() is not float()', () => {
    expect(Number('')).toBe(0);
    expect(pyFloat('')).toBeNull();
    expect(Number('0x10')).toBe(16);
    expect(pyFloat('0x10')).toBeNull();
    expect(Number('\u{FEFF}12')).toBe(12);
    expect(pyFloat('\u{FEFF}12')).toBeNull();
    expect(pyFloat('\u{200B}12')).toBeNull();
    expect(pyFloat(' 12 ')).toBe(12);
    expect(pyFloat('1_0')).toBe(10);
    expect(pyFloat('1__0')).toBeNull();
    expect(pyFloat('\u{663}.\u{665}')).toBe(3.5);
  });

  it('pyFloat accepts the words inf and nan in any case', () => {
    expect(pyFloat('inf')).toBe(Infinity);
    expect(pyFloat('-Infinity')).toBe(-Infinity);
    expect(pyFloat(' +INF ')).toBe(Infinity);
    expect(Number.isNaN(pyFloat('nan') as number)).toBe(true);
    expect(Number.isNaN(pyFloat('-NaN') as number)).toBe(true);
    expect(pyFloat('infinit')).toBeNull();
  });

  it('pyRound returns non-finite values unchanged and refuses a bad n', () => {
    expect(pyRound(Infinity, 2)).toBe(Infinity);
    expect(pyRound(-Infinity, 2)).toBe(-Infinity);
    expect(Number.isNaN(pyRound(NaN, 2))).toBe(true);
    expect(pyRound(1e300, 9)).toBe(1e300);
    expect(() => pyRound(1.5, -1)).toThrow();
    expect(() => pyRound(1.5, 0.5)).toThrow();
  });

  it('pyMean and pyMedian refuse empty input', () => {
    expect(() => pyMean([])).toThrow();
    expect(() => pyMedian([])).toThrow();
    expect(() => pyMean([Infinity])).toThrow();
  });

  it('stableSort keeps the input order of ties and does not change its input', () => {
    const items = [
      { k: 2, name: 'a' },
      { k: 1, name: 'b' },
      { k: 2, name: 'c' },
      { k: 1, name: 'd' },
      { k: 0, name: 'e' },
    ];
    const copy = items.slice();
    const sorted = stableSort(items, (x, y) => x.k - y.k);
    expect(sorted.map((i) => i.name)).toEqual(['e', 'b', 'd', 'a', 'c']);
    expect(items).toEqual(copy);
    expect(stableSort([], (x: number, y: number) => x - y)).toEqual([]);
  });

  it('firstMax and firstMin pick the first extreme item', () => {
    const items = [
      { k: 1, name: 'a' },
      { k: 3, name: 'b' },
      { k: 3, name: 'c' },
      { k: 1, name: 'd' },
    ];
    expect(firstMax(items, (i) => i.k)?.name).toBe('b');
    expect(firstMin(items, (i) => i.k)?.name).toBe('a');
    expect(firstMax([], (i: number) => i)).toBeUndefined();
    expect(firstMin([-2, -5, -5], (i) => i)).toBe(-5);
  });

  it('the text helpers use Python whitespace and digits, not the JavaScript sets', () => {
    expect(pyIsSpace('\u{1C}')).toBe(true);
    expect('\u{1C}'.trim()).toBe('\u{1C}');
    expect(pyIsSpace('\u{200B}')).toBe(false);
    expect(pySplit(' a\u{A0}\u{A0}b  c ')).toEqual(['a', 'b', 'c']);
    expect(pyStrip('\u{3000} x \u{2003}')).toBe('x');
    expect(pyIsDigit('\u{B2}')).toBe(true);
    expect(pyIsDecimal('\u{B2}')).toBe(false);
    expect(digitsToAscii('\u{FF11}\u{661}x')).toBe('11x');
    expect(pySlice('\u{1F600}ab', 2)).toBe('\u{1F600}a');
    expect(pyLower('\u{130}')).toBe('i\u{307}');
  });

  it('pyEscape output is valid in u mode', () => {
    const text = '(a+b)?[c]{2}|d^$\\/.-#&~: ';
    expect(new RegExp('^' + pyEscape(text) + '$', 'u').test(text)).toBe(true);
  });

  it('PY_WORD_CLASS matches exactly the code points of python_unicode.word_ranges (0..0x10FFFF)', () => {
    const member = new Uint8Array(0x110000);
    for (const [first, last] of engineConstants.python_unicode.word_ranges) {
      member.fill(1, first, last + 1);
    }
    const pattern = new RegExp('^' + PY_WORD_CLASS + '$', 'u');
    let mismatches = 0;
    const firstFew: string[] = [];
    for (let c = 0; c <= 0x10ffff; c += 1) {
      if (pattern.test(String.fromCodePoint(c)) !== (member[c] === 1)) {
        mismatches += 1;
        if (firstFew.length < 5) {
          firstFew.push('U+' + c.toString(16).toUpperCase());
        }
      }
    }
    expect({ mismatches, firstFew }).toEqual({ mismatches: 0, firstFew: [] });
  }, 60000);
});
