// filterScan and readPayload (MOB-03 step 4). The synthetic cases hold no report text. The real-page check loads
// ml/tests/fixtures/mlkit/engine_vectors/real_pages.json, which holds sanitized report text, so it reports counts and
// case ids only, never text, and it is skipped when the file is absent. The canary test builds its pages from a fixture
// payload when the file is present and falls back to a placeholder payload otherwise.
import * as fs from 'fs';
import * as path from 'path';
import { compare, Json, readJsonNormalized, Tolerance } from '../../engine/__tests__/helpers/vectors';
import { FilterResult, FilterReason, IDENTITY_FILTER, IdentityFilter } from '../identityFilter';
import { RawPage } from '../mlkitPages';
import { filterScan, readPayload, scoreRowsForTests } from '../runEngine';
import { toSavedReport } from '../saveRows';
import { clearSession, getSession, setSession } from '../session';
import { isVisitDate, prefillDate, toVisitDate } from '../visitDate';

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
const SCORING = path.join(path.dirname(FIXTURE), 'real_pages_scoring.json');
const PARSE_FN = 'parsing.parser.parse_report';
const WIDEST_IDS = ['real_hematology_2_none', 'real_hematology_2_null_none'];
const SX4_ID = 'real_e2e_hematology_2_male';
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

interface ScoringCase {
  id: string;
  input: { parse_case: string; history: { [code: string]: unknown[] }; weights: { [code: string]: unknown } };
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

/** The number of keys named "sex" at any depth of a JSON value (a count only, never text). */
function sexKeyCount(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce((total: number, item) => total + sexKeyCount(item), 0);
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as { [key: string]: unknown }).reduce(
      (total, [key, item]) => total + (key === 'sex' ? 1 : 0) + sexKeyCount(item),
      0,
    );
  }
  return 0;
}

const NO_PAGES: RawPage[] = [];
const REAL: RealPagesFile | null = fs.existsSync(FIXTURE) ? (readJsonNormalized(FIXTURE) as unknown as RealPagesFile) : null;

