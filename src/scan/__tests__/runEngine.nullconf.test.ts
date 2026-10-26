// Every word confidence set to null (MOB-03 step 8b). When ML Kit gives no confidence for any word, the 12 parse cases of
// ml/tests/fixtures/mlkit/engine_vectors/real_pages.json must still read, score and route as the Python reference did
// (measured at the close: 124 rows, 12 with low_confidence, 20 with any review reason, 0 rows with a null row confidence).
// The fixture holds sanitized report text, so this test reports counts only, never text, and it is skipped when the file
// is absent. The payloads are deep-copied; the fixture is not changed.
import * as fs from 'fs';
import * as path from 'path';
import { readJsonNormalized } from '../../engine/__tests__/helpers/vectors';
import { RawPage } from '../mlkitPages';
import { readPayload, scoreRows } from '../runEngine';

interface ParseCase {
  id: string;
  fn: string;
  input: { payload: string; visit_id: string; visit_date: string; sex: string | null };
}

interface RealPagesFile {
  payloads: { [key: string]: { pages: RawPage[] } };
  cases: ParseCase[];
}

const PARSE_FN = 'parsing.parser.parse_report';
const FIXTURE = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'ml',
  'tests',
  'fixtures',
  'mlkit',
  'engine_vectors',
  'real_pages.json',
);
const TODAY = new Date(2026, 9, 26, 12, 0);
const describeReal = fs.existsSync(FIXTURE) ? describe : describe.skip;

/** A deep copy of the payload with the confidence of every word set to null. */
function withNullConfidence(payload: { pages: RawPage[] }): unknown {
  const copy = JSON.parse(JSON.stringify(payload)) as { pages: RawPage[] };
  copy.pages.forEach((page) => {
    page.elements.forEach((element) => {
      element.confidence = null;
    });
  });
  return copy;
}

describeReal('real pages with every word confidence null', () => {
  const file = readJsonNormalized(FIXTURE) as unknown as RealPagesFile;
  const cases = file.cases.filter((c) => c.fn === PARSE_FN);

  it('reads 124 rows, 12 with low_confidence, 20 with any review reason and none with a null row confidence', () => {
    let casesRead = 0;
    let rows = 0;
    let lowConfidence = 0;
    let anyReason = 0;
    let nullConfidence = 0;
    let scoredCases = 0;
    cases.forEach((c) => {
      const out = readPayload(withNullConfidence(file.payloads[c.input.payload]), {
        visitId: c.input.visit_id,
        visitDate: c.input.visit_date,
        sex: c.input.sex,
        today: TODAY,
      });
      if (out.kind !== 'read') {
        return;
      }
      casesRead += 1;
      out.items.forEach((item) => {
        rows += 1;
        if (item.reasons.includes('low_confidence')) {
          lowConfidence += 1;
        }
        if (item.reasons.length > 0) {
          anyReason += 1;
        }
        const confidence = (item.row as { confidence?: number | null }).confidence;
        if (confidence === null || confidence === undefined) {
          nullConfidence += 1;
        }
      });
      if (scoreRows(out.record.results, out.record.visit_date as string, {}).kind === 'scored') {
        scoredCases += 1;
      }
    });
    expect(cases.length).toBe(12);
    expect(casesRead).toBe(12);
    expect(scoredCases).toBe(12);
    expect(rows).toBe(124);
    expect(lowConfidence).toBe(12);
    expect(anyReason).toBe(20);
    expect(nullConfidence).toBe(0);
  });

  it('does not change the fixture payloads', () => {
    const before = JSON.stringify(file.payloads);
    cases.forEach((c) => withNullConfidence(file.payloads[c.input.payload]));
    expect(JSON.stringify(file.payloads)).toBe(before);
  });
});
