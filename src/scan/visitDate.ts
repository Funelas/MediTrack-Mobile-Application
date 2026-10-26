// Visit date as text (MOB-03, decision D4). The date is the LOCAL calendar day: toISOString would give the UTC day, which
// is the day before for a time just after local midnight east of UTC. Pure TypeScript.

const VISIT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function twoDigits(value: number): string {
  return value < 10 ? '0' + value : String(value);
}

/** The local calendar day of a Date as YYYY-MM-DD. */
export function toVisitDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  return year + '-' + twoDigits(date.getMonth() + 1) + '-' + twoDigits(date.getDate());
}

/**
 * True when text is a real calendar day written YYYY-MM-DD and is not later than today's local calendar day. A shape
 * mismatch, a day that does not exist (2026-02-29, 2026-04-31, 2026-13-45, a zero month or day) and a future day are all
 * false. Today itself is true. `today` is a parameter so that a caller or test can fix the clock.
 */
export function isVisitDate(text: string, today: Date = new Date()): boolean {
  if (!VISIT_DATE_PATTERN.test(text)) {
    return false;
  }
  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(5, 7));
  const day = Number(text.slice(8, 10));
  const built = new Date(2000, 0, 1);
  // setFullYear keeps years 0000-0099 as written; the Date constructor would map them to 1900-1999.
  built.setFullYear(year, month - 1, day);
  if (built.getFullYear() !== year || built.getMonth() !== month - 1 || built.getDate() !== day) {
    return false;
  }
  return text <= toVisitDate(today);
}
