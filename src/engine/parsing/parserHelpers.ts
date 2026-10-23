// Parser helpers (ML-27/ML-28, S11a): port of the helper functions of ml/parsing/parser.py (_typed, _split_streams,
// _first_value_group, _unit_score, _infer_unit, _convert, _within, _default_interval, _sexed_ranges, _blocks and the
// _Group dataclass), line by line in Python's operation order. Every result must equal the Python one (docs/engine_vectors/
// parse_helpers.json, exact comparison). _VALUE_KINDS is read from engine_constants.json (decision D8); the other numbers
// are literals of the Python and carry the parser.py line they come from. statistics.median is pyMedian, max and min
// use the first-extreme helpers (D15). The Python generator _blocks returns an array here (its consumer reads all of it).
// _build_result, _unreadable_row and the review functions belong to S11b and S12. Plain TypeScript, no logging, no React
// Native, fs or path import.
import { engineConstants, unitConversions } from '../data';
import { convertToStandard, isUnitlessFraction, toStandardUnit } from '../contracts/units';
import { firstMax, firstMin, pyMedian } from '../py/sort';
import { pySplit, pyStrip } from '../py/text';
import { detectSection } from './classify';
import { entry as dictionaryEntry, resolve } from './dictionary';
import { canonicalUnit, classifyCell, Typed } from './extract';
import { Cell, cellHeight, cellLeft, Row } from './layout';

const VALUE_KINDS: ReadonlySet<string> = new Set<string>(engineConstants.parser.value_kinds); // L30

/** A cell and what it was read as: the (Cell, Typed) pair of parser.py. */
export type TypedCell = [Cell, Typed];

/** A _Group (parser.py L47): one value (or only a unit or range) with its unit, printed range, flag and cells. */
export interface Group {
  value: Typed | null;
  unit: string | null;
  rng: Typed | null;
  flag: string | null;
  cells: Cell[];
}

/** One _blocks item: the name cell, the typed rows that follow it, and the report section in force. */
export type Block = [Cell, TypedCell[][], string | null];

/** The part of a dictionary entry _within reads. */
export interface PlausibleEntry {
  plausible_range?: number[] | null;
}

/** The part of a dictionary entry _default_interval reads. */
export interface DefaultIntervalEntry {
  default_ref_interval?: unknown;
}

/** The (value, ref_low, ref_high) triple that _convert and _infer_unit return. */
export type ConvertedTriple = [number | null, number | null, number | null];

function newGroup(): Group {
  return { value: null, unit: null, rng: null, flag: null, cells: [] };
}

/** Python truth value of a string or None. */
function truthyText(s: string | null): boolean {
  return s !== null && s !== '';
}

