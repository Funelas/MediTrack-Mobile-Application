// filterScan and readPayload (MOB-03 step 4). The synthetic cases hold no report text. The real-page check loads
// ml/tests/fixtures/mlkit/engine_vectors/real_pages.json, which holds sanitized report text, so it reports counts and
// case ids only, never text, and it is skipped when the file is absent. The canary test builds its pages from a fixture
// payload when the file is present and falls back to a placeholder payload otherwise.
import * as fs from 'fs';
import * as path from 'path';
import { compare, Json, readJsonNormalized, Tolerance } from '../../engine/__tests__/helpers/vectors';
import { FilterResult, FilterReason, IDENTITY_FILTER, IdentityFilter } from '../identityFilter';
import { RawPage } from '../mlkitPages';
import { filterScan, readPayload } from '../runEngine';
import { clearSession, getSession, setSession } from '../session';
import { isVisitDate, toVisitDate } from '../visitDate';

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
const PARSE_FN = 'parsing.parser.parse_report';
const CANARY = 'ZZCANARY';

interface ParseCase {
  id: string;
  fn: string;
  input: { payload: string; visit_id: string; visit_date: string; sex: string | null };
  expected: {
    record: Json;
    notes: Json[];
    split: { reasons: string[][]; ready: number[]; review: number[] };
  };
}

interface RealPagesFile {
  comparison: { rule: string; tolerance: Tolerance };
  payloads: { [key: string]: { pages: RawPage[] } };
  cases: ParseCase[];
}

function filterResult(overrides: Partial<FilterResult>): FilterResult {
  return { payload: null, reason: null, doc_types: [], visit_date: null, dropped_rows: 0, ...overrides };
}

function canned(result: FilterResult): IdentityFilter {
  return () => result;
}

const NO_PAGES: RawPage[] = [];
const REAL: RealPagesFile | null = fs.existsSync(FIXTURE) ? (readJsonNormalized(FIXTURE) as unknown as RealPagesFile) : null;

describe('the filter seam', () => {
  it('has no filter yet (MOB-02 sets it)', () => {
    expect(IDENTITY_FILTER).toBeNull();
  });
});

describe('filterScan', () => {
  it('returns the payload and the filter date as a candidate', () => {
    const payload = { page_count: 1 };
    const out = filterScan(NO_PAGES, canned(filterResult({ payload, visit_date: '2026-03-04' })));
    expect(out).toEqual({ kind: 'payload', payload, dateCandidate: '2026-03-04' });
  });

  it('gives a null date candidate when the filter found no date', () => {
    const out = filterScan(NO_PAGES, canned(filterResult({ payload: { page_count: 1 } })));
    expect(out.kind === 'payload' && out.dateCandidate === null).toBe(true);
  });

  const reasons: FilterReason[] = ['no_table_region', 'no_results', 'drug_test_held'];
  reasons.forEach((reason) => {
    it(`gives no_table for a null payload with the reason ${reason}`, () => {
      expect(filterScan(NO_PAGES, canned(filterResult({ reason })))).toEqual({ kind: 'no_table', reason });
    });
  });

  it('gives could_not_read for a null payload with no reason', () => {
    expect(filterScan(NO_PAGES, canned(filterResult({})))).toEqual({ kind: 'could_not_read' });
  });

  it('gives could_not_read when the filter throws, and keeps no message', () => {
    const throwing: IdentityFilter = () => {
      throw new Error('message that must not be kept');
    };
    const out = filterScan(NO_PAGES, throwing);
    expect(out).toEqual({ kind: 'could_not_read' });
    expect(JSON.stringify(out).includes('message')).toBe(false);
  });
});

