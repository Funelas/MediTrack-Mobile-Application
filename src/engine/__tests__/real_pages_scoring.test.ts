// Real pages, end to end (ML-27/ML-28, S14, plan step 8): every case of
// ml/tests/fixtures/mlkit/engine_vectors/real_pages_scoring.json is a chain run on the TypeScript port from the payload
// on (plan P12): parseReport on the payload of the real_pages.json case that the case names, then splitForReview, then
// buildContractB with EVERY row as if the user had confirmed each row unchanged (the open ML-13 decision is not taken
// here), then validateB. The stages are asserted in this order: 'record' (the produced record equals the expected record
// of the real_pages.json case), 'split', 'contract_b', 'b_check' ({valid, count, paths}). The files hold sanitized real
// report text, so this test reports only counts and case ids and the stage name, never payload, test-name, value or
// note text, and it holds no fixture text. The files sit next to the ML Kit dumps, not in docs/engine_vectors/, so they
// are loaded here. When either is absent the suite is skipped with a placeholder test, as describeVectors does.
// Expected values are read from the files, not typed here.
import * as fs from 'fs';
import * as path from 'path';
import { buildContractB } from '../scoring/extensions';
import { parseReport } from '../parsing/parser';
import { splitForReview } from '../parsing/review';
import { validateB } from '../contracts/validate';
import { compare, Json, readJsonNormalized, Tolerance, VECTORS_DIR } from './helpers/vectors';

type Row = { [key: string]: Json };
type Stage = 'record' | 'split' | 'contract_b' | 'b_check';

interface VectorCase {
  id: string;
  fn: string;
  input: { [key: string]: Json };
  expected: { [key: string]: Json };
}

interface VectorsFile {
  comparison: { rule: string; tolerance: Tolerance };
  payloads: { [key: string]: Json };
  cases: VectorCase[];
}

const EXPECTED_CASES = 12;

const FOLDER = path.resolve(VECTORS_DIR, '..', '..', 'ml', 'tests', 'fixtures', 'mlkit', 'engine_vectors');
const PAGES = path.join(FOLDER, 'real_pages.json');
const SCORING = path.join(FOLDER, 'real_pages_scoring.json');

function describeRealPagesScoring(fn: (pages: VectorsFile, scoring: VectorsFile) => void): void {
  if (!fs.existsSync(PAGES) || !fs.existsSync(SCORING)) {
    describe.skip('vectors: real_pages_scoring (file absent)', () => {
      it('is skipped because the vector file does not exist', () => {
        // never runs
      });
    });
    return;
  }
  describe('vectors: real_pages_scoring', () =>
    fn(readJsonNormalized(PAGES) as unknown as VectorsFile, readJsonNormalized(SCORING) as unknown as VectorsFile));
}

describeRealPagesScoring((pages, scoring) => {
  const cases = scoring.cases;
  const payloads = pages.payloads;
  const exact = scoring.comparison.tolerance;
  const parseCases = pages.cases.filter((c) => c.fn === 'parsing.parser.parse_report');

  /** The real_pages.json parse case that a case names. */
  function parseCaseOf(c: VectorCase): VectorCase {
    const source = parseCases.find((p) => p.id === c.input.parse_case);
    expect(source).toBeDefined();
    return source as VectorCase;
  }

  /** The stages that fail for a case, in order; empty when the whole chain reproduces the case. */
  function failedStages(c: VectorCase): Stage[] {
    const failed: Stage[] = [];
    const source = parseCaseOf(c);
    const out = parseReport(payloads[source.input.payload as string], {
      visitId: source.input.visit_id as string,
      visitDate: source.input.visit_date === '' ? null : (source.input.visit_date as string | null),
      sex: source.input.sex as string | null,
    });
    const record = out.record;
    const recordBefore = JSON.stringify(record);

    if (compare(source.expected.record, record as unknown as Json, pages.comparison.tolerance).length > 0) {
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
    if (compare(expectedSplit, actualSplit, exact).length > 0 || JSON.stringify(record) !== recordBefore) {
      failed.push('split');
    }

    const history = c.input.history as unknown as { [code: string]: unknown[] };
    const weights = c.input.weights as unknown as { [code: string]: unknown };
    const contractB = buildContractB(record.visit_date as string, record.results as never, history, weights);
    if (compare(c.expected.contract_b, contractB as unknown as Json, exact).length > 0 || JSON.stringify(record) !== recordBefore) {
      failed.push('contract_b');
    }

    const result = validateB(contractB);
    const actualCheck = { valid: result.valid, count: result.errors.length, paths: result.errors.map((e) => e.path).sort() };
    if (compare(c.expected.b_check, actualCheck, exact).length > 0) {
      failed.push('b_check');
    }
    return failed;
  }

  /** "id (stage, stage)" for every case that fails, so that a failure names the case and the stage only. */
  function failures(): string[] {
    return cases.map((c) => ({ id: c.id, stages: failedStages(c) })).filter((x) => x.stages.length > 0).map((x) => x.id + ' (' + x.stages.join(', ') + ')');
  }

  const failed = failures();

  it(`has ${EXPECTED_CASES} cases with unique ids, each of fn endtoend, each naming a real_pages.json parse_report case`, () => {
    expect(cases.length).toBe(EXPECTED_CASES);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    expect(cases.every((c) => c.fn === 'endtoend')).toBe(true);
    expect(cases.every((c) => c.id.startsWith('real_e2e_'))).toBe(true);
    const missing = cases.filter((c) => !parseCases.some((p) => p.id === c.input.parse_case));
    expect(missing.map((c) => c.id)).toEqual([]);
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