/** Python truth value of a JSON value (None, False, 0, "", [] and {} are false). */
function pyTruthy(value: unknown): boolean {
  if (value === null || value === undefined || value === false || value === 0 || value === '') {
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

/**
 * _typed (L55): type each cell. A cell that cannot be read as a whole but is made only of numbers, ranges, units and
 * marks ('0.50-0.70 f 0.78', merged because the gaps were small) is split into its tokens, which share the cell's box.
 */
export function typed(rowCells: Cell[]): TypedCell[] {
  const out: TypedCell[] = [];
  for (const c of rowCells) {
    const t = classifyCell(c.text); // L61
    const words = pySplit(c.text); // L62
    if (t.kind === 'text' && words.length >= 2) {
      const parts = words.map((w) => classifyCell(w)); // L64
      if (parts.some((p) => p.kind === 'number' || p.kind === 'range') && parts.every((p) => p.kind !== 'text')) {
        if (parts.some((p) => p.kind === 'junk')) {
          // a stray mark sat in the same cell as the value
          for (const p of parts) {
            if (p.kind === 'number' || p.kind === 'range') {
              p.stray = true;
            }
          }
        }
        words.forEach((w, i) => {
          out.push([{ text: w, box: c.box, conf: c.conf, n_words: 1 }, parts[i]]); // L70
        });
        continue;
      }
    }
    out.push([c, t]);
  }
  return out;
}

/**
 * _split_streams (L76): one stream per side-by-side table (usually one). The split is a column x position found where
 * several rows carry a second recognizable test name at a consistent distance from the first.
 */
export function splitStreams(rows: Row[], section: string | null): Cell[][][] {
  const seconds: number[] = [];
  const heights: number[] = [];
  for (const r of rows) {
    const names = r.cells.filter((c) => classifyCell(c.text).kind === 'text' && resolve(c.text, section) !== null); // L82
    if (names.length >= 2) {
      seconds.push(cellLeft(names[1]));
      heights.push(cellHeight(names[1]));
    }
  }
  if (seconds.length >= 2) {
    const spread = (firstMax(seconds, (x) => x) as number) - (firstMin(seconds, (x) => x) as number);
    if (spread <= 3 * pyMedian(heights)) {
      // L86: the median is evaluated only when two second names were found
      const split = (firstMin(seconds, (x) => x) as number) - pyMedian(heights);
      const left = rows.map((r) => r.cells.filter((c) => cellLeft(c) < split));
      const right = rows.map((r) => r.cells.filter((c) => cellLeft(c) >= split));
      return [left, right];
    }
  }
  return [rows.map((r) => r.cells.slice())];
}

/** _first_value_group (L94): the groups of value, unit, range and flag found in reading order. */
export function firstValueGroup(cells: TypedCell[]): Group[] {
  const groups: Group[] = [];
  let cur: Group | null = null;
  for (const [cell, t] of cells) {
    if (t.kind === 'junk') {
      continue;
    }
    if (VALUE_KINDS.has(t.kind) || (t.kind === 'range' && t.is_count_range)) {
      if (cur === null || cur.value !== null) {
        cur = newGroup();
        groups.push(cur);
      }
      cur.value = t;
      cur.cells.push(cell);
      if (truthyText(t.unit) && !truthyText(cur.unit)) {
        cur.unit = t.unit;
      }
      if (truthyText(t.flag)) {
        cur.flag = t.flag;
      }
    } else if (t.kind === 'unit') {
      if (cur === null || truthyText(cur.unit) || (cur.rng !== null && cur.value === null)) {
        cur = newGroup();
        groups.push(cur);
      }
      cur.unit = t.text;
      cur.cells.push(cell);
    } else if (t.kind === 'range') {
      if (cur === null || cur.rng !== null) {
        cur = newGroup();
        groups.push(cur);
      }
      cur.rng = t;
      cur.cells.push(cell);
      if (truthyText(t.unit) && !truthyText(cur.unit)) {
        cur.unit = t.unit;
      }
    } else if (t.kind === 'flag' && cur !== null) {
      cur.flag = t.flag;
    }
  }
  return groups;
}

/** _unit_score (L126): 2 = already the standard unit, 1 = convertible, 0 = unknown or mismatched. */
export function unitScore(code: string | null, unit: string | null, value: number | null): number {
  if (code === null) {
    return 0;
  }
  const std = dictionaryEntry(code).standard_unit; // L130
  if (std === null) {
    return !truthyText(unit) ? 2 : 0;
  }
  let u = unit;
  if (u !== null && u !== '') {
    const fixed = canonicalUnit(u);
    u = fixed !== null ? fixed[0] : u;
    if (truthyText(toStandardUnit(code, u))) {
      return 2;
    }
  }
  if (convertToStandard(code, value !== null ? value : 1.0, u) !== null) {
    return 1;
  }
  return 0;
}

/**
 * _within (L187): true when the value, or no plausible range, or no value; both ends inclusive. A missing key and a
 * null range are the same (entry.get).
 */
export function within(entry: PlausibleEntry, value: number | null): boolean {
  const pr = entry.plausible_range;
  return value === null || pr === undefined || pr === null || (pr[0] <= value && value <= pr[1]);
}

/**
 * _convert (L159): convert value and range bounds with the same rule. A fraction is converted only when the value and
 * every printed bound are at most 1.0, so a percentage is never multiplied twice. A unitless value of a fraction code
 * (ML-29, project-defined) is converted only when at least one bound is printed and every printed bound is below 1.0;
 * otherwise it is kept as printed. Returns null when there is no conversion.
 */
export function convert(
  code: string,
  value: number | null,
  unit: string | null,
  refLow: number | null,
  refHigh: number | null,
): ConvertedTriple | null {
  if (value === null) {
    return null;
  }
  if (isUnitlessFraction(code, unit)) {
    // ML-29, project-defined
    const printed = [refLow, refHigh].filter((b): b is number => b !== null);
    if (printed.length === 0 || printed.some((b) => b >= 1.0)) {
      return null;
    }
  }
  const conv = convertToStandard(code, value, unit);
  if (conv === null) {
    return null;
  }
  const out: Array<number | null> = [conv.value];
  for (const bound of [refLow, refHigh]) {
    if (bound === null) {
      out.push(null);
      continue;
    }
    const cb = convertToStandard(code, bound, unit);
    if (cb === null) {
      return null;
    }
    out.push(cb.value);
  }
  return [out[0], out[1], out[2]];
}

/**
 * _infer_unit (L143): no unit was read and the value is implausible in the standard unit (134 for hemoglobin). If a
 * listed conversion makes the value and the printed range plausible, use it; the caller flags the row for
 * confirmation. Returns [value, ref_low, ref_high] or null.
 */
export function inferUnit(
  code: string,
  entry: PlausibleEntry,
  value: number | null,
  refLow: number | null,
  refHigh: number | null,
): ConvertedTriple | null {
  if (within(entry, value)) {
    return null;
  }
  const rules = [...unitConversions.linear, ...unitConversions.affine].filter((r) => r.canonical_code === code); // L150
  for (const r of rules) {
    const conv = convert(code, value, r.from_unit, refLow, refHigh);
    if (conv !== null && within(entry, conv[0]) && conv.slice(1).every((b) => b === null || within(entry, b))) {
      return conv;
    }
  }
  return null;
}

/**
 * _default_interval (L192): the dictionary default interval for a sex, or null. No default is shipped (ticket ML-04), so
 * the branch that finds one is never reached by a dictionary entry.
 */
export function defaultInterval(entry: DefaultIntervalEntry, sex: string | null): [number, number] | null {
  const iv = entry.default_ref_interval as { [key: string]: unknown } | null | undefined;
  if (!pyTruthy(iv)) {
    return null;
  }
  const table = iv as { [key: string]: unknown };
  if ((sex === 'male' || sex === 'female') && pyTruthy(table[sex])) {
    const sexed = table[sex] as { low: number; high: number };
    return [sexed.low, sexed.high];
  }
  return [table.low as number, table.high as number];
}

/**
 * _sexed_ranges (L201): the first range printed after each sex word in the rows of a block, keyed by the sex word
 * (male or female), in the order found.
 */
export function sexedRanges(blockCells: TypedCell[][]): { [sex: string]: Typed } {
  const out: { [sex: string]: Typed } = {};
  for (const row of blockCells) {
    let sex: string | null = null;
    for (const [, t] of row) {
      if (t.kind === 'sex') {
        sex = t.flag;
      } else if (t.kind === 'range' && truthyText(sex) && !Object.prototype.hasOwnProperty.call(out, sex as string)) {
        out[sex as string] = t;
      }
    }
  }
  return out;
}

/**
 * _blocks (L375): the (name_cell, [typed rows], section) blocks of a stream. A row that starts with a text cell opens a
 * block; following rows that do not start with text (male/female lines, a spanning result) continue it. The Python
 * notes argument is never read; it is accepted so that a caller can mirror the Python call.
 */
export function blocks(stream: Cell[][], section: string | null, _notes?: string[]): Block[] {
  const out: Block[] = [];
  let curName: Cell | null = null;
  let curRows: TypedCell[][] = [];
  let curSection: string | null = section;
  let blockSection: string | null = section;
  for (const cells of stream) {
    let typedCells = typed(cells);
    const kept = typedCells.filter(([c, t]) => !(t.kind === 'junk' && Array.from(pyStrip(c.text)).length <= 2)); // L384
    typedCells = kept.length > 0 ? kept : typedCells;
    if (typedCells.length === 0) {
      continue;
    }
    const [firstCell, first] = typedCells[0];
    if (first.kind === 'text') {
      if (curName !== null) {
        out.push([curName, curRows, blockSection]);
      }
      if (typedCells.length === 1 && detectSection(firstCell.text) !== null) {
        curSection = detectSection(firstCell.text);
        curName = null;
        curRows = [];
        continue;
      }
      curName = firstCell;
      curRows = [typedCells.slice(1)];
      blockSection = curSection;
    } else if (curName !== null) {
      curRows.push(typedCells);
    }
  }
  if (curName !== null) {
    out.push([curName, curRows, blockSection]);
  }
  return out;
}
