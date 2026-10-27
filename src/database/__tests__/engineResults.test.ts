// MOB-03 step 11: saveEngineReport and loadHistoryRows on a LokiJS database at schema version 7 (rows SV6, H12, H13, H14, T2 and
// T3 of the plan, and the read-back of the saved rows). The e1 case is row_E1_e1_manifest_history of docs/engine_vectors/endtoend.json;
// its tests are skipped when the vector files are absent. Expected values are typed here or read from the vector files, never
// computed from the code under test. Every database is closed after its test, so that LokiJS's autosave timer does not keep Node alive.
import {Database, Model} from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import logger from '@nozbe/watermelondb/utils/common/logger';
import {Json, compareWithHeader, loadVectorFile} from '../../engine/__tests__/helpers/vectors';
import {buildHistory} from '../../scan/history';
import {ReadResult, ScoreResult, readPayload, scoreRows, scoreRowsForTests} from '../../scan/runEngine';
import {SaveResult, SavedRow, toSavedReport} from '../../scan/saveRows';
import {loadHistoryRows, saveEngineReport} from '../engineResults';
import CheckupReport from '../models/CheckupReport';
import TestResult from '../models/TestResult';
import {schema} from '../schema';

type Obj = {[key: string]: Json};
type Read = Extract<ReadResult, {kind: 'read'}>;
type Saved = Extract<SaveResult, {kind: 'saved'}>;
type Scored = Extract<ScoreResult, {kind: 'scored'}>;
type Trend = {pct_change: number | null; direction: string; clinical_trajectory: string};

interface EndCase {
  id: string;
  input: {parse_case: string; history: {[code: string]: number[]}; weights: {[code: string]: unknown}};
  expected: {contract_b: Json};
}

interface ParseCase {
  id: string;
  input: {payload: string; visit_id: string; sex: string | null};
}

const E1_ID = 'row_E1_e1_manifest_history';
const CURRENT = '2026-07-08';
const TODAY = new Date(2026, 11, 31);
const BASELINE: Trend = {pct_change: null, direction: 'baseline', clinical_trajectory: 'baseline'};

// The 19 fields of a saved row, written out here (plan 6.6).
const ROW_FIELDS: Array<keyof SavedRow> = [
  'test_name',
  'unit',
  'normal_range',
  'value',
  'status',
  'canonical_code',
  'severity',
  'direction',
  'range_basis',
  'result_type',
  'value_std',
  'ref_low',
  'ref_high',
  'ref_source',
  'value_source',
  'position',
  'confidence',
  'review_reasons',
  'flag',
];

/** The raw record as plain fields (the model typings know only id and status). */
function raw(record: Model): Record<string, unknown> {
  return record._raw as unknown as Record<string, unknown>;
}

const open: Database[] = [];
let counter = 0;

function makeDb(): Database {
  logger.silence(); // WatermelonDB logs every adapter step and a deprecation warning for the Loki options
  counter += 1;
  const adapter = new LokiJSAdapter({
    schema,
    dbName: 'engine_results_test_' + String(counter),
    useWebWorker: false,
    useIncrementalIndexedDB: false,
  });
  const db = new Database({adapter, modelClasses: [CheckupReport, TestResult]});
  open.push(db);
  return db;
}

function closeDb(db: Database): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    (db.adapter as any).underlyingAdapter.unsafeExecute(
      {
        loki: (loki: any) => {
          loki.close(); // stops the autosave timer so that Jest can exit
        },
      },
      (result: any) => ('error' in result ? reject(result.error) : resolve()),
    );
  });
}

afterEach(async () => {
  const dbs = open.splice(0, open.length);
  for (const db of dbs) {
    await closeDb(db);
  }
});

/** A made-up saved row in the units of the dictionary (typed literals). */
function madeUp(code: string, valueStd: number | null, unit: string, extra: Partial<SavedRow> = {}): SavedRow {
  return {
    test_name: 'made-up ' + code,
    canonical_code: code,
    severity: 'normal',
    direction: null,
    range_basis: 'printed',
    result_type: 'numeric',
    value_std: valueStd,
    ref_low: null,
    ref_high: null,
    ref_source: null,
    value_source: null,
    position: 0,
    value: valueStd === null ? '' : String(valueStd),
    unit,
    normal_range: '',
    status: 'normal',
    confidence: null,
    review_reasons: '[]',
    flag: null,
    ...extra,
  };
}

function fields(day: string): Saved['report'] {
  return {contractBJson: '{}', parserVersion: 'p-test', dictionaryVersion: 'd-test', visitDay: day};
}

