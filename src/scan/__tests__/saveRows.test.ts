// toSavedReport (MOB-03 steps 8 and 9). The e1 case (row_E1_e1_manifest_history of docs/engine_vectors/endtoend.json) and every case
// of ml/tests/fixtures/mlkit/engine_vectors/real_pages_scoring.json go through readPayload, scoreRowsForTests (the vector weights) and toSavedReport.
// Expected values are read from the Contract B of the scored result, not typed here; the step 9 fields are checked against
// the Contract A row of the pair, and the plan's rows (SV1 to SV5, RB11) are typed literals. The real-page files hold
// sanitized report text, so those tests report counts and case ids only, and they are skipped when the files are absent.
import * as fs from 'fs';
import * as path from 'path';
import { Json, loadVectorFile, readJsonNormalized } from '../../engine/__tests__/helpers/vectors';
import { reviewReasons } from '../../engine';
import { rangeWithBasis, statusFor } from '../display';
import { applyRangeAnswer, ReadResult, readPayload, RowPair, ScoreResult, scoreRows, scoreRowsForTests } from '../runEngine';
import { SavedRow, toSavedReport } from '../saveRows';

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
}

interface RealFile {
  payloads: { [key: string]: Json };
  cases: Array<{ id: string; fn: string }>;
}

const E1_ID = 'row_E1_e1_manifest_history';
const EXPECTED_REAL = 12;
const PARSE_FN = 'parsing.parser.parse_report';
const SV1_ID = 'row_ML10_T14_real_urine_ph_no_range_printed';

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

interface Totals {
  processed: number;
  problems: string[];
}

/** Checks one case; returns the problems found, as short labels (never report text). */
function checkCase(id: string, payloads: { [key: string]: Json }, source: ParseCase, c: ScoreCase): string[] {
  const read = readCase(payloads, source);
  if (read.kind !== 'read') {
    return [id + ': not read'];
  }
  const scored = scoreRowsForTests(read.record.results, read.record.visit_date as string, c.input.history, c.input.weights);
  if (scored.kind !== 'scored') {
    return [id + ': not scored'];
  }
  const out = toSavedReport(scored, read.record);
  if (out.kind !== 'saved') {
    return [id + ': not saved'];
  }
  const problems: string[] = [];
  const parameters = scored.contractB.parameters;
  if (out.rows.length !== parameters.length) {
    problems.push(id + ': row count');
  }
  if (JSON.stringify(JSON.parse(out.report.contractBJson)) !== JSON.stringify(scored.contractB)) {
    problems.push(id + ': contractBJson');
  }
  if (typeof out.report.parserVersion !== 'string' || out.report.parserVersion === '') {
    problems.push(id + ': parserVersion');
  }
  if (typeof out.report.dictionaryVersion !== 'string' || out.report.dictionaryVersion === '') {
    problems.push(id + ': dictionaryVersion');
  }
  if (out.report.visitDay !== scored.contractB.visit_date) {
    problems.push(id + ': visitDay');
  }
  out.rows.forEach((row, index) => {
    const b = parameters[index];
    const valueStd = typeof b.value === 'number' && Number.isFinite(b.value) ? b.value : null;
    const same =
      row.severity === b.severity &&
      row.direction === b.direction &&
      row.range_basis === b.range_basis &&
      row.canonical_code === b.canonical_code &&
      row.test_name === b.test_name &&
      row.value_std === valueStd &&
      row.unit === (b.unit === null ? '' : b.unit) &&
      row.position === index &&
      row.status === statusFor(b.severity, b.direction);
    if (!same) {
      problems.push(id + ': row ' + String(index));
    }
    const a = scored.pairs[index].a;
    const confidence = typeof a.confidence === 'number' && Number.isFinite(a.confidence) ? a.confidence : null;
    const flag = typeof a.flag === 'string' ? a.flag : null;
    const low = typeof a.ref_low === 'number' && Number.isFinite(a.ref_low) ? a.ref_low : null;
    const high = typeof a.ref_high === 'number' && Number.isFinite(a.ref_high) ? a.ref_high : null;
    const converted = a.reported_value !== null && a.reported_value !== undefined;
    if (row.confidence !== confidence) {
      problems.push(id + ': row ' + String(index) + ' confidence');
    }
    if (row.flag !== flag) {
      problems.push(id + ': row ' + String(index) + ' flag');
    }
    if (row.review_reasons !== JSON.stringify(reviewReasons(a))) {
      problems.push(id + ': row ' + String(index) + ' review_reasons');
    }
    if (row.normal_range !== rangeWithBasis(low, high, b.range_basis, converted ? b.unit : null)) {
      problems.push(id + ': row ' + String(index) + ' normal_range');
    }
  });
  return problems;
}

