// The typed range on the correction screen (MOB-03 step 8, plan D34). Pure TypeScript. parseBound reads one typed limit
// strictly and checkRangeInput does the phone-side checks before the engine's own rule (applyRangeAnswer). Nothing is
// corrected silently: a comma, a sign, a leading dot or a letter is invalid and the user types it again.

export type BoundParse = { kind: 'empty' } | { kind: 'number'; value: number } | { kind: 'invalid' };

export type RangeReason = 'need_a_bound' | 'low_not_below_high';

export type RangeCheck = { ok: true; low: number | null; high: number | null } | { ok: false; reason: RangeReason };

/** The fixed texts for the range answer; the screen shows these and does not retype them. */
export const RANGE_MESSAGES = {
  need_a_bound: "Type at least one limit, or choose 'No range is printed'.",
  low_not_below_high: 'The lowest value must be below the highest.',
  engine_rejected: 'Check the number and unit, as printed on the report.',
} as const;

const PLAIN_NUMBER = /^[0-9]+(\.[0-9]+)?$/;

/** Reads one typed limit: blank is no limit, plain digits with an optional decimal part are a number, all else is invalid. */
export function parseBound(text: string): BoundParse {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { kind: 'empty' };
  }
  if (!PLAIN_NUMBER.test(trimmed)) {
    return { kind: 'invalid' };
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? { kind: 'number', value } : { kind: 'invalid' };
}

/**
 * The phone-side checks on a typed range. "No range is printed" gives no bounds. Otherwise at least one bound is needed,
 * and two bounds must have the lower one below the higher one. A single bound is passed on; the engine checks it.
 */
export function checkRangeInput(low: number | null, high: number | null, noRange: boolean): RangeCheck {
  if (noRange) {
    return { ok: true, low: null, high: null };
  }
  if (low === null && high === null) {
    return { ok: false, reason: 'need_a_bound' };
  }
  if (low !== null && high !== null && !(low < high)) {
    return { ok: false, reason: 'low_not_below_high' };
  }
  return { ok: true, low, high };
}
