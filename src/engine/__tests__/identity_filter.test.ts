// Identity filter (MOB-03 takeover, steps 3 and 4): labels, footer, dates, the result-shape test, the keep regions and
// sanitize of ml/parsing/identity_filter.py. Rows are made up (small Row objects with made-up boxes); the row ids are those of the plan.
import * as path from 'path';
import { validatePayload } from '../contracts/validate';
import {
  dateCandidates,
  datesIn,
  identityCellIndex,
  looksLikeResult,
  rowHasIdentity,
  rowIsFooter,
  sanitize,
} from '../parsing/identityFilter';
import { Row } from '../parsing/layout';
import { readJsonNormalized } from './helpers/vectors';

function row(...texts: string[]): Row {
  return {
    cells: texts.map((text, i) => ({ text, box: [i * 100, 0, i * 100 + 90, 20], conf: 1.0, n_words: 1 })),
  };
}

describe('identity labels and footer rows', () => {
  test('I1 a name label with a colon is identity', () => {
    const r = row('Name: X');
    expect(identityCellIndex(r)).toBe(0);
    expect(rowHasIdentity(r)).toBe(true);
    expect(identityCellIndex(row('Glucose', 'Name: X'))).toBe(1);
  });

  test('I2 a bare name label is identity', () => {
    expect(rowHasIdentity(row('Name'))).toBe(true);
  });

  test('I3 "Names of tests" is not identity', () => {
    const r = row('Names of tests');
    expect(identityCellIndex(r)).toBeNull();
    expect(rowHasIdentity(r)).toBe(false);
  });

  test('I4 leading spaces and a space before the colon are identity', () => {
    expect(rowHasIdentity(row('  sex : M'))).toBe(true);
  });

  test('I5 the longest label first: age/sex matches', () => {
    expect(rowHasIdentity(row('Age/Sex: 45/M'))).toBe(true);
  });

  test('I6 "Patients" is not identity', () => {
    expect(rowHasIdentity(row('Patients'))).toBe(false);
  });

  test('I7 "Room 5" is not identity', () => {
    expect(rowHasIdentity(row('Room 5'))).toBe(false);
  });

  test('I8 a signature label is identity and the row is a footer row', () => {
    const r = row('License No: 1');
    expect(rowHasIdentity(r)).toBe(true);
    expect(rowIsFooter(r)).toBe(true);
  });

  test('I9 a footer prefix needs no colon or boundary', () => {
    expect(rowIsFooter(row('Page 1 of 2'))).toBe(true);
    expect(rowIsFooter(row('Pages'))).toBe(true);
    expect(rowIsFooter(row('Glucose', '5.2'))).toBe(false);
    expect(rowIsFooter({ cells: [] })).toBe(false);
  });
});