function replay(cases: ScoreCase[], parseCases: ParseCase[], payloads: { [key: string]: Json }): Totals {
  const totals: Totals = { processed: 0, problems: [] };
  cases.forEach((c) => {
    const source = parseCases.find((p) => p.id === c.input.parse_case) as ParseCase;
    totals.processed += 1;
    totals.problems.push(...checkCase(c.id, payloads, source, c));
  });
  return totals;
}

describe('toSavedReport on the e1 case', () => {
  const file = loadVectorFile('endtoend');
  const parseFile = loadVectorFile('parse');
  const present = file !== null && parseFile !== null;
  const it_ = present ? it : it.skip;
  const cases = ((present ? file.cases : []) as unknown as ScoreCase[]).filter((c) => c.id === E1_ID);
  const parseCases = (present ? parseFile.cases : []) as unknown as ParseCase[];
  const payloads = present ? (parseFile as unknown as { payloads: { [key: string]: Json } }).payloads : {};

  it_('finds the one e1 case', () => {
    expect(cases.length).toBe(1);
  });

  it_('saves one row per Contract B parameter, equal to the parameter (problems listed by case id)', () => {
    const totals = replay(cases, parseCases, payloads);
    expect(totals.processed).toBe(1);
    expect(totals.problems).toEqual([]);
  });

  it_('does not change the record or the scored result', () => {
    const c = cases[0];
    const source = parseCases.find((p) => p.id === c.input.parse_case) as ParseCase;
    const read = readCase(payloads, source);
    expect(read.kind).toBe('read');
    if (read.kind !== 'read') {
      return;
    }
    const scored = scoreRowsForTests(read.record.results, read.record.visit_date as string, c.input.history, c.input.weights);
    const before = JSON.stringify([read.record, scored]);
    toSavedReport(scored, read.record);
    expect(JSON.stringify([read.record, scored])).toBe(before);
  });
});

describeReal('toSavedReport on real_pages_scoring.json', () => {
  const pages = readJsonNormalized(PAGES) as unknown as RealFile;
  const scoring = readJsonNormalized(SCORING) as unknown as RealFile;
  const cases = scoring.cases as unknown as ScoreCase[];
  const parseCases = pages.cases.filter((c) => c.fn === PARSE_FN) as unknown as ParseCase[];

  it(`saves rows equal to the Contract B for all ${EXPECTED_REAL} cases (problems listed by case id)`, () => {
    const totals = replay(cases, parseCases, pages.payloads);
    expect(totals.processed).toBe(EXPECTED_REAL);
    expect(totals.problems).toEqual([]);
  });
});

