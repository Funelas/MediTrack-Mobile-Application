// Rows prepared for saving (MOB-03 step 8, plan 6.2 and 6.6). Pure TypeScript. toSavedReport takes the scored result and the
// Contract A record and returns the report fields and one row per Contract B parameter, in Contract B order. Every
// clinical field is copied from the Contract B parameter as it is (nothing is computed or rounded here); the status comes
// from statusFor. Rows the engine does not support have no parameter and are not saved (decision U4). A failure, such as
// statusFor throwing on a broken record, is a kind only, with no message, because a message could quote report text.
import { ContractB, ContractBParameter, ParseOutput } from '../engine';
import { formatRange, Status, statusFor } from './display';
import { RowPair, ScoreResult } from './runEngine';

type ContractARecord = ParseOutput['record'];

/** One row to save: the new columns of plan 6.6, with snake_case keys, plus the display fields. */
export interface SavedRow {
  test_name: string;
  canonical_code: string;
  severity: string;
  direction: string | null;
  range_basis: string;
  result_type: string | null;
  value_std: number | null;
  ref_low: number | null;
  ref_high: number | null;
  ref_source: string | null;
  value_source: string | null;
  position: number;
  value: string;
  unit: string;
  normal_range: string;
  status: Status;
}

export interface SavedReportFields {
  contractBJson: string;
  parserVersion: string;
  dictionaryVersion: string;
}

export type SaveResult =
  | { kind: 'saved'; report: SavedReportFields; rows: SavedRow[] }
  | { kind: 'could_not_read' };

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** The text shown as the value: the number as it is, else the qualitative text, else empty. */
function shownValue(valueStd: number | null, valueText: string | null): string {
  if (valueStd !== null) {
    return String(valueStd);
  }
  return valueText === null ? '' : valueText;
}

function savedRow(pair: RowPair, index: number): SavedRow {
  const b: ContractBParameter = pair.b;
  const refLow = finiteOrNull(pair.a.ref_low);
  const refHigh = finiteOrNull(pair.a.ref_high);
  const valueStd = finiteOrNull(b.value);
  return {
    test_name: b.test_name,
    canonical_code: b.canonical_code,
    severity: b.severity,
    direction: b.direction,
    range_basis: b.range_basis,
    result_type: textOrNull(b.result_type),
    value_std: valueStd,
    ref_low: refLow,
    ref_high: refHigh,
    ref_source: textOrNull(pair.a.ref_source),
    value_source: textOrNull(pair.a.value_source),
    position: index,
    value: shownValue(valueStd, textOrNull(b.value_text)),
    unit: b.unit === null ? '' : b.unit,
    normal_range: formatRange(refLow, refHigh),
    status: statusFor(b.severity, b.direction),
  };
}

/**
 * The report fields and the rows to save, from a scored result and the Contract A record. The whole Contract B is kept as
 * JSON text, and the parser and dictionary versions are read from the record. A result that is not `scored`, a record
 * without both versions, or any exception (such as statusFor on an abnormal severity with no direction) is
 * `could_not_read`. The inputs are not changed.
 */
export function toSavedReport(scored: ScoreResult, record: ContractARecord): SaveResult {
  try {
    if (scored.kind !== 'scored') {
      return { kind: 'could_not_read' };
    }
    const parserVersion = record.parser_version;
    const dictionaryVersion = record.dictionary_version;
    if (typeof parserVersion !== 'string' || parserVersion === '') {
      return { kind: 'could_not_read' };
    }
    if (typeof dictionaryVersion !== 'string' || dictionaryVersion === '') {
      return { kind: 'could_not_read' };
    }
    const contractB: ContractB = scored.contractB;
    const rows = scored.pairs.map((pair, index) => savedRow(pair, index));
    return {
      kind: 'saved',
      report: { contractBJson: JSON.stringify(contractB), parserVersion, dictionaryVersion },
      rows,
    };
  } catch {
    return { kind: 'could_not_read' };
  }
}
