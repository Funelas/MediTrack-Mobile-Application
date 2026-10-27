// MOB-03 step 11: saving an engine report and loading the history rows (plan 6.6, decisions D29 to D31).
// saveEngineReport writes one checkup_reports row and one test_results row per saved row, in one write, as one batch.
// loadHistoryRows reads the saved rows back in the shape that buildHistory (src/scan/history.ts) takes.
// Only types are imported from ../scan, so this file pulls no engine code into the database project.
import {Database, Model, Q} from '@nozbe/watermelondb';
import type {HistoryRow} from '../scan/history';
import type {SavedReportFields, SavedRow} from '../scan/saveRows';
import CheckupReport from './models/CheckupReport';
import TestResult from './models/TestResult';

export interface EngineReportToSave {
  report: SavedReportFields;
  rows: SavedRow[];
}

export interface SaveTarget {
  /** The id of the new report row (the visit id of the parser record). */
  visitId: string;
  categoryId: string;
}

/** The raw record, for the id and the timestamps that the models do not let a setter write (created_at, updated_at). */
function rawOf(record: Model): Record<string, unknown> {
  return record._raw as unknown as Record<string, unknown>;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local midnight of a "YYYY-MM-DD" day, as a timestamp (D29: the day is Contract B's, already checked upstream). */
function localMidnight(visitDay: string): number {
  const match = DAY.exec(visitDay);
  if (match === null) {
    throw new Error('visit day is not YYYY-MM-DD');
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
}

/**
 * Saves a report and its rows in one `db.write`, as one batch (all or nothing). The report row gets the visit id as its id,
 * the check-up day, the Contract B text and both versions; the rows carry every field of `SavedRow`. Returns the report id.
 * An id that already exists is not handled here: the batch is rejected by the adapter and nothing is written.
 */
export async function saveEngineReport(
  db: Database,
  saved: EngineReportToSave,
  target: SaveTarget,
): Promise<string> {
  const reports = db.get<CheckupReport>('checkup_reports');
  const results = db.get<TestResult>('test_results');
  const checkupDate = localMidnight(saved.report.visitDay);
  const now = Date.now();
  await db.write(async () => {
    const report = reports.prepareCreate(r => {
      rawOf(r).id = target.visitId;
      r.categoryId = target.categoryId;
      r.checkupDate = new Date(checkupDate);
      r.visitDay = saved.report.visitDay;
      r.contractB = saved.report.contractBJson;
      r.parserVersion = saved.report.parserVersion;
      r.dictionaryVersion = saved.report.dictionaryVersion;
      rawOf(r).created_at = now;
      rawOf(r).updated_at = now;
    });
    const rows = saved.rows.map(row =>
      results.prepareCreate(t => {
        t.reportId = target.visitId;
        t.testName = row.test_name;
        t.unit = row.unit;
        t.normalRange = row.normal_range;
        t.value = row.value;
        t.status = row.status;
        t.canonicalCode = row.canonical_code;
        t.severity = row.severity;
        t.direction = row.direction;
        t.rangeBasis = row.range_basis;
        t.resultType = row.result_type;
        t.valueStd = row.value_std;
        t.refLow = row.ref_low;
        t.refHigh = row.ref_high;
        t.refSource = row.ref_source;
        t.valueSource = row.value_source;
        t.position = row.position;
        t.confidence = row.confidence;
        t.reviewReasons = row.review_reasons;
        t.flag = row.flag;
        rawOf(t).created_at = now;
      }),
    );
    await db.batch(report, ...rows);
  });
  return target.visitId;
}

/**
 * The saved rows that count for the history: rows with a canonical code whose report has a visit day. Legacy rows and
 * reports without a visit day are left out by the queries. A saved unit of '' is read as null (D30: Contract B stores a
 * null unit as '', and buildHistory compares with the dictionary standard unit, which is null for a unitless analyte).
 */
export async function loadHistoryRows(db: Database): Promise<HistoryRow[]> {
  const reports = await db
    .get<CheckupReport>('checkup_reports')
    .query(Q.where('visit_day', Q.notEq(null)))
    .fetch();
  const reportById = new Map<string, CheckupReport>();
  reports.forEach(r => reportById.set(r.id, r));
  const rows = await db
    .get<TestResult>('test_results')
    .query(Q.where('canonical_code', Q.notEq(null)))
    .fetch();
  const out: HistoryRow[] = [];
  rows.forEach(row => {
    const report = reportById.get(row.reportId);
    if (report === undefined || report.visitDay === null) {
      return;
    }
    out.push({
      canonicalCode: row.canonicalCode,
      resultType: row.resultType,
      valueStd: row.valueStd,
      unit: row.unit === '' ? null : row.unit,
      checkupDay: report.visitDay,
      createdAt: report.createdAt.getTime(),
      position: row.position === null ? 0 : row.position,
    });
  });
  return out;
}
