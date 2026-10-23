// Real pages (ML-27/ML-28, S13): every case of ml/tests/fixtures/mlkit/engine_vectors/real_pages.json must be reproduced
// exactly (decision D4). The file holds sanitized real report text, so this test reports only counts and case ids, never
// payload, test-name, value or note text, and it holds no fixture text. Two kinds of case (the file's note): parse_report
// ({record, notes, split}: split is reasons and needs_review per row in order, then ready and review as indexes into
// record.results) and apply_typed_range ({row, reasons}; the row is the row of the referenced parse case's record whose
// canonical_code is given). The file sits next to the ML Kit dumps, not in docs/engine_vectors/, so it is loaded here.
// When it is absent the suite is skipped with a placeholder test, as describeVectors does. Expected values are read from
// the file, not typed here.
import * as fs from 'fs';
import * as path from 'path';
import { parseReport } from '../parsing/parser';
import { applyTypedRange, needsReview, reviewReasons, splitForReview } from '../parsing/review';
import { compare, Json, readJsonNormalized, Tolerance, VECTORS_DIR } from './helpers/vectors';

type Row = { [key: string]: Json };

interface VectorCase {
  id: string;
  fn: string;
  input: { [key: string]: Json };
  expected: { [key: string]: Json };
}

interface RealPagesFile {
  comparison: { rule: string; tolerance: Tolerance };
  payloads: { [key: string]: Json };
  payload_sources: { [key: string]: Json };
  no_payload: { [key: string]: Json };
  cases: VectorCase[];
}

const FNS = ['parsing.parser.parse_report', 'parsing.parser.apply_typed_range'];

const FIXTURE = path.resolve(VECTORS_DIR, '..', '..', 'ml', 'tests', 'fixtures', 'mlkit', 'engine_vectors', 'real_pages.json');

function has(obj: { [key: string]: Json }, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

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

function describeRealPages(fn: (file: RealPagesFile) => void): void {
  if (!fs.existsSync(FIXTURE)) {
    describe.skip('vectors: real_pages (file absent)', () => {
      it('is skipped because the vector file does not exist', () => {
        // never runs
      });
    });
    return;
  }
  describe('vectors: real_pages', () => fn(readJsonNormalized(FIXTURE) as unknown as RealPagesFile));
}

describeRealPages((file) => {
  const cases = file.cases;
  const payloads = file.payloads;
  const parseCases = cases.filter((c) => c.fn === FNS[0]);
  const typedCases = cases.filter((c) => c.fn === FNS[1]);

  /** The expected record of the parse case that a typed-range case refers to, as a fresh copy. */
  function recordOf(c: VectorCase): { results: Row[] } {
    const source = parseCases.find((p) => p.id === c.input.parse_case);
    expect(source).toBeDefined();
    return JSON.parse(JSON.stringify((source as VectorCase).expected.record)) as { results: Row[] };
  }

  /** The actual output of one case, in the form of the case's expected value. */
  function run(c: VectorCase): Json {
    if (c.fn === FNS[0]) {
      const out = parseReport(payloads[c.input.payload as string], {
        visitId: c.input.visit_id as string,
        visitDate: c.input.visit_date === '' ? null : (c.input.visit_date as string | null),
        sex: c.input.sex as string | null,
      });
      const results = out.record.results as unknown as Row[];
      const split = splitForReview(out.record);
      const indexOf = (row: Row): number => results.findIndex((r) => r === row);
      return {
        record: out.record,
        notes: out.notes,
        split: {
          reasons: results.map((r) => reviewReasons(r)),
          needs_review: results.map((r) => needsReview(r)),
          ready: split.ready.map((r) => indexOf(r as Row)),
          review: split.toReview.map((r) => indexOf(r as Row)),
        },
      } as unknown as Json;
    }
    if (c.fn === FNS[1]) {
      const record = recordOf(c);
      const row = record.results.find((r) => r.canonical_code === c.input.canonical_code);
      expect(row).toBeDefined();
      const before = JSON.stringify(row);
      const low = decodeBound(c.input.low) as number | null;
      const high = decodeBound(c.input.high) as number | null;
      const out = applyTypedRange(row as Row, low, high);
      expect(JSON.stringify(row) === before).toBe(true); // the input row is never changed (ML-10 T18)
      return { row: out as Row, reasons: reviewReasons(out) };
    }
    throw new Error('no handler for ' + c.fn);
  }

  /** The ids of the cases the port does not reproduce exactly; empty when it reproduces all of them. */
  function failedIds(): string[] {
    return cases.filter((c) => compare(c.expected, run(c), file.comparison.tolerance).length > 0).map((c) => c.id);
  }

  const failed = failedIds();

  it('has cases and unique ids, and a handler for every function used (none unused)', () => {
    expect(cases.length).toBeGreaterThan(0);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    expect(Array.from(new Set(cases.map((c) => c.fn))).sort()).toEqual([...FNS].sort());
    cases.forEach((c) => expect(FNS.includes(c.fn)).toBe(true));
    expect(parseCases.length).toBeGreaterThan(0);
    expect(typedCases.length).toBeGreaterThan(0);
  });

  it('names a payload that exists in every parse case, and a payload in every payload_sources key', () => {
    expect(parseCases.filter((c) => !has(payloads, c.input.payload as string)).map((c) => c.id)).toEqual([]);
    expect(Object.keys(file.payload_sources).filter((k) => !has(payloads, k))).toEqual([]);
    expect(Object.keys(file.no_payload).filter((k) => has(payloads, k))).toEqual([]);
  });

  it('finds the parse case of every typed-range case, with the row to type on', () => {
    const missing = typedCases.filter((c) => {
      const source = parseCases.find((p) => p.id === c.input.parse_case);
      if (source === undefined) {
        return true;
      }
      const results = (source.expected.record as unknown as { results: Row[] }).results;
      return results.filter((r) => r.canonical_code === c.input.canonical_code).length !== 1;
    });
    expect(missing.map((c) => c.id)).toEqual([]);
  });

  it('reproduces every parse_report case exactly (record, notes and split)', () => {
    expect(failed.filter((id) => parseCases.some((c) => c.id === id))).toEqual([]);
  });

  it('reproduces every apply_typed_range case exactly (row and reasons)', () => {
    expect(failed.filter((id) => typedCases.some((c) => c.id === id))).toEqual([]);
  });

  it('does not change the payloads it is given', () => {
    const before = JSON.stringify(payloads);
    cases.forEach((c) => run(c));
    expect(JSON.stringify(payloads)).toBe(before);
  });

  // The recorded result (plan S13): the count and the number of differences are in the test name.
  it(`records ${cases.length} cases, ${failed.length} differences`, () => {
    expect(failed.length).toBe(0);
    expect(cases.length - failed.length).toBe(cases.length);
  });
});
