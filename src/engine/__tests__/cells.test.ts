// Cell typing (ML-27/ML-28, S6): every case of docs/engine_vectors/cells.json must be reproduced exactly (decision D4),
// plus direct checks of the Python quirks the port exists to get right. Only counts and case ids are ever reported,
// never case text. The expected values of the direct checks are read from the vector file, not typed here.
import {
  canonicalUnit,
  classifyCell,
  fixNumeric,
  isUnit,
  normalizeText,
  normalizeUnitText,
  parseRange,
  toFloat,
} from '../parsing/extract';
import { normalizeQualitative } from '../parsing/qualitative';
import { pyStrip } from '../py/text';
import { compareWithHeader, describeVectors, Json } from './helpers/vectors';

type Handler = (input: Json) => Json;

function str(value: Json): string {
  if (typeof value !== 'string') {
    throw new Error('expected a string input');
  }
  return value;
}

const HANDLERS: { [fn: string]: Handler } = {
  'parsing.extract.classify_cell': (input) => ({ ...classifyCell(str(input)) }),
  'parsing.extract.parse_range': (input) => {
    const typed = parseRange(str(input));
    return typed === null ? null : { ...typed };
  },
  'parsing.extract.fix_numeric': (input) => fixNumeric(str(input)),
  'parsing.extract.canonical_unit': (input) => canonicalUnit(str(input)),
  'parsing.extract.is_unit': (input) => isUnit(str(input)),
  'parsing.extract.normalize_text': (input) => normalizeText(str(input)),
  'parsing.extract.normalize_unit_text': (input) => normalizeUnitText(str(input)),
  'parsing.extract.to_float': (input) => toFloat(str(input)),
  'scoring.extensions.normalize_qualitative': (input) => normalizeQualitative(input === null ? null : str(input)),
};

interface VectorCase {
  id: string;
  fn: string;
  input: Json;
  expected: Json;
}

function expectedOf(cases: VectorCase[], fn: string, input: string): Json {
  const found = cases.find((c) => c.fn === fn && c.input === input);
  if (found === undefined) {
    throw new Error('the vector file has no case for ' + fn);
  }
  return found.expected;
}

describeVectors('cells', (file) => {
  const cases = file.cases as unknown as VectorCase[];

  it('has cases, unique ids, and a handler for every fn', () => {
    expect(cases.length).toBeGreaterThan(0);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    const unknown = Array.from(new Set(cases.map((c) => c.fn))).filter((fn) => HANDLERS[fn] === undefined);
    expect(unknown).toEqual([]);
    expect(Object.keys(HANDLERS).filter((fn) => !cases.some((c) => c.fn === fn))).toEqual([]);
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
      if (compareWithHeader(file, c.expected, actual).length > 0) {
        failed.push(c.id);
      }
    }
    expect(failed).toEqual([]);
    expect(mine.length).toBeGreaterThan(0);
  });

  describe('direct checks, expected values from the vector file', () => {
    const TO_FLOAT = 'parsing.extract.to_float';
    const CLASSIFY = 'parsing.extract.classify_cell';

    it('toFloat does not use Number(): "", "0x10" and a U+FEFF prefix are not numbers, as in Python', () => {
      // Number('') is 0, Number('0x10') is 16 and Number('﻿12') is 12; float() raises for all three
      for (const text of ['', '0x10', '﻿12']) {
        const expected = expectedOf(cases, TO_FLOAT, text);
        expect(expected).toBeNull();
        expect(toFloat(text)).toBe(expected);
      }
    });

    it('fullwidth digits parse', () => {
      const text = '１２３';
      const expected = expectedOf(cases, TO_FLOAT, text);
      expect(typeof expected).toBe('number');
      expect(toFloat(text)).toBe(expected);
      expect(classifyCell(text).value).toBe(expected);
      expect(classifyCell(text).kind).toBe('number');
    });

    it('U+FEFF is not whitespace: it stays in the cell text and is not stripped', () => {
      const text = '﻿12';
      expect(pyStrip(text)).toBe(text);
      expect(normalizeText(text)).toBe(text);
      const typed = classifyCell(text);
      expect(typed.text).toBe(text);
      expect({ ...typed }).toEqual(expectedOf(cases, CLASSIFY, text));
    });

    it('a comma is a thousands separator only in the 1,234 pattern', () => {
      for (const text of ['1,234', '12,345.6', '1,23', '1,2,3']) {
        expect(toFloat(text)).toBe(expectedOf(cases, TO_FLOAT, text));
      }
    });

    it('a table value is found by a lookup that cannot see inherited object properties', () => {
      expect(normalizeQualitative('constructor')).toBeNull();
      expect(normalizeQualitative('__proto__')).toBeNull();
      expect(normalizeQualitative(null)).toBeNull();
    });
  });
});
