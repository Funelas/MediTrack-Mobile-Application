// Review routing and typed range (ML-27/ML-28, S12): every case of docs/engine_vectors/review.json must be reproduced
// exactly (decision D4), error messages included. Three functions, four kinds of case (the file's note): split_for_review
// (the record is the expected record of a parse.json case, ready and review are indexes into record.results),
// review_reasons ({reasons, needs_review}), and apply_typed_range ({row, reasons} or {throws: message} compared exactly).
// Only counts and case ids are ever reported, never case text. Expected values are read from the vector file, not typed
// here. The index.ts test checks the public API names.
import * as api from '../index';
import { needsReview, reviewReasons, splitForReview, applyTypedRange, REVIEW_REASON_CODES, REVIEW_THRESHOLD, SCORED_WITHOUT_PRINTED_RANGE } from '../parsing/review';
import { engineConstants } from '../data';
import { compareWithHeader, describeVectors, Json, loadVectorFile } from './helpers/vectors';

type Row = { [key: string]: Json };

interface VectorCase {
  id: string;
  fn: string;
  input: { [key: string]: Json };
  expected: { [key: string]: Json };
}

const FNS = ['parsing.parser.split_for_review', 'parsing.parser.review_reasons', 'parsing.parser.apply_typed_range'];

/** A stored bound as the number it stands for: {"$number": "NaN" | "Infinity" | "-Infinity"} becomes that number. */
function decodeBound(bound: Json): Json | number {
  if (typeof bound === 'object' && bound !== null && !Array.isArray(bound)) {
    expect(Object.keys(bound)).toEqual(['$number']);
    const name = bound.$number;
    if (name === 'NaN') {
      return NaN;
    }
    if (name === 'Infinity') {
      return Infinity;
    }
    if (name === '-Infinity') {
      return -Infinity;
    }
    throw new Error('unknown encoded bound');
  }
  return bound;
}