describe('the filter seam', () => {
  it('has the identity filter wired (step 15)', () => {
    expect(IDENTITY_FILTER).not.toBeNull();
    expect(typeof IDENTITY_FILTER).toBe('function');
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

describe('visit date closing rows (MOB-03 8b findings)', () => {
  const CLOCK = new Date(2026, 6, 8, 23, 59, 59, 999);

  it('DC1: an invalid clock gives false', () => {
    expect(isVisitDate('2026-07-08', new Date(NaN))).toBe(false);
  });

  it('DC2: today is true just after local midnight', () => {
    expect(isVisitDate('2026-07-08', new Date(2026, 6, 8, 0, 30))).toBe(true);
  });

  it('DC3: tomorrow is false at 23:59', () => {
    expect(isVisitDate('2026-07-09', new Date(2026, 6, 8, 23, 59))).toBe(false);
  });

  it('DC4: prefillDate gives a valid past candidate back and an empty string for null', () => {
    expect(prefillDate('2026-07-08', new Date(2026, 9, 27))).toBe('2026-07-08');
    expect(prefillDate(null, new Date(2026, 9, 27))).toBe('');
  });

  it('DC5: today, the lowest year and a leap day are true at the last millisecond of the day', () => {
    expect(isVisitDate('2026-07-08', CLOCK)).toBe(true);
    expect(isVisitDate('1900-01-01', CLOCK)).toBe(true);
    expect(isVisitDate('2024-02-29', CLOCK)).toBe(true);
  });

  it('DC6: a year before 1900, a non-leap 29 February and an unpadded date are false', () => {
    expect(isVisitDate('1899-12-31', CLOCK)).toBe(false);
    expect(isVisitDate('2026-02-29', CLOCK)).toBe(false);
    expect(isVisitDate('2026-7-8', CLOCK)).toBe(false);
  });

  // The filter checks only 1 <= day <= 31, so it can give the candidate "2026-02-31". The candidate itself is asserted by
  // the engine tests (src/scan tests may import only the public engine API, which does not export datesIn). Here the
  // date step must refuse it and leave the field empty, so that the user types the date.
  it('DT8: a candidate with a day that does not exist is not prefilled', () => {
    expect(prefillDate('2026-02-31', CLOCK)).toBe('');
    expect(isVisitDate('2026-02-31', CLOCK)).toBe(false);
  });

  it('DT13: a candidate with a month and day out of range is not prefilled', () => {
    expect(prefillDate('2026-13-45', CLOCK)).toBe('');
    expect(isVisitDate('2026-13-45', CLOCK)).toBe(false);
  });

  it('TZ1: the Jest time zone is pinned east of UTC, so the local day differs from the UTC day', () => {
    const date = new Date(2026, 6, 8, 0, 30);
    expect(date.getTimezoneOffset()).toBe(-480);
    expect(date.toISOString()).toBe('2026-07-07T16:30:00.000Z');
    expect(toVisitDate(date)).toBe('2026-07-08');
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

  it('WC1: widestRangeCount is 3 for the two hematology cases with no sex and 0 for the other ten', () => {
    expect(cases.length).toBe(12);
    const wrong: string[] = [];
    let threes = 0;
    cases.forEach((c) => {
      const out = readPayload(file.payloads[c.input.payload], {
        visitId: c.input.visit_id,
        visitDate: c.input.visit_date,
        sex: c.input.sex,
      });
      const expected = WIDEST_IDS.includes(c.id) ? 3 : 0;
      if (out.kind !== 'read' || out.widestRangeCount !== expected) {
        wrong.push(c.id);
      } else if (out.widestRangeCount === 3) {
        threes += 1;
      }
    });
    expect(wrong).toEqual([]);
    expect(threes).toBe(WIDEST_IDS.length);
  });

  const itScoring = fs.existsSync(SCORING) ? it : it.skip;

  itScoring('unsupportedCount is the number of results minus the parameters of the Contract B, on each real case', () => {
    const scoring = readJsonNormalized(SCORING) as unknown as { cases: ScoringCase[] };
    const wrong: string[] = [];
    let compared = 0;
    let positive = 0;
    scoring.cases.forEach((s) => {
      const c = cases.find((p) => p.id === s.input.parse_case) as ParseCase;
      const out = readPayload(file.payloads[c.input.payload], {
        visitId: c.input.visit_id,
        visitDate: c.input.visit_date,
        sex: c.input.sex,
      });
      if (out.kind !== 'read') {
        wrong.push(s.id);
        return;
      }
      const scored = scoreRowsForTests(out.record.results, out.record.visit_date as string, s.input.history, s.input.weights);
      if (scored.kind !== 'scored') {
        wrong.push(s.id);
        return;
      }
      compared += 1;
      if (out.unsupportedCount > 0) {
        positive += 1;
      }
      if (out.unsupportedCount !== out.record.results.length - scored.contractB.parameters.length) {
        wrong.push(s.id);
      }
    });
    expect(wrong).toEqual([]);
    expect(compared).toBe(scoring.cases.length);
    expect(compared).toBe(12);
    expect(positive).toBeGreaterThan(0);
  });

  it('SX4 control: the key scan counts a key named sex at depth', () => {
    expect(sexKeyCount({ a: [{ b: { sex: 1 } }], sex: null })).toBe(2);
    expect(sexKeyCount({ a: [{ b: { sexual: 1 } }] })).toBe(0);
  });

  itScoring('SX4: no key named sex in the record, the Contract B or the saved rows, though readPayload gets sex male', () => {
    const scoring = readJsonNormalized(SCORING) as unknown as { cases: ScoringCase[] };
    const s = scoring.cases.find((p) => p.id === SX4_ID) as ScoringCase;
    expect(s).toBeDefined();
    const c = cases.find((p) => p.id === s.input.parse_case) as ParseCase;
    expect(c.input.sex).toBe('male');
    const out = readPayload(file.payloads[c.input.payload], {
      visitId: c.input.visit_id,
      visitDate: c.input.visit_date,
      sex: 'male',
    });
    expect(out.kind).toBe('read');
    if (out.kind !== 'read') {
      return;
    }
    const scored = scoreRowsForTests(out.record.results, out.record.visit_date as string, s.input.history, s.input.weights);
    expect(scored.kind).toBe('scored');
    if (scored.kind !== 'scored') {
      return;
    }
    const saved = toSavedReport(scored, out.record);
    expect(saved.kind).toBe('saved');
    if (saved.kind !== 'saved') {
      return;
    }
    expect(out.record.results.length).toBeGreaterThan(0);
    expect(saved.rows.length).toBe(scored.contractB.parameters.length);
    expect({
      record: sexKeyCount(out.record),
      contractB: sexKeyCount(scored.contractB),
      savedRows: sexKeyCount(saved.rows),
      savedReport: sexKeyCount(saved.report),
      savedContractBText: sexKeyCount(JSON.parse(saved.report.contractBJson)),
    }).toEqual({ record: 0, contractB: 0, savedRows: 0, savedReport: 0, savedContractBText: 0 });
  });
});
