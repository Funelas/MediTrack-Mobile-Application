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

/** True when text has the shape YYYY-MM-DD. The shape only: it does not check that the day exists. */
export function isVisitDate(text: string): boolean {
  return VISIT_DATE_PATTERN.test(text);
}