describeVectors('review', (file) => {
  const cases = file.cases as unknown as VectorCase[];
  const parseFile = loadVectorFile('parse');
  const parseCases = (parseFile === null ? [] : parseFile.cases) as unknown as VectorCase[];

  /** The Contract A record of the parse.json case a split case refers to. */
  function recordOf(c: VectorCase): { results: Row[] } {
    const source = parseCases.find((p) => p.id === c.input.parse_case);
    expect(source).toBeDefined();
    return JSON.parse(JSON.stringify((source as VectorCase).expected.record)) as { results: Row[] };
  }

  /** The actual output of one case, in the form of the case's expected value, or {throws: message}. */
  function run(c: VectorCase): Json {
    if (c.fn === 'parsing.parser.split_for_review') {
      const record = recordOf(c);
      const split = splitForReview(record);
      const indexOf = (row: Row): number => record.results.findIndex((r) => r === row);
      return {
        reasons: record.results.map((r) => reviewReasons(r)),
        needs_review: record.results.map((r) => needsReview(r)),
        ready: split.ready.map((r) => indexOf(r as Row)),
        review: split.toReview.map((r) => indexOf(r as Row)),
      };
    }
    if (c.fn === 'parsing.parser.review_reasons') {
      const row = c.input.row as Row;
      return { reasons: reviewReasons(row), needs_review: needsReview(row) };
    }
    if (c.fn === 'parsing.parser.apply_typed_range') {
      const row = c.input.row as Row;
      const before = JSON.stringify(row);
      const low = decodeBound(c.input.low) as number | null;
      const high = decodeBound(c.input.high) as number | null;
      try {
        const out = applyTypedRange(row, low, high);
        return { row: out as Row, reasons: reviewReasons(out) };
      } catch (error) {
        if (!(error instanceof Error)) {
          throw error;
        }
        return { throws: error.message };
      } finally {
        expect(JSON.stringify(row) === before).toBe(true); // the input row is never changed (ML-10 T18)
      }
    }
    throw new Error('no handler for ' + c.fn);
  }

  /** True when the port reproduces the case exactly (a thrown message is compared whole, by compareWithHeader). */
  function passes(c: VectorCase): boolean {
    return compareWithHeader(file, c.expected, run(c)).length === 0;
  }

  const ofFn = (fn: string): VectorCase[] => cases.filter((c) => c.fn === fn);
  const throwing = cases.filter((c) => typeof c.expected.throws === 'string');

  it('has cases and unique ids, and a handler for every function used (none unused)', () => {
    expect(cases.length).toBeGreaterThan(0);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    expect(Array.from(new Set(cases.map((c) => c.fn))).sort()).toEqual([...FNS].sort());
    cases.forEach((c) => expect(FNS.includes(c.fn)).toBe(true));
  });

  it('finds the parse.json case of every split case', () => {
    expect(parseFile).not.toBeNull();
    const ids = new Set(parseCases.map((p) => p.id));
    expect(ofFn(FNS[0]).filter((c) => !ids.has(c.input.parse_case as string)).map((c) => c.id)).toEqual([]);
  });

  it.each(FNS)('reproduces every case of %s exactly', (fn) => {
    const mine = ofFn(fn);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.filter((c) => !passes(c)).map((c) => c.id)).toEqual([]);
  });

  it('throws an Error with the exact Python message for every failing apply_typed_range case', () => {
    expect(throwing.length).toBeGreaterThan(0);
    expect(throwing.every((c) => c.fn === FNS[2])).toBe(true);
    expect(throwing.filter((c) => !passes(c)).map((c) => c.id)).toEqual([]);
    const messages = Array.from(new Set(throwing.map((c) => c.expected.throws as string)));
    expect(messages.every((m) => m.startsWith('typed range: '))).toBe(true);
  });

  it('does not change the rows or records it is given', () => {
    const before = JSON.stringify(cases.map((c) => c.input));
    const beforeParse = JSON.stringify(parseCases.map((p) => p.expected));
    cases.forEach((c) => run(c));
    expect(JSON.stringify(cases.map((c) => c.input))).toBe(before);
    expect(JSON.stringify(parseCases.map((p) => p.expected))).toBe(beforeParse);
  });

  describe('the named rows of the vector completion plan and of the ML-10 plan', () => {
    it.each(['row_T', 'row_BT', 'row_V1', 'row_ML10_', 'row_OVF_'])('the cases with id prefix %s exist and pass', (prefix) => {
      const mine = cases.filter((c) => c.id.startsWith(prefix));
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.filter((c) => !passes(c)).map((c) => c.id)).toEqual([]);
    });

    it('every case with id prefix row_ exists once and passes', () => {
      const named = cases.filter((c) => c.id.startsWith('row_'));
      expect(named.length).toBeGreaterThan(0);
      expect(named.filter((c) => !passes(c)).map((c) => c.id)).toEqual([]);
    });
  });
});

describe('review constants', () => {
  it('are the ones in engine_constants.json', () => {
    expect(REVIEW_THRESHOLD).toBe(engineConstants.parser.review_threshold);
    expect([...REVIEW_REASON_CODES]).toEqual(engineConstants.parser.review_reason_codes);
    expect(Array.from(SCORED_WITHOUT_PRINTED_RANGE).sort()).toEqual([...engineConstants.parser.scored_without_printed_range].sort());
  });
});

describe('index.ts, the public API of the engine', () => {
  const functions = ['parseReport', 'needsReview', 'reviewReasons', 'splitForReview', 'applyTypedRange', 'validatePayload', 'validateA', 'buildContractB', 'validateB', 'validateC', 'checkParity'];
  const constants = ['REVIEW_THRESHOLD', 'REVIEW_REASON_CODES'];

  it('exports exactly the agreed names, each defined', () => {
    const keys = Object.keys(api).sort();
    expect(keys).toEqual([...functions, ...constants].sort());
    functions.forEach((name) => expect(typeof (api as { [key: string]: unknown })[name]).toBe('function'));
    constants.forEach((name) => expect((api as { [key: string]: unknown })[name]).toBeDefined());
  });
});