function save(db: Database, id: string, day: string, rows: SavedRow[]): Promise<string> {
  return saveEngineReport(db, {report: fields(day), rows}, {visitId: id, categoryId: 'clinical'});
}

/** A page of the chemistry layout of the e1 payload, with one made-up row: urine pH 6.5, printed range 5.0 - 8.0, no unit. */
function urinePhPayload(): Obj {
  const el = (text: string, x: number, y: number, w: number): Obj => ({text, box: [x, y, x + w, y + 24], confidence: 0.95});
  return {
    visit_date: null,
    report_type: 'chemistry',
    page_count: 1,
    pages: [
      {
        page_index: 0,
        width: 1400.0,
        height: 2000.0,
        elements: [
          el('TEST', 60, 450, 50),
          el('RESULT', 420, 450, 75),
          el('UNIT', 640, 450, 50),
          el('REFERENCE', 820, 450, 112),
          el('RANGE', 940.72, 450, 62),
          el('FLAG', 1100, 450, 50),
          el('CHEMISTRY', 60, 500, 103),
          el('Urine', 60, 540, 55),
          el('pH', 125, 540, 25),
          el('6.5', 430, 540, 37),
          el('5.0', 830, 540, 25),
          el('-', 863, 540, 12),
          el('8.0', 884, 540, 37),
        ],
      },
    ],
  };
}

function mustRead(payload: unknown, visitId: string, visitDate: string): Read {
  const out = readPayload(payload, {visitId, visitDate, sex: null, today: TODAY});
  if (out.kind !== 'read') {
    throw new Error('payload not read');
  }
  return out;
}

function mustSavedRows(scored: ScoreResult, read: Read): Saved {
  const out = toSavedReport(scored, read.record);
  if (out.kind !== 'saved') {
    throw new Error('not saved');
  }
  return out;
}

function trendOf(scored: Scored, code: string): Trend {
  const p = scored.contractB.parameters.find(x => x.canonical_code === code);
  if (p === undefined) {
    throw new Error('parameter missing: ' + code);
  }
  return (p as unknown as {trend: Trend}).trend;
}

function mustScored(scored: ScoreResult): Scored {
  if (scored.kind !== 'scored') {
    throw new Error('not scored');
  }
  return scored;
}

async function reportOf(db: Database, id: string): Promise<CheckupReport> {
  return db.get<CheckupReport>('checkup_reports').find(id);
}

async function rowsOf(db: Database, reportId: string): Promise<TestResult[]> {
  const rows = await db.get<TestResult>('test_results').query().fetch();
  return rows.filter(r => r.reportId === reportId).sort((a, b) => (a.position as number) - (b.position as number));
}

const endtoend = loadVectorFile('endtoend');
const parseFile = loadVectorFile('parse');
const present = endtoend !== null && parseFile !== null;
const it_ = present ? it : it.skip;

function e1() {
  const c = ((endtoend as unknown as {cases: EndCase[]}).cases).find(x => x.id === E1_ID) as EndCase;
  const source = ((parseFile as unknown as {cases: ParseCase[]}).cases).find(p => p.id === c.input.parse_case) as ParseCase;
  const payloads = (parseFile as unknown as {payloads: {[key: string]: Json}}).payloads;
  return {
    c,
    read: (visitId: string, visitDate: string): Read => mustRead(payloads[source.input.payload], visitId, visitDate),
    score: (read: Read, date: string, history: {[code: string]: readonly unknown[]}): Scored =>
      mustScored(scoreRowsForTests(read.record.results, date, history, c.input.weights)),
  };
}

/** Reads e1 for the date, scores it with the given history and the vector weights, and prepares its rows. */
function scoreAndPrepare(visitId: string, date: string, history: {[code: string]: readonly unknown[]}) {
  const k = e1();
  const read = k.read(visitId, date);
  const scored = k.score(read, date, history);
  return {read, scored, saved: mustSavedRows(scored, read)};
}

describe('SV6: the stored day and the report id', () => {
  it_('saves e1 at 2026-07-08 with its visit day, local midnight and the given id', async () => {
    const db = makeDb();
    const {saved} = scoreAndPrepare('visit-sv6', CURRENT, {});
    const id = await saveEngineReport(db, saved, {visitId: 'visit-sv6', categoryId: 'clinical'});
    expect(id).toBe('visit-sv6');
    const report = await reportOf(db, 'visit-sv6');
    expect(report.id).toBe('visit-sv6');
    expect(raw(report).visit_day).toBe('2026-07-08');
    // 2026-07-08 00:00 at +08:00 (the zone that jest.config.js sets) is 2026-07-07T16:00:00Z.
    expect(raw(report).checkup_date).toBe(1783440000000);
    expect(report.categoryId).toBe('clinical');
  });
});