describeReal('row SV1 (a saved row after the answer "No range is printed")', () => {
  const pages = readJsonNormalized(PAGES) as unknown as RealFile;
  const s1 = pages.cases.find((c) => c.id === SV1_ID) as unknown as { input: { parse_case: string; canonical_code: string } };
  const parseCases = pages.cases.filter((c) => c.fn === PARSE_FN) as unknown as ParseCase[];
  const source = parseCases.find((p) => p.id === (s1 ? s1.input.parse_case : '')) as ParseCase;

  it('saves the confidence of the answered row, 0.7897', () => {
    expect(s1).toBeDefined();
    const read = readCase(pages.payloads, source);
    expect(read.kind).toBe('read');
    if (read.kind !== 'read') {
      return;
    }
    const index = read.record.results.findIndex((r) => r.canonical_code === s1.input.canonical_code);
    expect(index).toBeGreaterThanOrEqual(0);
    const answered = applyRangeAnswer(read.record.results[index], null, null);
    expect(answered.ok).toBe(true);
    if (!answered.ok) {
      return;
    }
    const results = read.record.results.map((r, i) => (i === index ? answered.row : r));
    const scored = scoreRows(results, read.record.visit_date as string, {});
    expect(scored.kind).toBe('scored');
    if (scored.kind !== 'scored') {
      return;
    }
    const out = toSavedReport(scored, read.record);
    expect(out.kind).toBe('saved');
    if (out.kind !== 'saved') {
      return;
    }
    const saved = out.rows.filter((r) => r.canonical_code === s1.input.canonical_code);
    expect(saved.length).toBe(1);
    expect(saved[0].confidence).toBe(answered.row.confidence);
    expect(saved[0].confidence).toBeCloseTo(0.7897, 4);
  });
});

/** A minimal pair with made-up names; the parameter fields may be overridden. */
function pair(b: { [key: string]: unknown } = {}, a: { [key: string]: unknown } = {}): RowPair {
  return {
    a: { test_name: 'alpha', ref_low: 1, ref_high: 2, ref_source: 'printed', value_source: 'cell', ...a } as never,
    b: {
      canonical_code: 'alpha_code',
      test_name: 'alpha',
      value: 1.5,
      unit: 'u',
      severity: 'normal',
      direction: null,
      trend: null,
      value_text: null,
      range_basis: 'printed',
      ...b,
    } as never,
  };
}

function scoredOf(pairs: RowPair[]): ScoreResult {
  return { kind: 'scored', contractB: { visit_date: '2026-03-04', overall: {}, parameters: pairs.map((p) => p.b) } as never, pairs };
}

const RECORD = { parser_version: '9.9.9', dictionary_version: '8.8.8', visit_date: '2026-03-04', results: [] } as never;

function savedRows(pairs: RowPair[]): SavedRow[] {
  const out = toSavedReport(scoredOf(pairs), RECORD);
  expect(out.kind).toBe('saved');
  return out.kind === 'saved' ? out.rows : [];
}

