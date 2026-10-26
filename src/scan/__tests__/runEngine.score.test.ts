// applyRangeAnswer, scoreRows and pairRows (MOB-03 step 5). Every case of docs/engine_vectors/endtoend.json and of
// ml/tests/fixtures/mlkit/engine_vectors/real_pages_scoring.json is replayed through readPayload and scoreRows, with the
// history and weights of the case. The real-page files hold sanitized report text, so this test reports counts and case
// ids only, never text, and it is skipped for those files when they are absent. Expected values are read from the vector
// files, not typed here. A parse case with no date of its own is read with the date of its expected record (the
// payload's own date, as a user who confirms the candidate would give); the result is the same as the vector's.
import * as fs from 'fs';
import * as path from 'path';
import {
  compare,
  compareWithHeader,
  decodeNonfinite,
  Json,
  loadVectorFile,
  readJsonNormalized,
  Tolerance,
  VectorFile,
} from '../../engine/__tests__/helpers/vectors';
import { applyRangeAnswer, pairRows, ReadResult, readPayload, scoreRows } from '../runEngine';

type Obj = { [key: string]: Json };
type History = { readonly [code: string]: readonly unknown[] };

interface ParseCase {
  id: string;
  fn?: string;
  input: { payload: string; visit_id: string; visit_date: string | null; sex: string | null };
  expected: { record: Obj; [key: string]: Json };
}

interface ScoreCase {
  id: string;
  input: { parse_case: string; history: History; weights: { [code: string]: unknown } };
  expected: { contract_b: Json; [key: string]: Json };
}

interface RealFile {
  comparison: { rule: string; tolerance: Tolerance };
  payloads: { [key: string]: Json };
  cases: Array<{ id: string; fn: string }>;
}

const EXPECTED_ENDTOEND = 160;
const EXPECTED_REAL = 12;
const PARSE_FN = 'parsing.parser.parse_report';
const S1_ID = 'row_ML10_T14_real_urine_ph_no_range_printed';

const FOLDER = path.resolve(__dirname, '..', '..', '..', '..', 'ml', 'tests', 'fixtures', 'mlkit', 'engine_vectors');
const PAGES = path.join(FOLDER, 'real_pages.json');
const SCORING = path.join(FOLDER, 'real_pages_scoring.json');
const REAL_PRESENT = fs.existsSync(PAGES) && fs.existsSync(SCORING);
const describeReal = REAL_PRESENT ? describe : describe.skip;

/** readPayload on the payload of a parse case, with the date of the case or, when it has none, of its expected record. */
function readCase(payloads: { [key: string]: Json }, source: ParseCase): ReadResult {
  const own = source.input.visit_date;
  const date = own === null || own === '' ? (source.expected.record.visit_date as string) : own;
  return readPayload(payloads[source.input.payload], { visitId: source.input.visit_id, visitDate: date, sex: source.input.sex });
}

interface ReplayTotals {
  total: number;
  scored: number;
  failed: string[];
  noPairs: string[];
  pairCountOff: string[];
  empty: string[];
}

/** Replays every score case; failures are case ids only. */
function replay(
  cases: ScoreCase[],
  parseCases: ParseCase[],
  payloads: { [key: string]: Json },
  same: (expected: Json, actual: Json) => string[],
): ReplayTotals {
  const totals: ReplayTotals = { total: 0, scored: 0, failed: [], noPairs: [], pairCountOff: [], empty: [] };
  cases.forEach((c) => {
    totals.total += 1;
    const source = parseCases.find((p) => p.id === c.input.parse_case) as ParseCase;
    const read = readCase(payloads, source);
    if (read.kind !== 'read') {
      totals.failed.push(c.id);
      return;
    }
    const out = scoreRows(read.record.results, read.record.visit_date as string, c.input.history, c.input.weights);
    if (out.kind !== 'scored' || same(c.expected.contract_b, out.contractB as unknown as Json).length > 0) {
      totals.failed.push(c.id);
      return;
    }
    totals.scored += 1;
    const supported = read.record.results.filter((r) => r.supported === true).length;
    if (supported === 0) {
      // a page with no supported row (for example a radiology report) scores to an empty, valid Contract B
      const expectedB = c.expected.contract_b as { parameters: Json[] };
      totals.empty.push(c.id);
      if (out.pairs.length !== 0 || expectedB.parameters.length !== 0) {
        totals.pairCountOff.push(c.id);
      }
    } else if (out.pairs.length === 0) {
      totals.noPairs.push(c.id);
    }
    if (out.pairs.length !== supported) {
      totals.pairCountOff.push(c.id);
    }
  });
  return totals;
}