describe('dates', () => {
  test('DT1 an ISO date with one-digit parts is padded', () => {
    expect(datesIn('2026-7-8')).toEqual(['2026-07-08']);
  });

  test('DT2 day first when the first part is above 12', () => {
    expect(datesIn('13/05/2026')).toEqual(['2026-05-13']);
  });

  test('DT3 ambiguous: both parts 12 or less and different gives no candidate', () => {
    expect(datesIn('12/05/2026')).toEqual([]);
  });

  test('DT4 month first with a second part above 12', () => {
    expect(datesIn('05/13/2026')).toEqual(['2026-05-13']);
  });

  test('DT5 13/13/2026 is no date', () => {
    expect(datesIn('13/13/2026')).toEqual([]);
  });

  test('DT6 a year before 2000 is no date', () => {
    expect(datesIn('1999-01-01')).toEqual([]);
  });

  test('DT7 a month name of four letters', () => {
    expect(datesIn('Sept 5, 2026')).toEqual(['2026-09-05']);
  });

  test('DT9 a collection date ranks before a report date', () => {
    const c = dateCandidates([row('Collection Date: 2026-07-08'), row('Report Date: 2026-07-09')]);
    expect(c).toEqual([
      [0, '2026-07-08'],
      [2, '2026-07-09'],
    ]);
    expect(c[0]).toEqual([0, '2026-07-08']);
  });

  test('DT10 a plain date ranks before a transaction date', () => {
    const c = dateCandidates([row('Date: 2026-07-10'), row('Transaction 2026-07-09')]);
    expect(c).toEqual([
      [1, '2026-07-10'],
      [2, '2026-07-09'],
    ]);
  });

  test('DT11 birth and dob rows are skipped', () => {
    const c = dateCandidates([row('Birth Date: 2026-01-01'), row('DOB 01/02/2026'), row('Date: 2026-07-08')]);
    expect(c).toEqual([[1, '2026-07-08']]);
  });

  test('DT12 equal priorities sort by the date string', () => {
    const c = dateCandidates([row('Date: 2026-07-08'), row('Date: 2026-07-01')]);
    expect(c[0]).toEqual([1, '2026-07-01']);
    expect(c).toHaveLength(2);
  });

  test('DT14 a word whose first three letters are a month abbreviation', () => {
    expect(datesIn('Mayo 5, 2026')).toEqual(['2026-05-05']);
  });

  test('DT15 "dob" inside a longer word skips the row (no word boundary)', () => {
    const c = dateCandidates([row('Adobe Date: 2026-01-01'), row('Date: 2026-07-08')]);
    expect(c).toEqual([[1, '2026-07-08']]);
  });

  test('DT16 day or month zero and day above 31 are no date', () => {
    expect(datesIn('00/05/2026')).toEqual([]);
    expect(datesIn('12/00/2026')).toEqual([]);
    expect(datesIn('12/32/2026')).toEqual([]);
  });

  test('DT17 both parts 12 or less and different gives no candidate in either order', () => {
    expect(datesIn('06/05/2026')).toEqual([]);
    expect(datesIn('05/06/2026')).toEqual([]);
  });

  test('DT18 equal parts give the same date either way', () => {
    expect(datesIn('05/05/2026')).toEqual(['2026-05-05']);
  });

  test('DT19 a second part above 12 allows one reading only', () => {
    expect(datesIn('8/21/2026')).toEqual(['2026-08-21']);
  });
});

describe('looksLikeResult', () => {
  test('a text cell then a range is a result row, strict or not', () => {
    expect(looksLikeResult(row('Glucose', '70 - 110'), true)).toBe(true);
    expect(looksLikeResult(row('Glucose', '70 - 110'), false)).toBe(true);
  });

  test('a single cell is not a result row', () => {
    expect(looksLikeResult(row('Glucose'), true)).toBe(false);
  });

  test('a number after the name counts only when not strict', () => {
    expect(looksLikeResult(row('Glucose', '5.2'), true)).toBe(false);
    expect(looksLikeResult(row('Glucose', '5.2'), false)).toBe(true);
  });

  test('a first cell that is not text is not a result row', () => {
    expect(looksLikeResult(row('5.2', 'mg/dL'), false)).toBe(false);
  });
});

// ---- Part 2 (step 4): keep regions and sanitize. Pages are built from made-up words; the 25 shared vectors are read from
// docs/identity_filter/identity_filter_vectors.json. No test prints OCR-like text: failures name cases, never words. ----

interface RawWord {
  text: string;
  box: [number, number, number, number];
  confidence: number | null;
}

type RawCell = [string, number]; // text (words split on one space), left edge of its first word

const WORD_HEIGHT = 24;
const ROW_PITCH = 36;

/** The words of one printed row: each word is 12.48 px per character wide, words of one cell 8.4 px apart. */
function wordsOfRow(top: number, cells: RawCell[]): RawWord[] {
  const out: RawWord[] = [];
  for (const [text, left] of cells) {
    let x = left;
    for (const word of text.split(' ')) {
      const width = 12.48 * Array.from(word).length;
      out.push({ text: word, box: [x, top, x + width, top + WORD_HEIGHT], confidence: 0.95 });
      x += width + 8.4;
    }
  }
  return out;
}

