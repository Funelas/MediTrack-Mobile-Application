// Display helpers for the scan screens (MOB-03 step 7, plan 6.2 to 6.5). Pure TypeScript. They only map and format: no
// clinical value is computed here. Severity is shown as a status word (statusFor), never as the severity itself; the words
// "diagnosis", "mild" and "significant" are never part of any text this file returns. The wording of reasonText,
// basisLabel, flagLabel, rangeWithBasis, notRatedLabel and sourceNote is project-defined display text (draft until the
// correction-screen spec is approved).
import { dictionary, unitConversions } from '../engine/data';

export type Status = 'normal' | 'high' | 'low' | 'unknown';

/** What the screen shows for a result with no value at all (an em dash). */
export const NO_VALUE = '—';

/** A Contract A row, as asPrinted reads it; the other keys of the row are not read. */
export interface PrintedRow {
  value?: unknown;
  unit?: unknown;
  reported_value?: unknown;
  reported_unit?: unknown;
  canonical_code?: unknown;
}

export interface Printed {
  value: string;
  unit: string | null;
  hint: boolean;
}

/**
 * The status shown for a result, from its saved severity and direction. An abnormal severity without a direction is a
 * broken record and throws; a severity that is not recognised throws too, so it can never be shown as normal.
 */
export function statusFor(severity: string, direction: string | null): Status {
  if (severity === 'normal') {
    return 'normal';
  }
  if (severity === 'mild' || severity === 'significant') {
    if (direction === 'high') {
      return 'high';
    }
    if (direction === 'low') {
      return 'low';
    }
    throw new Error('invariant: abnormal severity without direction');
  }
  if (severity === 'indeterminate' || severity === 'unreadable') {
    return 'unknown';
  }
  throw new Error('invariant: unknown severity');
}

/** The result of safeStatus: the status, or ok false when the saved severity and direction cannot be shown. */
export type SafeStatus = { ok: true; status: Status } | { ok: false };

/** statusFor that does not throw: ok false for a broken record (the screen then shows "Could not show this result"). */
export function safeStatus(severity: string, direction: string | null): SafeStatus {
  try {
    return { ok: true, status: statusFor(severity, direction) };
  } catch {
    return { ok: false };
  }
}

/** What a range_basis means, in words for the screen; empty for a basis that is not one of the five. */
export function basisLabel(rangeBasis: string | null): string {
  if (rangeBasis === 'guideline') {
    return 'guideline cut-off';
  }
  if (rangeBasis === 'project_defined') {
    return "the app's own cut-off";
  }
  if (rangeBasis === 'lab_range') {
    return 'printed range';
  }
  if (rangeBasis === 'dictionary_default') {
    return 'general reference range';
  }
  if (rangeBasis === 'expected_value') {
    return 'expected result';
  }
  return '';
}

/**
 * The basis line of a result card: the basis in words, only for a rated row (normal, mild, significant) whose range text is
 * empty. When the range text is not empty it already states the basis, and an unrated row used no cut-off or range.
 */
export function basisLine(severity: string, rangeBasis: string | null, normalRange: string): string {
  if ((severity === 'normal' || severity === 'mild' || severity === 'significant') && normalRange === '') {
    return basisLabel(rangeBasis);
  }
  return '';
}

/** The lab's own flag, as a sentence; empty unless the flag is H, L, HH or LL. */
export function flagLabel(flag: string | null): string {
  if (flag === 'H' || flag === 'L' || flag === 'HH' || flag === 'LL') {
    return `marked ${flag} on your report`;
  }
  return '';
}

/** The sentence shown for a review reason code (plan 6.5); empty for a code that is not one of the three. */
export function reasonText(code: string): string {
  if (code === 'low_confidence') {
    return 'Check this result against your report. If it is wrong, discard the scan and enter it manually.';
  }
  if (code === 'missing_value') {
    return 'We could not read this result. It will be saved as not read.';
  }
  if (code === 'missing_range') {
    return (
      'Your report shows no normal range for this test. ' +
      'If a range is printed next to this result, type it exactly as printed.'
    );
  }
  return '';
}

/** A range as text, with the numbers as they are (no rounding, no symbols such as >= or <). */
export function formatRange(low: number | null, high: number | null): string {
  if (low !== null && high !== null) {
    return `${String(low)} - ${String(high)}`;
  }
  if (low !== null) {
    return `low limit ${String(low)}`;
  }
  if (high !== null) {
    return `high limit ${String(high)}`;
  }
  return '';
}

