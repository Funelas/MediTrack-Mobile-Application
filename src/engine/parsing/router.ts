// Router (ML-27/ML-28, S9): port of ml/parsing/router.py. Decides which Contract A rows reach scoring. A row is supported
// when its dictionary code is numeric or qualitative and the printed result agrees with that kind, or when it has no
// dictionary match, is numeric, and the lab printed its own reference range. mark_supported changes the record it is
// given and returns that same record, as the Python does. Plain TypeScript, no logging, no React Native, fs or path import.
import { dictionary } from '../data';

/** One Contract A result; only the keys the router reads are named. */
export interface ResultRow {
  [key: string]: unknown;
}

/** A Contract A record: the router reads only results. */
export interface RecordWithResults {
  results: ResultRow[];
  [key: string]: unknown;
}

function isNone(value: unknown): boolean {
  return value === null || value === undefined; // Python None; a missing key reads as None through .get
}

/** Python truth value of a JSON value (bool(value_text)). */
function pyTruthy(value: unknown): boolean {
  if (isNone(value) || value === false || value === 0 || value === '') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value as object).length > 0;
  }
  return true;
}

function isNumericType(resultType: unknown): boolean {
  return resultType === 'numeric' || resultType === 'range';
}

/** is_supported (L13). */
export function isSupported(result: ResultRow): boolean {
  const code = result.canonical_code; // L14
  const numericResult = isNumericType(result.result_type) && !isNone(result.value); // L15
  if (isNone(code)) {
    const printed = result.ref_source === 'printed' && (!isNone(result.ref_low) || !isNone(result.ref_high)); // L17
    return numericResult && printed; // L19
  }
  // L20: .get(code) is None for a code that is not a dictionary key (a number or an inherited property name too)
  if (typeof code !== 'string' || !Object.prototype.hasOwnProperty.call(dictionary.analytes, code)) {
    return false; // L22
  }
  const kind = dictionary.analytes[code].result_kind; // L23
  if (kind === 'numeric') {
    return isNumericType(result.result_type); // L25, a missing value is scored as unreadable
  }
  if (kind === 'qualitative') {
    return result.result_type === 'qualitative' && pyTruthy(result.value_text); // L27
  }
  return false; // L28
}

/** mark_supported (L31): sets supported on every result of the record and returns the record. */
export function markSupported(record: RecordWithResults): RecordWithResults {
  for (const r of record.results) {
    r.supported = isSupported(r); // L33
  }
  return record;
}
