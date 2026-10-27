// Step 15 of the takeover plan: the identity filter is switched on in the seam. PV3 sends a made-up page with identity
// rows and a wedged label through the real filter and on to the saved rows; PV5 checks that the drug-test hold stays on;
// PV6 checks that a page of identity rows alone fails closed. The pages are adapted from the shared vectors of
// docs/identity_filter/identity_filter_vectors.json (chemistry_us and identity_only). The tokens are made up. Tests report
// counts and case names only, never page text.
import * as fs from 'fs';
import * as path from 'path';
import { readJsonNormalized } from '../../engine/__tests__/helpers/vectors';
import { IDENTITY_FILTER } from '../identityFilter';
import { RawPage } from '../mlkitPages';
import { filterScan, readPayload, scoreRows } from '../runEngine';
import { toSavedReport } from '../saveRows';

interface VectorCase {
  name: string;
  input: { pages: RawPage[] };
}

const VECTORS = path.resolve(__dirname, '..', '..', '..', '..', 'docs', 'identity_filter', 'identity_filter_vectors.json');
const SOURCE = path.resolve(__dirname, '..', 'identityFilter.ts');
const CASES = (readJsonNormalized(VECTORS) as unknown as { cases: VectorCase[] }).cases;
const TOKENS = ['ZZCANARY', 'QQSURNAME', 'ZZ-00000', 'ZZWEDGE'];
const DATE = '2026-07-08';
const TODAY = new Date(2026, 9, 27, 12, 0);

function vectorPages(name: string): RawPage[] {
  const found = CASES.find((c) => c.name === name);
  expect(found).toBeDefined();
  return JSON.parse(JSON.stringify((found as VectorCase).input.pages)) as RawPage[];
}

/** The chemistry page of the vectors with its identity words replaced by the made-up tokens and a label wedged in a row. */
function canaryPages(): RawPage[] {
  const pages = vectorPages('chemistry_us');
  const swap: { [word: string]: string | null } = { Juan: 'ZZCANARY', Dela: 'QQSURNAME', Cruz: null, 'PX-48213': 'ZZ-00000' };
  const elements = pages[0].elements.flatMap((e) => {
    if (!(e.text in swap)) {
      return [e];
    }
    const replacement = swap[e.text];
    return replacement === null ? [] : [{ ...e, text: replacement }];
  });
  // Row of the second result (top 576, bottom 600): a name label and a value to the right of the results.
  elements.push({ text: 'Name:', box: [1000, 576, 1062, 600], confidence: null });
  elements.push({ text: 'ZZWEDGE', box: [1071, 576, 1170, 600], confidence: null });
  return [{ ...pages[0], elements }];
}

function tokensIn(value: unknown): string[] {
  const text = JSON.stringify(value);
  return TOKENS.filter((token) => text.includes(token));
}

describe('the filter switched on (step 15)', () => {
  it('PV3 control: the raw page holds all four made-up tokens, and the filter is wired', () => {
    expect(IDENTITY_FILTER).not.toBeNull();
    expect(tokensIn(canaryPages())).toEqual(TOKENS);
  });

  it('PV3: no made-up token reaches the payload, the record, the Contract B or the saved rows, and rows are saved', () => {
    const filter = IDENTITY_FILTER;
    expect(filter).not.toBeNull();
    if (filter === null) {
      return;
    }
    const scanned = filterScan(canaryPages(), filter);
    expect(scanned.kind).toBe('payload');
    if (scanned.kind !== 'payload') {
      return;
    }
    const read = readPayload(scanned.payload, { visitId: 'wired', visitDate: DATE, sex: null, today: TODAY });
    expect(read.kind).toBe('read');
    if (read.kind !== 'read') {
      return;
    }
    const scored = scoreRows(read.record.results, DATE, {});
    expect(scored.kind).toBe('scored');
    if (scored.kind !== 'scored') {
      return;
    }
    const saved = toSavedReport(scored, read.record);
    expect(saved.kind).toBe('saved');
    if (saved.kind !== 'saved') {
      return;
    }
    expect(saved.rows.length).toBeGreaterThan(0);
    expect({
      payload: tokensIn(scanned.payload),
      record: tokensIn(read.record),
      contractB: tokensIn(scored.contractB),
      savedRows: tokensIn(saved.rows),
      savedReport: tokensIn(saved.report),
    }).toEqual({ payload: [], record: [], contractB: [], savedRows: [], savedReport: [] });
  });

  it('PV5: the source calls sanitize once with one argument, so the drug-test hold stays on', () => {
    const code = fs
      .readFileSync(SOURCE, 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    const calls = code.match(/sanitize\(([^)]*)\)/g) ?? [];
    expect(calls).toHaveLength(1);
    expect(calls.join('').includes(',')).toBe(false);
    expect(IDENTITY_FILTER).not.toBeNull();
  });

  it('PV5 behaviour: a drug-test page is held through the seam', () => {
    const filter = IDENTITY_FILTER;
    expect(filter).not.toBeNull();
    if (filter === null) {
      return;
    }
    expect(filterScan(vectorPages('drug_test'), filter)).toEqual({ kind: 'no_table', reason: 'drug_test_held' });
  });

  it('PV6: a page of identity rows only fails closed with no table region', () => {
    const filter = IDENTITY_FILTER;
    expect(filter).not.toBeNull();
    if (filter === null) {
      return;
    }
    const pages = vectorPages('identity_only');
    expect(pages[0].elements.length).toBeGreaterThan(0);
    expect(filterScan(pages, filter)).toEqual({ kind: 'no_table', reason: 'no_table_region' });
    expect(filter(pages)).toMatchObject({ payload: null, doc_types: ['unrecognized'] });
  });
});