describe('read-back of a saved report', () => {
  it_('reads the rows back field by field, and the Contract B and both versions', async () => {
    const db = makeDb();
    const k = e1();
    const {read, scored, saved} = scoreAndPrepare('visit-rb', CURRENT, k.c.input.history);
    const before = Date.now();
    await saveEngineReport(db, saved, {visitId: 'visit-rb', categoryId: 'clinical'});
    const after = Date.now();

    const report = await reportOf(db, 'visit-rb');
    expect(JSON.parse(raw(report).contract_b as string)).toEqual(JSON.parse(JSON.stringify(scored.contractB)));
    expect(compareWithHeader(endtoend as never, k.c.expected.contract_b, JSON.parse(raw(report).contract_b as string))).toEqual([]);
    expect(raw(report).parser_version).toBe((endtoend as unknown as Obj).parser_version);
    expect(raw(report).dictionary_version).toBe((endtoend as unknown as Obj).dictionary_version);
    expect(raw(report).parser_version).toBe(read.record.parser_version);
    expect(raw(report).dictionary_version).toBe(read.record.dictionary_version);
    expect(raw(report).created_at as number).toBeGreaterThanOrEqual(before);
    expect(raw(report).created_at as number).toBeLessThanOrEqual(after);
    expect(raw(report).updated_at).toBe(raw(report).created_at);

    const rows = await rowsOf(db, 'visit-rb');
    expect(rows).toHaveLength(9);
    expect(saved.rows).toHaveLength(9);
    expect(ROW_FIELDS).toHaveLength(19);
    rows.forEach((row, index) => {
      ROW_FIELDS.forEach(field => {
        expect({index, field, value: raw(row)[field]}).toEqual({index, field, value: saved.rows[index][field]});
      });
      expect(raw(row).report_id).toBe('visit-rb');
      expect(raw(row).created_at).toBe(raw(report).created_at);
    });
    // The new fields are really filled in for e1 (not all null).
    expect(rows.every(r => typeof r.confidence === 'number' && r.reviewReasons === '[]')).toBe(true);
  });

  it('skips legacy rows and reports without a visit day', async () => {
    const db = makeDb();
    await save(db, 'new-report', '2026-02-01', [madeUp('ldl', 150.0, 'mg/dL')]);
    await db.write(async () => {
      const reports = db.get<CheckupReport>('checkup_reports');
      const results = db.get<TestResult>('test_results');
      // A legacy report with a legacy result (as addCheckupReport writes them): no canonical code.
      const legacy = await reports.create(r => {
        r.categoryId = 'clinical';
        r.checkupDate = new Date(2026, 0, 5);
        raw(r).created_at = 5;
        raw(r).updated_at = 5;
      });
      await results.create(t => {
        t.reportId = legacy.id;
        t.testName = 'legacy test';
        t.unit = 'mg/dL';
        t.normalRange = '1 - 2';
        t.value = '3';
        t.status = 'high';
        raw(t).created_at = 5;
      });
      // A report with no visit day that holds a row with a canonical code: left out with its report.
      const noDay = await reports.create(r => {
        r.categoryId = 'clinical';
        r.checkupDate = new Date(2026, 0, 6);
        raw(r).created_at = 6;
        raw(r).updated_at = 6;
      });
      await results.create(t => {
        t.reportId = noDay.id;
        t.testName = 'no day';
        t.unit = 'mg/dL';
        t.normalRange = '';
        t.value = '9';
        t.status = 'normal';
        raw(t).canonical_code = 'ldl';
        raw(t).result_type = 'numeric';
        raw(t).value_std = 9;
        raw(t).created_at = 6;
      });
    });
    const created = raw(await reportOf(db, 'new-report')).created_at as number;
    expect(await loadHistoryRows(db)).toEqual([
      {
        canonicalCode: 'ldl',
        resultType: 'numeric',
        valueStd: 150.0,
        unit: 'mg/dL',
        checkupDay: '2026-02-01',
        createdAt: created,
        position: 0,
      },
    ]);
  });

  it('reads a saved unit of the empty text as null', async () => {
    const db = makeDb();
    await save(db, 'unitless', '2026-02-01', [madeUp('urine_ph', 6.0, '')]);
    const rows = await loadHistoryRows(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].unit).toBeNull();
  });
});

