// Parser (ML-27/ML-28, S11b): every case of docs/engine_vectors/parse.json must be reproduced exactly (decision D4):
// {record, notes} compared exactly, or an Error whose message starts with the {throws: prefix} of the case. Only counts
// and case ids are ever reported, never case text or payload text. Expected values are read from the vector file, not
// typed here, except the V17 confidence products, which are typed from the plan and cross-checked against the cases
// row_V17_*. The payload of a case is a key of the file's top-level payloads object (see the file's note).
import { engineConstants } from '../data';
import { parseReport } from '../parsing/parser';
import { compareWithHeader, describeVectors, Json } from './helpers/vectors';

interface VectorCase {
  id: string;
  fn: string;
  input: { payload: string; visit_id: string; visit_date: string | null; sex: string | null };
  expected: { [key: string]: Json };
}

/** The outcome of one case: the actual record and notes, or the message of the Error that was thrown. */
type Outcome = { ok: true; value: Json } | { ok: false; message: string };

describeVectors('parse', (file) => {
  const cases = file.cases as unknown as VectorCase[];
  const payloads = (file as unknown as { payloads: { [key: string]: Json } }).payloads;

  /** Runs parseReport on a case the way the file's note describes: '' or null for the date means 'not given'. */
  function run(c: VectorCase): Outcome {
    const payload = payloads[c.input.payload];
    try {
      const out = parseReport(payload, {
        visitId: c.input.visit_id,
        visitDate: c.input.visit_date === '' ? null : c.input.visit_date,
        sex: c.input.sex,
      });
      return { ok: true, value: { record: out.record, notes: out.notes } as unknown as Json };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '' };
    }
  }

  /** True when the port reproduces the case exactly. */
  function passes(c: VectorCase): boolean {
    const outcome = run(c);
    if (typeof c.expected.throws === 'string') {
      return !outcome.ok && outcome.message.startsWith(c.expected.throws);
    }
    return outcome.ok && compareWithHeader(file, c.expected, outcome.value).length === 0;
  }

  const throwing = cases.filter((c) => typeof c.expected.throws === 'string');
  const succeeding = cases.filter((c) => typeof c.expected.throws !== 'string');

  it('has cases and unique ids, and every case names a payload that exists', () => {
    expect(cases.length).toBeGreaterThan(0);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    const missing = cases.filter((c) => !Object.prototype.hasOwnProperty.call(payloads, c.input.payload)).map((c) => c.id);
    expect(missing).toEqual([]);
    expect(cases.every((c) => c.fn === 'parsing.parser.parse_report')).toBe(true);
  });

  it('reproduces every record and every note list exactly', () => {
    expect(succeeding.length).toBeGreaterThan(0);
    expect(succeeding.filter((c) => !passes(c)).map((c) => c.id)).toEqual([]);
  });

  it('throws an Error with the Python message prefix for every failing case', () => {
    expect(throwing.length).toBeGreaterThan(0);
    expect(throwing.filter((c) => !passes(c)).map((c) => c.id)).toEqual([]);
    const prefixes = Array.from(new Set(throwing.map((c) => c.expected.throws as string))).sort();
    expect(prefixes).toEqual(['invalid payload:', 'parser produced an invalid record:', 'visit_date is required']);
  });

  it('does not change the payloads it is given', () => {
    const before = JSON.stringify(payloads);
    cases.forEach((c) => run(c));
    expect(JSON.stringify(payloads)).toBe(before);
  });

  describe('the named rows of the vector completion plan', () => {
    it.each(['row_P', 'row_Q', 'row_B', 'row_V17'])('the cases with id prefix %s exist and pass', (prefix) => {
      const mine = cases.filter((c) => c.id.startsWith(prefix));
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.filter((c) => !passes(c)).map((c) => c.id)).toEqual([]);
    });
  });

  describe('V17: the confidence products of the plan, typed from the plan', () => {
    /** The first result row of a row_V17_* case, as the port produces it. */
    function firstRow(id: string): { confidence: number } {
      const c = cases.find((x) => x.id === id);
      expect(c).toBeDefined();
      const outcome = run(c as VectorCase);
      expect(outcome.ok).toBe(true);
      const record = (outcome as { ok: true; value: Json }).value as unknown as { record: { results: Array<{ confidence: number }> } };
      return record.record.results[0];
    }

    const threshold = engineConstants.parser.review_threshold;

    it.each([
      ['row_V17_a', 0.9025, false], // mean OCR 0.95 x 0.95 (conversion)
      ['row_V17_b', 0.7125, false], // 0.95 x 0.75 (inferred unit)
      ['row_V17_c', 0.665, true], // 0.95 x 0.7 (no dictionary match)
      ['row_V17_d', 0.7, false], // null OCR confidence x 0.7
    ])('%s gives %p, low confidence is %p', (id, confidence, low) => {
      const row = firstRow(id);
      expect(row.confidence).toBe(confidence);
      expect(row.confidence < threshold).toBe(low);
    });
  });
});