describe('toSavedReport on made-up rows', () => {
  it('copies the parameter fields and the limits of the paired row', () => {
    const rows = savedRows([pair({ severity: 'mild', direction: 'high', result_type: 'numeric' })]);
    expect(rows.length).toBe(1);
    expect(rows[0]).toEqual({
      test_name: 'alpha',
      canonical_code: 'alpha_code',
      severity: 'mild',
      direction: 'high',
      range_basis: 'printed',
      result_type: 'numeric',
      value_std: 1.5,
      ref_low: 1,
      ref_high: 2,
      ref_source: 'printed',
      value_source: 'cell',
      position: 0,
      value: '1.5',
      unit: 'u',
      normal_range: '1 - 2',
      status: 'high',
      confidence: null,
      review_reasons: '["low_confidence"]',
      flag: null,
    });
  });

  it('reads the versions from the record', () => {
    const out = toSavedReport(scoredOf([pair()]), RECORD);
    expect(out.kind === 'saved' ? out.report.parserVersion : '').toBe('9.9.9');
    expect(out.kind === 'saved' ? out.report.dictionaryVersion : '').toBe('8.8.8');
  });

  it('is could_not_read for an abnormal severity with direction null', () => {
    expect(toSavedReport(scoredOf([pair({ severity: 'mild', direction: null })]), RECORD)).toEqual({ kind: 'could_not_read' });
  });

  it('is could_not_read for a severity that is not recognised', () => {
    expect(toSavedReport(scoredOf([pair({ severity: 'beta' })]), RECORD)).toEqual({ kind: 'could_not_read' });
  });

  it('is could_not_read for a result that is not scored', () => {
    expect(toSavedReport({ kind: 'could_not_read' }, RECORD)).toEqual({ kind: 'could_not_read' });
  });

  it('is could_not_read when the record has no version', () => {
    expect(toSavedReport(scoredOf([pair()]), { visit_date: '2026-03-04', results: [] } as never)).toEqual({ kind: 'could_not_read' });
  });

  it('shows the value_text of a qualitative row and saves value_std as null', () => {
    const rows = savedRows([pair({ value: null, value_text: 'positive', result_type: 'qualitative' })]);
    expect(rows[0].value).toBe('positive');
    expect(rows[0].value_std).toBeNull();
  });

  it('shows an empty value for a row with no value and no text', () => {
    const rows = savedRows([pair({ value: null, value_text: null, severity: 'unreadable' })]);
    expect(rows[0].value).toBe('');
    expect(rows[0].value_std).toBeNull();
    expect(rows[0].status).toBe('unknown');
  });

  it('saves a null unit as an empty text and a missing result_type as null', () => {
    const rows = savedRows([pair({ unit: null })]);
    expect(rows[0].unit).toBe('');
    expect(rows[0].result_type).toBeNull();
  });

  it('saves null limits and sources when the paired row has none', () => {
    const rows = savedRows([pair({}, { ref_low: null, ref_high: null, ref_source: undefined, value_source: undefined })]);
    expect(rows[0].ref_low).toBeNull();
    expect(rows[0].ref_high).toBeNull();
    expect(rows[0].ref_source).toBeNull();
    expect(rows[0].value_source).toBeNull();
    expect(rows[0].normal_range).toBe('');
  });

  it('numbers the rows by their place in the Contract B', () => {
    const rows = savedRows([pair({ test_name: 'alpha' }), pair({ test_name: 'beta' }), pair({ test_name: 'gamma' })]);
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2]);
    expect(rows.map((r) => r.test_name)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('keeps the whole Contract B as JSON that parses back to the same object', () => {
    const scored = scoredOf([pair(), pair({ test_name: 'beta' })]);
    const out = toSavedReport(scored, RECORD);
    expect(out.kind).toBe('saved');
    if (out.kind === 'saved' && scored.kind === 'scored') {
      expect(JSON.parse(out.report.contractBJson)).toEqual(JSON.parse(JSON.stringify(scored.contractB)));
    }
  });

  it('does not change its inputs', () => {
    const scored = scoredOf([pair({ severity: 'mild', direction: 'low' })]);
    const before = JSON.stringify([scored, RECORD]);
    toSavedReport(scored, RECORD);
    expect(JSON.stringify([scored, RECORD])).toBe(before);
  });
});

/** The made-up supported alt row of the plan (value 38 U/L, no limits); fields may be overridden. */
function altRow(over: { [key: string]: unknown } = {}): { [key: string]: unknown } {
  return {
    test_name: 'alt',
    canonical_code: 'alt',
    result_type: 'numeric',
    value: 38,
    unit: 'U/L',
    ref_low: null,
    ref_high: null,
    ref_source: null,
    value_source: 'ocr',
    supported: true,
    ...over,
  };
}

function reasonsOf(a: { [key: string]: unknown }): string {
  return savedRows([pair({ canonical_code: 'alt' }, a)])[0].review_reasons;
}

describe('toSavedReport review reasons, confidence and flag (rows SV2 to SV4)', () => {
  it('SV2: a supported alt row with no limits lists the reasons still open', () => {
    expect(reasonsOf(altRow({ confidence: 0.95 }))).toBe('["missing_range"]');
    expect(reasonsOf(altRow({ confidence: null }))).toBe('["low_confidence","missing_range"]');
    expect(reasonsOf(altRow({ confidence: 0.6999 }))).toBe('["low_confidence","missing_range"]');
    expect(reasonsOf(altRow({ confidence: 0.7 }))).toBe('["missing_range"]');
  });

  it('SV2b: the threshold is exact at the neighbours of 0.70', () => {
    expect(reasonsOf(altRow({ confidence: 0.6999999999999999 }))).toBe('["low_confidence","missing_range"]');
    expect(reasonsOf(altRow({ confidence: 0.7000000000000001 }))).toBe('["missing_range"]');
  });

  it('SV2c: a row with no value lists missing_value before missing_range', () => {
    expect(reasonsOf(altRow({ value: null, confidence: 0.95 }))).toBe('["missing_value","missing_range"]');
  });

  it('SV3: after the answer "No range is printed" the range reason is gone', () => {
    const sure = applyRangeAnswer(altRow({ confidence: 0.95 }) as never, null, null);
    expect(sure.ok).toBe(true);
    if (sure.ok) {
      expect(reasonsOf(sure.row)).toBe('[]');
    }
    const unsure = applyRangeAnswer(altRow({ confidence: null }) as never, null, null);
    expect(unsure.ok).toBe(true);
    if (unsure.ok) {
      expect(reasonsOf(unsure.row)).toBe('["low_confidence"]');
    }
  });

  it('SV4: saves the confidence and the lab flag of the Contract A row, or null', () => {
    const flagged = savedRows([pair({}, { flag: 'H', confidence: 0.9 })])[0];
    expect(flagged.flag).toBe('H');
    expect(flagged.confidence).toBe(0.9);
    expect(savedRows([pair({}, { flag: null })])[0].flag).toBeNull();
    expect(savedRows([pair()])[0].flag).toBeNull();
    expect(savedRows([pair({}, { confidence: Number.NaN })])[0].confidence).toBeNull();
  });
});

describe('toSavedReport check-up day (row SV5)', () => {
  const record = { parser_version: '9.9.9', dictionary_version: '8.8.8', visit_date: '2026-07-09', results: [] } as never;

  function scoredOn(date: unknown): ScoreResult {
    const scored = scoredOf([pair()]);
    if (scored.kind === 'scored') {
      (scored.contractB as unknown as { visit_date: unknown }).visit_date = date;
    }
    return scored;
  }

  it('is could_not_read when the Contract B date differs from the record date', () => {
    expect(toSavedReport(scoredOn('2026-07-08'), record)).toEqual({ kind: 'could_not_read' });
  });

  it('is could_not_read when the Contract B date is not a text', () => {
    expect(toSavedReport(scoredOn(null), record)).toEqual({ kind: 'could_not_read' });
  });

  it('saves visitDay from the Contract B when the dates agree', () => {
    const matching = { parser_version: '9.9.9', dictionary_version: '8.8.8', visit_date: '2026-07-08', results: [] } as never;
    const out = toSavedReport(scoredOn('2026-07-08'), matching);
    expect(out.kind).toBe('saved');
    expect(out.kind === 'saved' ? out.report.visitDay : '').toBe('2026-07-08');
  });
});

describe('toSavedReport range text with its basis (row RB11 and others)', () => {
  const rangeOf = (b: { [key: string]: unknown }, a: { [key: string]: unknown }): string => savedRows([pair(b, a)])[0].normal_range;

  it('RB11: a converted row names the unit the limits were converted to', () => {
    const b = { range_basis: 'lab_range', unit: 'mg/dL' };
    expect(rangeOf(b, { ref_low: 3.9, ref_high: 5.5, reported_value: 70 })).toBe('3.9 - 5.5 (printed range, converted to mg/dL)');
    expect(rangeOf(b, { ref_low: 3.9, ref_high: 5.5, reported_value: null })).toBe('3.9 - 5.5 (printed range)');
  });

  it('shows a lab range that was not converted with its basis', () => {
    expect(rangeOf({ range_basis: 'lab_range' }, { ref_low: 7, ref_high: 56 })).toBe('7 - 56 (printed range)');
  });

  it('shows a guideline row with a printed bound, and without limits', () => {
    expect(rangeOf({ range_basis: 'guideline' }, { ref_low: 50, ref_high: null })).toBe(
      'low limit 50 (printed range); status by guideline cut-off',
    );
    expect(rangeOf({ range_basis: 'guideline' }, { ref_low: null, ref_high: null })).toBe('status by guideline cut-off');
  });
});
