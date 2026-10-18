// Schema validators (ML-27/ML-28, S10): every case of docs/engine_vectors/validators.json must give the same
// {valid, count, paths} as validate_payload and validate_a in Python (decision D11: counts and Python-form paths,
// never messages). Only counts and case ids are ever reported, never document text.
import { ValidationResult, validateA, validatePayload } from '../contracts/validate';
import { compareWithHeader, describeVectors, Json } from './helpers/vectors';

const FNS: { [fn: string]: (doc: unknown) => ValidationResult } = {
  'contracts.contract_checks.validate_payload': validatePayload,
  'contracts.contract_checks.validate_a': validateA,
};

interface VectorCase {
  id: string;
  fn: string;
  input: Json;
  expected: { valid: boolean; count: number; paths: string[] };
}

function summary(result: ValidationResult): Json {
  return {
    valid: result.valid,
    count: result.errors.length,
    paths: result.errors.map((error) => error.path).sort(),
  };
}

describeVectors('validators', (file) => {
  const cases = file.cases as unknown as VectorCase[];

  it('has cases, unique ids, and a function for every fn', () => {
    expect(cases.length).toBeGreaterThan(0);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    const unknown = Array.from(new Set(cases.map((c) => c.fn))).filter((fn) => FNS[fn] === undefined);
    expect(unknown).toEqual([]);
  });

  it('has valid and invalid cases for both documents', () => {
    for (const fn of Object.keys(FNS)) {
      const mine = cases.filter((c) => c.fn === fn);
      expect(mine.some((c) => c.expected.valid)).toBe(true);
      expect(mine.some((c) => !c.expected.valid)).toBe(true);
    }
  });

  it.each(Object.keys(FNS))('reproduces {valid, count, paths} of every case of %s', (fn) => {
    const mine = cases.filter((c) => c.fn === fn);
    const failed: string[] = [];
    for (const c of mine) {
      let actual: Json;
      try {
        actual = summary(FNS[fn](c.input));
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

describe('validators, direct checks', () => {
  const page = { page_index: 0, width: 10, height: 10, elements: [{ text: 'a', box: [0, 0, 1, 1], confidence: null }] };
  const payload = { visit_date: null, report_type: null, page_count: 1, pages: [page] };

  it('accepts a minimal payload and reports the root for a document that is not an object', () => {
    expect(validatePayload(payload)).toEqual({ valid: true, errors: [] });
    expect(validatePayload([]).errors.map((e) => e.path)).toEqual(['<root>']);
    expect(validatePayload(null).errors.map((e) => e.path)).toEqual(['<root>']);
  });

  it('gives one error for several extra properties of one object', () => {
    const result = validatePayload({ ...payload, extra_one: 1, extra_two: 2 });
    expect(result.errors.map((e) => e.path)).toEqual(['<root>']);
  });

  it('counts a date that does not exist as an error', () => {
    for (const date of ['2026-02-29', '2026-7-08', '20260708']) {
      expect(validatePayload({ ...payload, visit_date: date }).errors.map((e) => e.path)).toEqual(['visit_date']);
    }
    expect(validatePayload({ ...payload, visit_date: '2028-02-29' }).valid).toBe(true);
  });

  it('counts the characters of a text by code point, not by UTF-16 unit', () => {
    const withText = (text: string): unknown => ({ ...payload, pages: [{ ...page, elements: [{ ...page.elements[0], text }] }] });
    expect(validatePayload(withText('\u{1F600}'.repeat(200))).valid).toBe(true);
    expect(validatePayload(withText('\u{1F600}'.repeat(201))).errors.map((e) => e.path)).toEqual(['pages/0/elements/0/text']);
    expect(validatePayload(withText('')).errors.map((e) => e.path)).toEqual(['pages/0/elements/0/text']);
  });

  it('runs the code rules of validateA only when the schema found no errors', () => {
    const row = {
      test_name: 't',
      canonical_code: 'not_a_code',
      result_type: 'numeric',
      value: 1,
      value_text: null,
      value_low: null,
      value_high: null,
      unit: null,
      reported_value: null,
      reported_unit: null,
      ref_low: null,
      ref_high: null,
      ref_source: 'printed',
      confidence: null,
      confidence_source: null,
      value_source: 'ocr',
      flag: null,
      supported: true,
    };
    const record = {
      visit_id: 'v',
      visit_date: '2026-07-08',
      report_type: null,
      page_count: 1,
      parser_version: 'p',
      dictionary_version: 'd',
      narrative_text: null,
      results: [row],
    };
    expect(validateA(record).errors.map((e) => e.path)).toEqual(['results/0', 'results/0']);
    expect(validateA({ ...record, page_count: 0 }).errors.map((e) => e.path)).toEqual(['page_count']);
    expect(validateA({ ...record, results: [{ ...row, canonical_code: 'constructor', ref_source: null }] }).errors.map((e) => e.path)).toEqual(['results/0']);
    expect(validateA({ ...record, results: [{ ...row, canonical_code: null, ref_source: null }] }).valid).toBe(true);
  });
});