// A small upright table of made-up rows: one header row and four result rows (columns at 60, 430, 640, 830).
const TABLE_ROWS: RawCell[][] = [
  [
    ['TEST', 60],
    ['RESULT', 420],
    ['UNIT', 640],
    ['REFERENCE RANGE', 820],
  ],
  [
    ['FBS', 60],
    ['108', 430],
    ['mg/dL', 640],
    ['70 - 100', 830],
  ],
  [
    ['Creatinine', 60],
    ['1.1', 430],
    ['mg/dL', 640],
    ['0.6 - 1.3', 830],
  ],
  [
    ['HbA1c', 60],
    ['5.9', 430],
    ['%', 640],
    ['4.0 - 5.6', 830],
  ],
  [
    ['SGPT', 60],
    ['38', 430],
    ['U/L', 640],
    ['7 - 56', 830],
  ],
];

function wordsOfTable(rows: RawCell[][], top0 = 450): RawWord[] {
  return rows.flatMap((cells, i) => wordsOfRow(top0 + ROW_PITCH * i, cells));
}

function pageOf(elements: RawWord[], size: { [key: string]: unknown } = { width: 1400, height: 2000 }): object {
  return { ...size, elements };
}

/** The kept texts of page 0 of a result (the test fails by name if there is no payload). */
function keptTexts(result: ReturnType<typeof sanitize>, pageIndex = 0): string[] {
  expect(result.payload).not.toBeNull();
  return (result.payload as NonNullable<typeof result.payload>).pages[pageIndex].elements.map((e) => e.text);
}

const BASE_TEXTS = wordsOfTable(TABLE_ROWS).map((w) => w.text);

interface FilterVectorCase {
  name: string;
  input: { pages: unknown[] };
  expect: {
    payload: { visit_date: string | null; report_type: string; page_count: number; kept_texts: string[][] } | null;
    reason?: string | null;
    doc_types: string[];
  };
}

const FILTER_VECTOR_FILE = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'docs',
  'identity_filter',
  'identity_filter_vectors.json',
);
const FILTER_VECTORS = readJsonNormalized(FILTER_VECTOR_FILE) as unknown as { cases: FilterVectorCase[]; canaries: string[] };

function vectorCase(name: string): FilterVectorCase {
  const found = FILTER_VECTORS.cases.find((c) => c.name === name);
  expect(found).toBeDefined();
  return found as FilterVectorCase;
}

