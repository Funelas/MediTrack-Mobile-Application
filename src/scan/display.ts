// Display helpers for the scan screens (MOB-03 step 7, plan 6.2 to 6.5). Pure TypeScript. They only map and format: no
// clinical value is computed here. Severity is shown as a status word (statusFor), never as the severity itself; the words
// "diagnosis", "mild" and "significant" are never part of any text this file returns. The wording of reasonText and
// unknownLabel is project-defined display text (draft until the correction-screen spec is approved).
import { unitConversions } from '../engine/data';

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

/** Why a result has no status: no range to compare with, or no value read. Empty for any other severity. */
export function unknownLabel(severity: string): string {
  if (severity === 'indeterminate') {
    return 'No range to compare';
  }
  if (severity === 'unreadable') {
    return 'Could not read';
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