/**
 * A range with the basis the status rests on. For a guideline or project-defined cut-off the printed range is shown beside
 * the note that the status comes from the cut-off; for a lab range or a general reference range the range carries its
 * basis. `convertedTo` is the unit the limits were converted to, or null.
 */
export function rangeWithBasis(
  low: number | null,
  high: number | null,
  basis: string | null,
  convertedTo: string | null,
): string {
  const r = formatRange(low, high);
  const b = basisLabel(basis);
  const c = convertedTo === null ? '' : `, converted to ${convertedTo}`;
  if (basis === 'guideline' || basis === 'project_defined') {
    return r === '' ? `status by ${b}` : `${r} (printed range${c}); status by ${b}`;
  }
  if (basis === 'lab_range' || basis === 'dictionary_default') {
    return r === '' ? '' : `${r} (${b}${c})`;
  }
  return r;
}

/** What notRatedLabel reads from a saved result. */
export interface NotRatedInput {
  severity: string;
  rangeBasis: string | null;
  valueStd: number | null;
  refLow: number | null;
  refHigh: number | null;
  valueSource: string | null;
  canonicalCode: string | null;
}

/** The dictionary standard unit of a code, or null when the code or its unit is missing. */
function standardUnitOf(code: string | null): string | null {
  if (code === null || !Object.prototype.hasOwnProperty.call(dictionary.analytes, code)) {
    return null;
  }
  const unit = dictionary.analytes[code].standard_unit;
  return typeof unit === 'string' && unit !== '' ? unit : null;
}

/**
 * Why a result has no status (project-defined display text). Empty for a severity that has a status. The first matching
 * rule wins; the reason is chosen from the saved fields only, nothing is recomputed.
 */
export function notRatedLabel(input: NotRatedInput): string {
  if (input.severity === 'unreadable') {
    return 'Could not read';
  }
  if (input.severity !== 'indeterminate') {
    return '';
  }
  if (typeof input.valueStd === 'number' && Number.isFinite(input.valueStd) && input.valueStd < 0) {
    return 'Not rated: the value is below zero.';
  }
  if (input.rangeBasis === 'guideline' || input.rangeBasis === 'project_defined') {
    const std = standardUnitOf(input.canonicalCode);
    return std === null ? 'Not rated.' : `Not rated: the unit is not ${std}, the unit the cut-off uses.`;
  }
  if (input.rangeBasis === 'expected_value') {
    return 'Not rated: the app does not know this result word.';
  }
  if (input.rangeBasis === 'lab_range') {
    if (input.refLow === null && input.refHigh === null) {
      return input.valueSource === 'user'
        ? 'Not rated: your report printed no normal range.'
        : 'No range to compare';
    }
    return 'Not rated: the printed range could not be used.';
  }
  return 'Not rated.';
}

/** A note on where a range came from when the user supplied it; empty otherwise. */
export function sourceNote(valueSource: string | null, refSource: string | null): string {
  if (valueSource === 'user' && refSource === null) {
    return 'You answered that no range is printed. The result itself is as read from your report.';
  }
  if (valueSource === 'user' && refSource === 'printed') {
    return 'You typed this range from your report. The result itself is as read from your report.';
  }
  return '';
}

function isNone(value: unknown): boolean {
  return value === null || value === undefined;
}

/** A unit as shown: a null or empty unit is hidden (some tests have no unit). */
function shownUnit(unit: unknown): string | null {
  return typeof unit === 'string' && unit !== '' ? unit : null;
}

/**
 * The value and unit as the report printed them, for the correction screen. A reported value (as printed, before any
 * conversion) comes first. Otherwise the stored value is shown, except for a fraction-type test whose value lies between
 * 0 and 1 inclusive: its unit is hidden and `hint` asks the screen to tell the user to type the range exactly as printed
 * (decision B2). The fraction codes are read from the unit conversion data. The row is not changed.
 */
export function asPrinted(row: PrintedRow): Printed {
  if (!isNone(row.reported_value)) {
    return { value: String(row.reported_value), unit: shownUnit(row.reported_unit), hint: false };
  }
  const value = row.value;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { value: NO_VALUE, unit: shownUnit(row.unit), hint: false };
  }
  const code = row.canonical_code;
  const isFraction = typeof code === 'string' && unitConversions.fraction_to_percent.canonical_codes.includes(code);
  if (isFraction && value >= 0 && value <= 1) {
    return { value: String(value), unit: null, hint: true };
  }
  return { value: String(value), unit: shownUnit(row.unit), hint: false };
}