describe('endtoend.json through readPayload and scoreRows', () => {
  const file = loadVectorFile('endtoend');
  const parseFile = loadVectorFile('parse');
  const present = file !== null && parseFile !== null;
  const it_ = present ? it : it.skip;
  const cases = (present ? file.cases : []) as unknown as ScoreCase[];
  const parseCases = (present ? parseFile.cases : []) as unknown as ParseCase[];
  const payloads = present ? (parseFile as unknown as { payloads: { [key: string]: Json } }).payloads : {};
  const run = (): ReplayTotals =>
    replay(cases, parseCases, payloads, (e, a) => compareWithHeader(file as VectorFile, e, a));
  const totals = present ? run() : null;

  it_(`has ${EXPECTED_ENDTOEND} cases`, () => {
    expect(cases.length).toBe(EXPECTED_ENDTOEND);
  });

  it_('gives scored with the vector Contract B for every case (failing case ids listed)', () => {
    expect((totals as ReplayTotals).failed).toEqual([]);
    expect((totals as ReplayTotals).scored).toBe(EXPECTED_ENDTOEND);
  });

  it_('pairs every scored case that has supported rows, with as many pairs as rows with supported true', () => {
    expect((totals as ReplayTotals).noPairs).toEqual([]);
    expect((totals as ReplayTotals).pairCountOff).toEqual([]);
    expect((totals as ReplayTotals).empty.length).toBeLessThan(EXPECTED_ENDTOEND);
  });

  it_('does not change the payloads or the case inputs', () => {
    const before = JSON.stringify([payloads, cases.map((c) => c.input)]);
    run();
    expect(JSON.stringify([payloads, cases.map((c) => c.input)])).toBe(before);
  });
});

describeReal('real_pages_scoring.json through readPayload and scoreRows', () => {
  const pages = readJsonNormalized(PAGES) as unknown as RealFile;
  const scoring = readJsonNormalized(SCORING) as unknown as RealFile;
  const cases = scoring.cases as unknown as ScoreCase[];
  const parseCases = pages.cases.filter((c) => c.fn === PARSE_FN) as unknown as ParseCase[];
  const tolerance = scoring.comparison.tolerance;
  const totals = replay(cases, parseCases, pages.payloads, (e, a) => compare(e, a, tolerance));

  it(`has ${EXPECTED_REAL} cases`, () => {
    expect(cases.length).toBe(EXPECTED_REAL);
  });

  it('gives scored with the vector Contract B for every case (failing case ids listed)', () => {
    expect(totals.failed).toEqual([]);
    expect(totals.scored).toBe(EXPECTED_REAL);
  });

  it('pairs every scored case that has supported rows, with as many pairs as rows with supported true', () => {
    expect(totals.noPairs).toEqual([]);
    expect(totals.pairCountOff).toEqual([]);
    expect(totals.empty.length).toBeLessThan(EXPECTED_REAL);
  });
});

describe('pairing (plan D9)', () => {
  const file = loadVectorFile('endtoend');
  const parseFile = loadVectorFile('parse');
  const present = file !== null && parseFile !== null;
  const it_ = present ? it : it.skip;

  /** The first case that scores with at least two pairs: its rows and its Contract B. */
  function sample() {
    const cases = (file as VectorFile).cases as unknown as ScoreCase[];
    const parseCases = (parseFile as VectorFile).cases as unknown as ParseCase[];
    const payloads = (parseFile as unknown as { payloads: { [key: string]: Json } }).payloads;
    for (const c of cases) {
      const source = parseCases.find((p) => p.id === c.input.parse_case) as ParseCase;
      const read = readCase(payloads, source);
      if (read.kind !== 'read') {
        continue;
      }
      const out = scoreRows(read.record.results, read.record.visit_date as string, c.input.history, c.input.weights);
      if (out.kind === 'scored' && out.pairs.length >= 2) {
        return { results: read.record.results, contractB: out.contractB };
      }
    }
    throw new Error('no case with two pairs');
  }

  it_('accepts the Contract B that was built from the same rows', () => {
    const s = sample();
    const pairs = pairRows(s.results, s.contractB);
    expect(pairs).not.toBeNull();
    expect((pairs as unknown[]).length).toBe(s.contractB.parameters.length);
  });

  it_('is could_not_read through scoreRows when the rows are not an array', () => {
    expect(scoreRows(null as never, '2026-03-04', {})).toEqual({ kind: 'could_not_read' });
  });

  it_('is null when one test_name of the Contract B differs', () => {
    const s = sample();
    const changed = JSON.parse(JSON.stringify(s.contractB));
    changed.parameters[1].test_name = changed.parameters[1].test_name + ' x';
    expect(pairRows(s.results, changed)).toBeNull();
  });

  it_('is null when a parameter is removed from the Contract B', () => {
    const s = sample();
    const changed = JSON.parse(JSON.stringify(s.contractB));
    changed.parameters.pop();
    expect(pairRows(s.results, changed)).toBeNull();
  });

  it_('is null when a parameter is added to the Contract B', () => {
    const s = sample();
    const changed = JSON.parse(JSON.stringify(s.contractB));
    changed.parameters.push(JSON.parse(JSON.stringify(changed.parameters[0])));
    expect(pairRows(s.results, changed)).toBeNull();
  });

  it_('is null when a supported row is removed from or added to the rows', () => {
    const s = sample();
    const firstSupported = s.results.findIndex((r) => r.supported === true);
    const removed = s.results.filter((_, i) => i !== firstSupported);
    expect(pairRows(removed, s.contractB)).toBeNull();
    expect(pairRows([...s.results, s.results[firstSupported]], s.contractB)).toBeNull();
  });

  it_('is null when a test_name of the rows differs', () => {
    const s = sample();
    const rows = JSON.parse(JSON.stringify(s.results)) as typeof s.results;
    const firstSupported = rows.findIndex((r) => r.supported === true);
    rows[firstSupported].test_name = rows[firstSupported].test_name + ' x';
    expect(pairRows(rows, s.contractB)).toBeNull();
  });
});

