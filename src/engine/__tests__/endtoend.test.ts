// End to end (ML-27/ML-28, S14, plan step 8): every case of docs/engine_vectors/endtoend.json is a chain, run on the
// TypeScript port from the payload on (plan P12), not a replay of stored records: parseReport on the payload of the
// parse.json case that the case names, then splitForReview, then buildContractB with EVERY row as if the user had
// confirmed each row unchanged (the open ML-13 decision is not taken here), then validateB. The stages are asserted in
// this order: 'record' (the produced record equals the expected record of the parse case, with the tolerance of
// parse.json), 'split' (ready and review as indexes into record.results), 'contract_b', 'b_check' ({valid, count,
// paths}). A failure names the case id and the stage only, never document text. Only counts and case ids are ever
// reported. Expected values are read from the vector files, not typed here.
import { buildContractB } from '../scoring/extensions';
import { parseReport } from '../parsing/parser';
import { splitForReview } from '../parsing/review';
import { validateB } from '../contracts/validate';
import { compare, compareWithHeader, describeVectors, Json, loadVectorFile } from './helpers/vectors';

type Row = { [key: string]: Json };
type Stage = 'record' | 'split' | 'contract_b' | 'b_check';

interface VectorCase {
  id: string;
  fn: string;
  input: { [key: string]: Json };
  expected: { [key: string]: Json };
}

interface ParseCase {
  id: string;
  input: { payload: string; visit_id: string; visit_date: string | null; sex: string | null };
  expected: { [key: string]: Json };
}

const EXPECTED_CASES = 160;

describeVectors('endtoend', (file) => {
  const cases = file.cases as unknown as VectorCase[];
  const parseFile = loadVectorFile('parse');
  const parseCases = (parseFile === null ? [] : parseFile.cases) as unknown as ParseCase[];
  const payloads = (parseFile as unknown as { payloads: { [key: string]: Json } }).payloads;
  const parseTolerance = parseFile === null ? null : parseFile.comparison.tolerance;

  /** The parse.json case that an end-to-end case names. */
  function parseCaseOf(c: VectorCase): ParseCase {
    const source = parseCases.find((p) => p.id === c.input.parse_case);
    expect(source).toBeDefined();
    return source as ParseCase;
  }

  /** The stages that fail for a case, in order; empty when the whole chain reproduces the case. */
  function failedStages(c: VectorCase): Stage[] {
    const failed: Stage[] = [];
    const source = parseCaseOf(c);
    const out = parseReport(payloads[source.input.payload], {
      visitId: source.input.visit_id,
      visitDate: source.input.visit_date === '' ? null : source.input.visit_date,
      sex: source.input.sex,
    });
    const record = out.record;
    const recordBefore = JSON.stringify(record);

    if (compare(source.expected.record, record as unknown as Json, parseTolerance).length > 0) {
      failed.push('record');
    }

    const results = record.results as unknown as Row[];
    const split = splitForReview(record);
    const indexOf = (row: Row): number => results.findIndex((r) => r === row);
    const actualSplit = {
      ready: split.ready.map((r) => indexOf(r as Row)),
      review: split.toReview.map((r) => indexOf(r as Row)),
    };
    const expectedSplit = { ready: c.expected.ready, review: c.expected.review };
    if (compareWithHeader(file, expectedSplit, actualSplit).length > 0 || JSON.stringify(record) !== recordBefore) {
      failed.push('split');
    }

    const history = c.input.history as unknown as { [code: string]: unknown[] };
    const weights = c.input.weights as unknown as { [code: string]: unknown };
    const contractB = buildContractB(record.visit_date as string, record.results as never, history, weights);
    if (compareWithHeader(file, c.expected.contract_b, contractB as unknown as Json).length > 0 || JSON.stringify(record) !== recordBefore) {
      failed.push('contract_b');
    }

    const result = validateB(contractB);
    const actualCheck = { valid: result.valid, count: result.errors.length, paths: result.errors.map((e) => e.path).sort() };
    if (compareWithHeader(file, c.expected.b_check, actualCheck).length > 0) {
      failed.push('b_check');
    }
    return failed;
  }

  /** "id (stage, stage)" for every case that fails, so that a failure names the case and the stage only. */
  function failures(): string[] {
    return cases.map((c) => ({ id: c.id, stages: failedStages(c) })).filter((x) => x.stages.length > 0).map((x) => x.id + ' (' + x.stages.join(', ') + ')');
  }

  const failed = failures();

  it(`has ${EXPECTED_CASES} cases with unique ids, each of fn endtoend, each naming a parse.json case that succeeds`, () => {
    expect(cases.length).toBe(EXPECTED_CASES);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    expect(cases.every((c) => c.fn === 'endtoend')).toBe(true);
    expect(parseFile).not.toBeNull();
    const missing = cases.filter((c) => {
      const source = parseCases.find((p) => p.id === c.input.parse_case);
      return source === undefined || typeof source.expected.throws === 'string';
    });
    expect(missing.map((c) => c.id)).toEqual([]);
  });

  it('has the named rows of the vector completion plan', () => {
    ['row_E', 'row_H', 'row_W'].forEach((prefix) => {
      expect(cases.filter((c) => c.id.startsWith(prefix)).length).toBeGreaterThan(0);
    });
  });

  it('reproduces the record, the split, Contract B and its check of every case (all stages)', () => {
    expect(failed).toEqual([]);
  });

  it(`passes ${cases.length} of ${EXPECTED_CASES} cases`, () => {
    expect(cases.length - failed.length).toBe(EXPECTED_CASES);
  });

  it('does not change the payloads, the history or the weights it is given', () => {
    const before = JSON.stringify([payloads, cases.map((c) => c.input)]);
    cases.forEach((c) => failedStages(c));
    expect(JSON.stringify([payloads, cases.map((c) => c.input)])).toBe(before);
  });
});
