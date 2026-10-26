// History for the trend step (MOB-03 step 6, plan decision D8; B3 for units). Pure TypeScript. buildHistory turns the saved
// rows of earlier visits into the `history` argument of scoreRows: for each canonical code, the earlier values, oldest first.
// The standard unit of a code is read from the engine dictionary, not typed here.
import { dictionary } from '../engine/data';

/** One saved result row, as the history needs it. `checkupDay` is YYYY-MM-DD; `createdAt` is the save time of its report. */
export interface HistoryRow {
  canonicalCode: string | null;
  resultType: string | null;
  valueStd: number | null;
  unit: string | null;
  checkupDay: string;
  createdAt: number;
  position: number;
}

export type History = { [code: string]: (number | null)[] };

const UNMAPPED = 'unknown_unmapped';

/** The standard unit of a code, wrapped so that a null unit differs from a code the dictionary does not hold (undefined). */
function standardUnitOf(code: string): { unit: string | null } | undefined {
  if (!Object.prototype.hasOwnProperty.call(dictionary.analytes, code)) {
    return undefined;
  }
  return { unit: dictionary.analytes[code].standard_unit };
}

/**
 * The values of earlier visits for each code, oldest first (D8). Counted: rows of a strictly earlier `checkupDay` than
 * `currentVisitDate`, with a numeric or range result and a canonical code that the dictionary holds. A row with a value
 * must have been saved in the standard unit of its code, otherwise it is skipped (B3); an unreadable row (no value) is
 * kept as a null gap. A code that repeats within one report (same day and save time) counts once, at its first position.
 */
export function buildHistory(saved: readonly HistoryRow[], currentVisitDate: string): History {
  const eligible = saved.filter((row) => {
    if (row.checkupDay >= currentVisitDate) {
      return false;
    }
    if (row.resultType !== 'numeric' && row.resultType !== 'range') {
      return false;
    }
    if (row.canonicalCode === null || row.canonicalCode === UNMAPPED) {
      return false;
    }
    const standard = standardUnitOf(row.canonicalCode);
    if (standard === undefined) {
      return false;
    }
    return row.valueStd === null || row.unit === standard.unit;
  });
  const ordered = [...eligible].sort(
    (a, b) =>
      (a.checkupDay < b.checkupDay ? -1 : a.checkupDay > b.checkupDay ? 1 : 0) ||
      a.createdAt - b.createdAt ||
      a.position - b.position,
  );
  const seen = new Set<string>();
  const history: History = {};
  ordered.forEach((row) => {
    const code = row.canonicalCode as string;
    const key = JSON.stringify([row.checkupDay, row.createdAt, code]);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    if (!Object.prototype.hasOwnProperty.call(history, code)) {
      history[code] = [];
    }
    history[code].push(row.valueStd);
  });
  return history;
}