describe('readPayload', () => {
  const ctx = { visitId: 'visit-1', visitDate: '2026-03-04', sex: null };

  it('gives date_required for an empty date, even when the payload has a date', () => {
    const payload = { visit_date: '2026-03-04', report_type: null, page_count: 1, pages: [] };
    expect(readPayload(payload, { ...ctx, visitDate: '' })).toEqual({ kind: 'date_required' });
  });

  it('gives date_required for a date that is not YYYY-MM-DD', () => {
    expect(readPayload({}, { ...ctx, visitDate: '3/4/2026' })).toEqual({ kind: 'date_required' });
  });

  it('gives date_required for a date that does not exist or is in the future, with an injected clock', () => {
    const today = new Date(2026, 9, 26, 12, 0);
    ['2026-13-45', '2026-02-29', '2026-04-31', '2026-00-10', '2026-01-00', '2026-10-27', '2027-01-01'].forEach((visitDate) => {
      expect(readPayload({}, { ...ctx, visitDate, today })).toEqual({ kind: 'date_required' });
    });
  });

  it('passes the date step for a past date and for today with an injected clock', () => {
    const today = new Date(2026, 9, 26, 12, 0);
    ['2026-03-04', '2026-10-26'].forEach((visitDate) => {
      expect(readPayload({}, { ...ctx, visitDate, today })).toEqual({ kind: 'could_not_read' });
    });
  });

  it('gives could_not_read for an invalid payload, with no message or error field', () => {
    const out = readPayload({}, ctx);
    expect(out).toEqual({ kind: 'could_not_read' });
    expect(Object.keys(out)).toEqual(['kind']);
  });

  it('gives could_not_read for a payload that is not an object', () => {
    expect(readPayload(null, ctx)).toEqual({ kind: 'could_not_read' });
  });
});

describe('visit date (row D-1)', () => {
  it('is the local calendar day, not the UTC day', () => {
    expect(toVisitDate(new Date(2026, 6, 8, 0, 30))).toBe('2026-07-08');
  });

  it('pads month and day', () => {
    expect(toVisitDate(new Date(2026, 0, 2, 23, 59))).toBe('2026-01-02');
  });

  it('checks the YYYY-MM-DD shape', () => {
    expect(isVisitDate('2026-07-08')).toBe(true);
    expect(isVisitDate('')).toBe(false);
    expect(isVisitDate('2026-7-8')).toBe(false);
    expect(isVisitDate('2026-07-08 ')).toBe(false);
  });

  const NOW = new Date(2026, 6, 8, 12, 0);

  it('rejects a date that does not exist', () => {
    ['2026-13-45', '2026-02-29', '2026-04-31', '2026-00-10', '2026-01-00', '2026-02-30', '2026-06-31'].forEach((text) => {
      expect(isVisitDate(text, NOW)).toBe(false);
    });
  });

  it('treats 29 February by the leap-year rule', () => {
    const later = new Date(2030, 0, 1);
    expect(isVisitDate('2026-02-29', later)).toBe(false);
    expect(isVisitDate('2028-02-29', later)).toBe(true);
    expect(isVisitDate('2100-02-29', new Date(2200, 0, 1))).toBe(false);
    expect(isVisitDate('2000-02-29', later)).toBe(true);
    expect(isVisitDate('1900-02-29', later)).toBe(false);
  });

  it('accepts today and earlier days, and rejects tomorrow and later', () => {
    expect(isVisitDate('2026-07-08', NOW)).toBe(true);
    expect(isVisitDate('2026-07-07', NOW)).toBe(true);
    expect(isVisitDate('2026-07-09', NOW)).toBe(false);
    expect(isVisitDate('2026-08-01', NOW)).toBe(false);
    expect(isVisitDate('2027-01-01', NOW)).toBe(false);
  });

  it('uses the local calendar day of the clock, also at the end of the day', () => {
    const lateEvening = new Date(2026, 6, 8, 23, 59);
    expect(isVisitDate('2026-07-08', lateEvening)).toBe(true);
    expect(isVisitDate('2026-07-09', lateEvening)).toBe(false);
    const justAfterMidnight = new Date(2026, 6, 9, 0, 1);
    expect(isVisitDate('2026-07-09', justAfterMidnight)).toBe(true);
    expect(isVisitDate('2026-07-10', justAfterMidnight)).toBe(false);
  });

  it('rejects years before 1900', () => {
    expect(isVisitDate('0000-01-01', NOW)).toBe(false);
    expect(isVisitDate('0000-02-29', NOW)).toBe(false);
    expect(isVisitDate('0026-07-08', NOW)).toBe(false);
    expect(isVisitDate('0099-12-31', NOW)).toBe(false);
    expect(isVisitDate('1899-12-31', NOW)).toBe(false);
    expect(isVisitDate('1900-01-01', NOW)).toBe(true);
    expect(isVisitDate('1999-12-31', NOW)).toBe(true);
  });
});