describe('applyRangeAnswer', () => {
  const review = loadVectorFile('review');
  const it_ = review === null ? it.skip : it;
  const typed = (
    (review === null ? [] : review.cases) as unknown as Array<{
      id: string;
      fn: string;
      input: { row: Obj; low: Json; high: Json };
      expected: Obj;
    }>
  ).filter((c) => c.fn === 'parsing.parser.apply_typed_range');

  it_('has apply_typed_range cases that the engine accepts and cases that it rejects', () => {
    expect(typed.filter((c) => typeof c.expected.throws === 'string').length).toBeGreaterThan(0);
    expect(typed.filter((c) => typeof c.expected.throws !== 'string').length).toBeGreaterThan(0);
  });

  it_('gives ok false for every answer the engine rejects, with no message', () => {
    const rejected = typed.filter((c) => typeof c.expected.throws === 'string');
    const wrong = rejected.filter((c) => {
      const out = applyRangeAnswer(
        c.input.row as never,
        decodeNonfinite(c.input.low) as number | null,
        decodeNonfinite(c.input.high) as number | null,
      );
      return out.ok !== false || Object.keys(out).join() !== 'ok';
    });
    expect(wrong.map((c) => c.id)).toEqual([]);
  });

  it_('gives ok true with the engine row for every answer the engine accepts', () => {
    const accepted = typed.filter((c) => typeof c.expected.throws !== 'string');
    const wrong = accepted.filter((c) => {
      const before = JSON.stringify(c.input.row);
      const out = applyRangeAnswer(
        c.input.row as never,
        decodeNonfinite(c.input.low) as number | null,
        decodeNonfinite(c.input.high) as number | null,
      );
      return (
        !out.ok ||
        compareWithHeader(review as VectorFile, c.expected.row, out.row as unknown as Json).length > 0 ||
        JSON.stringify(c.input.row) !== before
      );
    });
    expect(wrong.map((c) => c.id)).toEqual([]);
  });
});

describeReal('row S1 (a numeric analyte with no limits, no dictionary default shipped)', () => {
  const pages = readJsonNormalized(PAGES) as unknown as RealFile;
  const s1 = pages.cases.find((c) => c.id === S1_ID) as unknown as {
    input: { parse_case: string; canonical_code: string; low: number | null; high: number | null };
    expected: { row: Json };
  };
  const parseCases = pages.cases.filter((c) => c.fn === PARSE_FN) as unknown as ParseCase[];
  const source = parseCases.find((p) => p.id === (s1 ? s1.input.parse_case : '')) as ParseCase;
  const tolerance = pages.comparison.tolerance;

  it('has the case, with no range printed', () => {
    expect(s1).toBeDefined();
    expect(s1.input.low).toBeNull();
    expect(s1.input.high).toBeNull();
  });

  it('applies the answer "No range is printed" to give the vector row', () => {
    const read = readCase(pages.payloads, source);
    expect(read.kind).toBe('read');
    if (read.kind !== 'read') {
      return;
    }
    const rows = read.record.results.filter((r) => r.canonical_code === s1.input.canonical_code);
    expect(rows.length).toBe(1);
    const before = JSON.stringify(rows[0]);
    const out = applyRangeAnswer(rows[0], null, null);
    expect(out.ok).toBe(true);
    if (!out.ok) {
      return;
    }
    expect(compare(s1.expected.row, out.row as unknown as Json, tolerance)).toEqual([]);
    expect(JSON.stringify(rows[0])).toBe(before);
  });

  it('scores the row as indeterminate with direction null and trend null', () => {
    const read = readCase(pages.payloads, source);
    expect(read.kind).toBe('read');
    if (read.kind !== 'read') {
      return;
    }
    const index = read.record.results.findIndex((r) => r.canonical_code === s1.input.canonical_code);
    const answered = applyRangeAnswer(read.record.results[index], null, null);
    expect(answered.ok).toBe(true);
    if (!answered.ok) {
      return;
    }
    const results = read.record.results.map((r, i) => (i === index ? answered.row : r));
    const out = scoreRows(results, read.record.visit_date as string, {});
    expect(out.kind).toBe('scored');
    if (out.kind !== 'scored') {
      return;
    }
    const pair = out.pairs.find((p) => p.a === answered.row);
    expect(pair).toBeDefined();
    const b = (pair as { b: { severity: string; direction: unknown; trend: unknown } }).b;
    expect(b.severity).toBe('indeterminate');
    expect(b.direction).toBeNull();
    expect(b.trend).toBeNull();
  });
});
