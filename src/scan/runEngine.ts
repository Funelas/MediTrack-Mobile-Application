// From raw pages to a Contract A record and a Contract B (MOB-03, plan 6.1 and 6.2). Pure TypeScript. filterScan calls the
// identity filter (the seam in identityFilter.ts); readPayload parses what the filter let through; applyRangeAnswer and
// scoreRows take the typed range and score the rows. None keeps or returns an error message, because a message could
// quote report text; a failure is a kind (or ok: false) only.
import {
  applyTypedRange,
  buildContractB,
  ContractB,
  ContractBParameter,
  parseReport,
  ParseOutput,
  ResultRow,
  reviewReasons,
  splitForReview,
  validateB,
  validatePayload,
} from '../engine';
import { FilterReason, IdentityFilter } from './identityFilter';
import { RawPage } from './mlkitPages';
import { isVisitDate } from './visitDate';

export type FilterScanResult =
  | { kind: 'payload'; payload: object; dateCandidate: string | null }
  | { kind: 'no_table'; reason: FilterReason }
  | { kind: 'could_not_read' };

type ContractARecord = ParseOutput['record'];
type Row = ContractARecord['results'][number];

export interface ReadItem {
  index: number;
  row: Row;
  reasons: string[];
}

export interface ReadContext {
  visitId: string;
  visitDate: string;
  sex: string | null;
  /** The clock for the future-date check; defaults to now. Tests pass a fixed one. */
  today?: Date;
}

export type ReadResult =
  | { kind: 'date_required' }
  | { kind: 'could_not_read' }
  | {
      kind: 'read';
      record: ContractARecord;
      noteCount: number;
      /** Notes that say the sex was unknown and the widest printed range was used; counted, never kept. */
      widestRangeCount: number;
      /** Parsed results that are not scored (not `supported`), so they are not in the Contract B. */
      unsupportedCount: number;
      items: ReadItem[];
      reviewIndexes: number[];
      readyIndexes: number[];
    };

/** The ending of the parser's note for an analyte read with the widest printed range (parser.ts, sex unknown). */
const WIDEST_RANGE_NOTE_END = ': sex unknown, used the widest printed range';

/** Runs the identity filter on the raw pages. A payload of null is "no table"; an exception is "could not read". */
export function filterScan(pages: RawPage[], filter: IdentityFilter): FilterScanResult {
  try {
    const result = filter(pages);
    if (result.payload === null) {
      if (result.reason === null) {
        return { kind: 'could_not_read' };
      }
      return { kind: 'no_table', reason: result.reason };
    }
    return { kind: 'payload', payload: result.payload, dateCandidate: result.visit_date };
  } catch {
    return { kind: 'could_not_read' };
  }
}

/**
 * Parses a sanitized payload with the date the user confirmed (D5: the payload's own date is never used here, so an empty,
 * malformed, nonexistent or future date is `date_required`). The sex comes from the profile and may be null (D6); no
 * scoring weights are passed (D7). An invalid payload or any parser exception is `could_not_read`, with no message.
 */
export function readPayload(payload: unknown, ctx: ReadContext): ReadResult {
  if (typeof ctx.visitDate !== 'string' || !isVisitDate(ctx.visitDate, ctx.today)) {
    return { kind: 'date_required' };
  }
  try {
    if (!validatePayload(payload).valid) {
      return { kind: 'could_not_read' };
    }
    const out = parseReport(payload, { visitId: ctx.visitId, visitDate: ctx.visitDate, sex: ctx.sex });
    const results = out.record.results;
    const split = splitForReview(out.record);
    const items = results.map((row, index) => ({ index, row, reasons: reviewReasons(row) }));
    const indexOf = (row: Row): number => results.findIndex((r) => r === row);
    return {
      kind: 'read',
      record: out.record,
      noteCount: out.notes.length,
      widestRangeCount: out.notes.filter((note) => note.endsWith(WIDEST_RANGE_NOTE_END)).length,
      unsupportedCount: results.filter((row) => row.supported !== true).length,
      items,
      reviewIndexes: split.toReview.map(indexOf),
      readyIndexes: split.ready.map(indexOf),
    };
  } catch {
    return { kind: 'could_not_read' };
  }
}

export type RangeAnswerResult = { ok: true; row: Row } | { ok: false };

/**
 * The range the user typed from the report (plan D13), applied with the engine's own rule. Both bounds null is the answer
 * "no range is printed" and is accepted. A rejected answer is `ok: false`; the engine's message is dropped, and the
 * caller shows its own fixed wording. The given row is not changed.
 */
export function applyRangeAnswer(row: Row, low: number | null, high: number | null): RangeAnswerResult {
  try {
    return { ok: true, row: applyTypedRange(row, low, high) };
  } catch {
    return { ok: false };
  }
}

export interface RowPair {
  a: Row;
  b: ContractBParameter;
}

export type ScoreResult =
  | { kind: 'scored'; contractB: ContractB; pairs: RowPair[] }
  | { kind: 'could_not_read' };

/**
 * Pairs the Contract B parameters with the Contract A rows that have `supported === true`, in order (plan D9). Returns
 * null when the counts differ or any `test_name` of a pair differs.
 */
export function pairRows(results: readonly Row[], contractB: ContractB): RowPair[] | null {
  const supported = results.filter((row) => row.supported === true);
  if (supported.length !== contractB.parameters.length) {
    return null;
  }
  const pairs: RowPair[] = [];
  for (let i = 0; i < supported.length; i += 1) {
    if (supported[i].test_name !== contractB.parameters[i].test_name) {
      return null;
    }
    pairs.push({ a: supported[i], b: contractB.parameters[i] });
  }
  return pairs;
}

/** The scoring body shared by scoreRows and scoreRowsForTests; `weights` is undefined for the app. */
function scoreWith(
  results: readonly Row[],
  visitDate: string,
  history: { readonly [code: string]: readonly unknown[] } | null,
  weights: { readonly [code: string]: unknown } | null | undefined,
): ScoreResult {
  try {
    const contractB = buildContractB(visitDate, results as readonly ResultRow[], history, weights);
    if (!validateB(contractB).valid) {
      return { kind: 'could_not_read' };
    }
    const pairs = pairRows(results, contractB);
    if (pairs === null) {
      return { kind: 'could_not_read' };
    }
    return { kind: 'scored', contractB, pairs };
  } catch {
    return { kind: 'could_not_read' };
  }
}

/**
 * Scores every row as if confirmed (ML-13 is undecided), checks the Contract B, and pairs it with the rows. An invalid
 * Contract B, a pairing mismatch or any exception is `could_not_read`, with no message. It takes no weights: the app
 * passes none (D7).
 */
export function scoreRows(
  results: readonly Row[],
  visitDate: string,
  history: { readonly [code: string]: readonly unknown[] } | null,
): ScoreResult {
  return scoreWith(results, visitDate, history, undefined);
}

/** scoreRows with the weights of a vector case. For tests only: the app must not call it. */
export function scoreRowsForTests(
  results: readonly Row[],
  visitDate: string,
  history: { readonly [code: string]: readonly unknown[] } | null,
  weights: { readonly [code: string]: unknown } | null,
): ScoreResult {
  return scoreWith(results, visitDate, history, weights);
}
