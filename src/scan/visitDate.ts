// Visit date as text (MOB-03, decision D4). The date is the LOCAL calendar day: toISOString would give the UTC day, which
// is the day before for a time just after local midnight east of UTC. Pure TypeScript.

const VISIT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Lowest accepted year. An earlier year is a misread (0000, or a two-digit year written as 00xx), not a visit. */
export const MIN_VISIT_YEAR = 1900;

function twoDigits(value: number): string {
  return value < 10 ? '0' + value : String(value);
}

/** The local calendar day of a Date as YYYY-MM-DD. */
export function toVisitDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  return year + '-' + twoDigits(date.getMonth() + 1) + '-' + twoDigits(date.getDate());
}

/**
 * True when text is a real calendar day written YYYY-MM-DD, in a year of MIN_VISIT_YEAR (1900) or later, and not later
 * than today's local calendar day. A shape mismatch, a year before 1900 (0000-01-01, 0026-07-08), a day that does not
 * exist (2026-02-29, 2026-04-31, 2026-13-45, a zero month or day) and a future day are all false. Today itself is true. `today` is a parameter so that a caller or test can fix the clock; an invalid clock (a Date holding NaN) gives false.
 */
export function isVisitDate(text: string, today: Date = new Date()): boolean {
  // An invalid clock is false on purpose. It would be false anyway, but only by accident: "2026-07-08" is not <= "0NaN-NaN-NaN".
  if (Number.isNaN(today.getTime())) {
    return false;
  }
  if (!VISIT_DATE_PATTERN.test(text)) {
    return false;
  }
  const year = Number(text.slice(0, 4));
  if (year < MIN_VISIT_YEAR) {
    return false;
  }
  const month = Number(text.slice(5, 7));
  const day = Number(text.slice(8, 10));
  const built = new Date(2000, 0, 1);
  // With the year bound the Date constructor would also do; setFullYear is kept so that years 0000-0099 are never remapped.
  built.setFullYear(year, month - 1, day);
  if (built.getFullYear() !== year || built.getMonth() !== month - 1 || built.getDate() !== day) {
    return false;
  }
  return text <= toVisitDate(today);
}

/**
 * The text to prefill in the date field: the candidate (for example the date the identity filter found) when it is a valid
 * visit date that is not in the future, else an empty string so that the user types the date.
 */
export function prefillDate(candidate: string | null, today: Date = new Date()): string {
  return typeof candidate === 'string' && isVisitDate(candidate, today) ? candidate : '';
}