describe('session slot', () => {
  it('holds one session until it is cleared', () => {
    clearSession();
    expect(getSession()).toBeNull();
    const session = { payload: { page_count: 1 }, record: null };
    setSession(session);
    expect(getSession() === session).toBe(true);
    clearSession();
    expect(getSession()).toBeNull();
  });
});

const describeReal = REAL === null ? describe.skip : describe;

describeReal('with real pages (fixture file)', () => {
  const file: RealPagesFile = REAL ?? { comparison: { rule: '', tolerance: { fields: [], abs: null } }, payloads: {}, cases: [] };
  const cases = file.cases.filter((c) => c.fn === PARSE_FN);

  it('drops the canary word before the record is built', () => {
    const firstPayload = file.payloads[cases[0].input.payload];
    const pages: RawPage[] = JSON.parse(JSON.stringify(firstPayload.pages)) as RawPage[];
    pages[0].elements.push({ text: CANARY, box: [1, 1, 2, 2], confidence: null });
    let seenByFilter = false;
    const filter: IdentityFilter = (input) => {
      seenByFilter = input.some((p) => p.elements.some((e) => e.text === CANARY));
      const kept = input.map((p) => ({ ...p, elements: p.elements.filter((e) => e.text !== CANARY) }));
      return filterResult({ payload: { visit_date: null, report_type: null, page_count: kept.length, pages: kept } });
    };
    const scanned = filterScan(pages, filter);
    expect(seenByFilter).toBe(true);
    expect(scanned.kind).toBe('payload');
    if (scanned.kind !== 'payload') {
      return;
    }
    expect(JSON.stringify(scanned.payload).includes(CANARY)).toBe(false);
    const out = readPayload(scanned.payload, { visitId: 'canary', visitDate: '2026-03-04', sex: null });
    expect(out.kind).toBe('read');
    expect(JSON.stringify(out).includes(CANARY)).toBe(false);
  });

  it('reproduces the record, ready and review lists of every parse_report case', () => {
    const failed: string[] = [];
    let compared = 0;
    cases.forEach((c) => {
      const out = readPayload(file.payloads[c.input.payload], {
        visitId: c.input.visit_id,
        visitDate: c.input.visit_date,
        sex: c.input.sex,
      });
      compared += 1;
      if (out.kind !== 'read') {
        failed.push(c.id);
        return;
      }
      const actual = {
        record: out.record,
        ready: out.readyIndexes,
        review: out.reviewIndexes,
        reasons: out.items.map((item) => item.reasons),
        note_count: out.noteCount,
      } as unknown as Json;
      const expected = {
        record: c.expected.record,
        ready: c.expected.split.ready,
        review: c.expected.split.review,
        reasons: c.expected.split.reasons,
        note_count: c.expected.notes.length,
      } as unknown as Json;
      if (compare(expected, actual, file.comparison.tolerance).length > 0) {
        failed.push(c.id);
      }
    });
    expect(compared).toBeGreaterThan(0);
    expect(compared).toBe(cases.length);
    expect(failed).toEqual([]);
  });
});