describe('sanitize: the shared vectors and the plan rows', () => {
  test('VECTORS all cases of the file give the expected doc types, reason, date, type, page count and kept texts', () => {
    expect(FILTER_VECTORS.cases.length).toBeGreaterThanOrEqual(25);
    const mismatches: string[] = [];
    let passed = 0;
    for (const c of FILTER_VECTORS.cases) {
      const r = sanitize(c.input.pages);
      const e = c.expect;
      const problems: string[] = [];
      if (JSON.stringify(r.doc_types) !== JSON.stringify(e.doc_types)) {
        problems.push('doc_types');
      }
      if (r.reason !== (e.reason ?? null)) {
        problems.push('reason');
      }
      if ((r.payload === null) !== (e.payload === null)) {
        problems.push('payload_presence');
      } else if (r.payload !== null && e.payload !== null) {
        if (r.payload.visit_date !== e.payload.visit_date || r.visit_date !== e.payload.visit_date) {
          problems.push('visit_date');
        }
        if (r.payload.report_type !== e.payload.report_type) {
          problems.push('report_type');
        }
        if (r.payload.page_count !== e.payload.page_count || r.payload.pages.length !== e.payload.page_count) {
          problems.push('page_count');
        }
        const kept = r.payload.pages.map((p) => p.elements.map((el) => el.text));
        if (JSON.stringify(kept) !== JSON.stringify(e.payload.kept_texts)) {
          problems.push('kept_texts');
        }
      }
      if (problems.length === 0) {
        passed += 1;
      } else {
        mismatches.push(c.name + ': ' + problems.join(','));
      }
    }
    expect(mismatches).toEqual([]);
    expect(passed).toBe(FILTER_VECTORS.cases.length);
  });

  test('I10 a kept-region row whose first cell is "Name: X" is dropped whole and counted', () => {
    const rows = [...TABLE_ROWS.slice(0, 3), [['Name: ZZNAME', 60] as RawCell], ...TABLE_ROWS.slice(3)];
    const r = sanitize([pageOf(wordsOfTable(rows))]);
    expect(r.dropped_rows).toBe(1);
    expect(keptTexts(r)).toEqual(BASE_TEXTS);
    expect(sanitize([pageOf(wordsOfTable(TABLE_ROWS))]).dropped_rows).toBe(0);
  });

  test('I11 a label wedged after the results of a row keeps the left of it and drops the label and its value', () => {
    const rows = TABLE_ROWS.map((cells, i) => (i === 2 ? [...cells, ['Name: ZZWEDGE', 1000] as RawCell] : cells));
    const r = sanitize([pageOf(wordsOfTable(rows))]);
    const texts = keptTexts(r);
    expect(texts).toEqual(BASE_TEXTS);
    expect(texts).toContain('Creatinine');
    expect(texts).toContain('1.1');
    expect(texts).not.toContain('Name:');
    expect(texts).not.toContain('ZZWEDGE');
    expect(r.dropped_rows).toBe(1);
  });

  test('I11 the vector with signature labels on a result row keeps its table and drops the labels', () => {
    const c = vectorCase('label_wedged_in_table');
    const r = sanitize(c.input.pages);
    expect(r.reason).toBeNull();
    expect(r.dropped_rows).toBeGreaterThan(0);
    expect(keptTexts(r)).toEqual((c.expect.payload as NonNullable<typeof c.expect.payload>).kept_texts[0]);
  });

  test('I12 two pages with a drug test: nothing is sent and the document types stop at the drug test', () => {
    const r = sanitize(vectorCase('two_pages_with_drug_test').input.pages);
    expect(r.payload).toBeNull();
    expect(r.reason).toBe('drug_test_held');
    expect(r.doc_types).toEqual(['tabular', 'drug_test']);
    expect(r.visit_date).toBeNull();
    expect(r.dropped_rows).toBe(0);
  });

  test('I12 a drug test passes when the hold is switched off', () => {
    const r = sanitize(vectorCase('drug_test').input.pages, false);
    expect(r.reason).not.toBe('drug_test_held');
    expect(r.doc_types).toEqual(['drug_test']);
  });

  test('I13 no pages: no table region', () => {
    const r = sanitize([]);
    expect(r.payload).toBeNull();
    expect(r.reason).toBe('no_table_region');
    expect(r.doc_types).toEqual([]);
    expect(r.dropped_rows).toBe(0);
  });

  test('I14 a continuation page with only a header row: no results', () => {
    const r = sanitize(vectorCase('sgd_continuation').input.pages);
    expect(r.payload).toBeNull();
    expect(r.reason).toBe('no_results');
    expect(r.doc_types).toEqual(['empty']);
  });

  test('I15 a table page then an empty page: two pages, 102 kept words then none', () => {
    const r = sanitize(vectorCase('two_pages_hematology_then_empty').input.pages);
    expect(r.payload).not.toBeNull();
    const payload = r.payload as NonNullable<typeof r.payload>;
    expect(payload.page_count).toBe(2);
    expect(payload.pages.map((p) => p.elements.length)).toEqual([102, 0]);
    expect(payload.pages.map((p) => p.page_index)).toEqual([0, 1]);
  });

  test('I16 input Python rejects throws (the app filterScan turns a throw into could_not_read; tested in src/scan)', () => {
    expect(() => sanitize([42] as never)).toThrow();
    expect(() => sanitize([null] as never)).toThrow();
    expect(() => sanitize(['x'] as never)).toThrow();
    expect(() => sanitize([{ elements: 42 }] as never)).toThrow();
  });

  test('I17 a kept word is cut to 200 code points', () => {
    const withFlag = (word: string): RawWord[] =>
      wordsOfTable(TABLE_ROWS.map((cells, i) => (i === 1 ? [...cells, [word, 1100] as RawCell] : cells)));
    const plain = keptTexts(sanitize([pageOf(withFlag('a'.repeat(201)))]));
    expect(plain).toContain('a'.repeat(200));
    expect(plain.some((t) => t.length > 200)).toBe(false);
    const emoji = keptTexts(sanitize([pageOf(withFlag('a'.repeat(199) + '\u{1F600}' + 'b'))]));
    expect(emoji).toContain('a'.repeat(199) + '\u{1F600}');
    expect(emoji.some((t) => t.endsWith('b') && t.length > 100)).toBe(false);
  });

  test('I18 box values are rounded to two places, half to even on the exact double', () => {
    // The middle result row is placed so that its centre is 1.5, the centre of the odd box; the rows are level, so the
    // skew is 0 and deskew leaves every box as it is.
    const odd: RawWord = { text: 'zz', box: [10.125, 0.375, 10.135, 2.675], confidence: 0.9 };
    const words = wordsOfTable(TABLE_ROWS, -10.5 - 2 * ROW_PITCH);
    const r = sanitize([pageOf([...words, odd])]);
    const payload = r.payload as NonNullable<typeof r.payload>;
    const kept = payload.pages[0].elements.find((e) => e.text === 'zz');
    expect(kept).toBeDefined();
    expect((kept as NonNullable<typeof kept>).box).toEqual([10.12, 0.38, 10.13, 2.67]);
    const everyBoxHasTwoPlaces = payload.pages[0].elements.every((e) =>
      e.box.every((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9),
    );
    expect(everyBoxHasTwoPlaces).toBe(true);
  });

  test('I19 a page width or height of 0, null or missing becomes 1.0; a real size is kept', () => {
    const words = wordsOfTable(TABLE_ROWS);
    const sizeOf = (size: { [key: string]: unknown }): [number, number] => {
      const payload = sanitize([pageOf(words, size)]).payload as NonNullable<ReturnType<typeof sanitize>['payload']>;
      return [payload.pages[0].width, payload.pages[0].height];
    };
    expect(sizeOf({ width: 0, height: 2000 })).toEqual([1.0, 2000]);
    expect(sizeOf({ height: 2000 })).toEqual([1.0, 2000]);
    expect(sizeOf({ width: null, height: 2000 })).toEqual([1.0, 2000]);
    expect(sizeOf({ width: 1400, height: 0 })).toEqual([1400, 1.0]);
    expect(sizeOf({ width: 1400 })).toEqual([1400, 1.0]);
    expect(sizeOf({ width: 1400, height: null })).toEqual([1400, 1.0]);
    expect(sizeOf({ width: 1400, height: 2000 })).toEqual([1400, 2000]);
  });

  test('I20 every payload the port makes for the vectors passes validatePayload', () => {
    let withPayload = 0;
    const invalid: string[] = [];
    for (const c of FILTER_VECTORS.cases) {
      const r = sanitize(c.input.pages);
      if (r.payload !== null) {
        withPayload += 1;
        if (!validatePayload(r.payload).valid) {
          invalid.push(c.name);
        }
      }
    }
    expect(withPayload).toBe(17);
    expect(invalid).toEqual([]);
  });

  test('I21 no canary of the vectors file appears in any kept text, visit date or report type', () => {
    expect(FILTER_VECTORS.canaries.length).toBeGreaterThan(0);
    let leaks = 0;
    for (const c of FILTER_VECTORS.cases) {
      const r = sanitize(c.input.pages);
      if (r.payload === null) {
        continue;
      }
      const haystack = [
        ...r.payload.pages.flatMap((p) => p.elements.map((e) => e.text)),
        r.payload.visit_date ?? '',
        r.payload.report_type,
      ].map((s) => s.toLowerCase());
      for (const canary of FILTER_VECTORS.canaries) {
        if (haystack.some((s) => s.includes(canary.toLowerCase()))) {
          leaks += 1;
        }
      }
    }
    expect(leaks).toBe(0);
  });
});