describe('H12: a null gap saved in another unit', () => {
  it_('gives {alt: [null]} and the baseline trend, the same as with no history', async () => {
    const db = makeDb();
    await save(db, 'h12-old', '2026-02-01', [madeUp('alt', null, 'IU/L')]);
    const history = buildHistory(await loadHistoryRows(db), CURRENT);
    expect(history).toEqual({alt: [null]});
    const k = e1();
    const read = k.read('h12-now', CURRENT);
    const withGap = trendOf(k.score(read, CURRENT, history), 'alt');
    expect(withGap).toEqual(BASELINE);
    expect(trendOf(k.score(read, CURRENT, {}), 'alt')).toEqual(withGap);
  });
});

describe('H13: a unitless analyte through the database', () => {
  it('gives {urine_ph: [6.0]} and a rising, indeterminate trend of 8.33', async () => {
    const db = makeDb();
    // Contract B stores a null unit as ''. Without the ''-to-null mapping in loadHistoryRows, buildHistory would compare ''
    // with the dictionary standard unit of urine_ph (null), drop the row, and the trend would be baseline.
    await save(db, 'h13-old', '2026-02-01', [madeUp('urine_ph', 6.0, '')]);
    const history = buildHistory(await loadHistoryRows(db), CURRENT);
    expect(history).toEqual({urine_ph: [6.0]});
    const read = mustRead(urinePhPayload(), 'h13-now', CURRENT);
    const scored = mustScored(scoreRows(read.record.results, CURRENT, history));
    expect(trendOf(scored, 'urine_ph')).toEqual({pct_change: 8.33, direction: 'rising', clinical_trajectory: 'indeterminate'});
  });
});

describe('H14: a saved row of the current day', () => {
  it_('is not in the history', async () => {
    const db = makeDb();
    await save(db, 'h14-same-day', CURRENT, [madeUp('alt', 40.0, 'U/L')]);
    expect(await loadHistoryRows(db)).toHaveLength(1);
    const history = buildHistory(await loadHistoryRows(db), CURRENT);
    expect(history).toEqual({});
    const k = e1();
    expect(trendOf(k.score(k.read('h14-now', CURRENT), CURRENT, history), 'alt')).toEqual(BASELINE);
  });
});

describe('T2: chain row_E1 on schema 7', () => {
  it_('scores e1 to the vector Contract B with the history read from the database', async () => {
    const db = makeDb();
    await save(db, 't2-a', '2026-04-10', [madeUp('glucose_fasting', 126.0, 'mg/dL')]);
    await save(db, 't2-b', '2026-05-20', [madeUp('ldl', 150.0, 'mg/dL')]);
    await save(db, 't2-c', '2026-06-15', [madeUp('hdl', 58.0, 'mg/dL')]);
    const history = buildHistory(await loadHistoryRows(db), CURRENT);
    expect(history).toEqual({glucose_fasting: [126.0], ldl: [150.0], hdl: [58.0]});
    const k = e1();
    expect(history).toEqual(k.c.input.history);
    const scored = k.score(k.read('vector-visit', CURRENT), CURRENT, history);
    expect(compareWithHeader(endtoend as never, k.c.expected.contract_b, scored.contractB as unknown as Json)).toEqual([]);
    expect(trendOf(scored, 'ldl')).toEqual({pct_change: -5.33, direction: 'declining', clinical_trajectory: 'improving'});
    expect(trendOf(scored, 'hdl')).toEqual({pct_change: -10.34, direction: 'declining', clinical_trajectory: 'worsening'});
  });
});

describe('T3: the same values on a second visit', () => {
  it_('gives a stable trend of 0.0 on each of the 9 parameters', async () => {
    const db = makeDb();
    const first = scoreAndPrepare('t3-first', '2026-04-10', {});
    await saveEngineReport(db, first.saved, {visitId: 't3-first', categoryId: 'clinical'});
    const history = buildHistory(await loadHistoryRows(db), CURRENT);
    const k = e1();
    const second = k.score(k.read('t3-second', CURRENT), CURRENT, history);
    const codes = second.contractB.parameters.map(p => p.canonical_code);
    expect(codes).toEqual([
      'glucose_fasting',
      'creatinine',
      'ldl',
      'hdl',
      'triglycerides',
      'cholesterol_total',
      'hba1c',
      'alt',
      'uric_acid',
    ]);
    const values = second.contractB.parameters.map(p => p.value);
    expect(values).toEqual([108, 1.1, 142, 52, 135, 205, 5.9, 38, 8.8]);
    codes.forEach(code => {
      expect({code, trend: trendOf(second, code)}).toEqual({
        code,
        trend: {pct_change: 0, direction: 'stable', clinical_trajectory: 'stable'},
      });
    });
  });
});
