// Document classification and report-section detection (ML-27/ML-28, S9): port of ml/parsing/classify.py, line by line
// in Python's operation order. The marker and header tables and the value kinds are read from engine_constants.json
// (decision D8); the section keywords are written here with the classify.py line they come from. Python's str.lower,
// strip, split and \s come from ../py/text (decision D7). max(counts, key=...) is the first-extreme helper (D15). Plain
// TypeScript, no logging, no React Native, fs or path import.
import { engineConstants } from '../data';
import { firstMax } from '../py/sort';
import { PY_SPACE_CLASS, pyLower, pySplit, pyStrip } from '../py/text';
import { resolve } from './dictionary';
import { classifyCell } from './extract';
import { Row, rowText } from './layout';

const CLASSIFY = engineConstants.classify;
export const DRUG_MARKERS: readonly string[] = CLASSIFY.drug_markers; // L12
export const NARRATIVE_MARKERS: readonly string[] = CLASSIFY.narrative_markers; // L14
export const HEADER_PHRASES: ReadonlySet<string> = new Set<string>(CLASSIFY.header_phrases); // L16
const VALUE_KINDS: ReadonlySet<string> = new Set<string>(CLASSIFY.value_kinds); // L22

const NOT_CLEAN = /[^a-z0-9\/. ]+/gu; // L26
const SPACE_RUNS = new RegExp(PY_SPACE_CLASS + '+', 'gu'); // L26, \s+

/** _clean (L25): lower case, every run of other characters becomes one space, runs of spaces collapse, then strip. */
export function cleanText(text: string): string {
  return pyStrip(pyLower(text).replace(NOT_CLEAN, ' ').replace(SPACE_RUNS, ' '));
}

/** is_header_row (L29): a row made of column-heading phrases. */
export function isHeaderRow(row: Row): boolean {
  const cells = row.cells.filter((c) => pyStrip(c.text) !== '').map((c) => cleanText(c.text)); // L30
  if (cells.length === 0) {
    return false; // L32
  }
  const hits = cells.filter((c) => HEADER_PHRASES.has(c)).length; // L33
  return (
    hits >= 2 ||
    (cells.length === 1 && hits === 1 && pySplit(cells[0]).length > 1) ||
    (hits >= 0.5 * cells.length && hits >= 1 && cells.length >= 2)
  ); // L34, "and" binds tighter than "or"
}

/** is_result_row (L37): a row holding a recognizable test name and at least one value-like cell. */
export function isResultRow(row: Row, section: string | null = null): boolean {
  const cells = row.cells; // L39
  if (cells.length < 2) {
    return false; // L40
  }
  const hasValue = cells.slice(1).some((c) => VALUE_KINDS.has(classifyCell(c.text).kind)); // L42
  if (!hasValue) {
    return false; // L44
  }
  return cells.some(
    (c) =>
      classifyCell(c.text).kind === 'text' &&
      (resolve(c.text, section) !== null || resolve(c.text, 'urinalysis') !== null),
  ); // L45
}

function hasAny(text: string, words: readonly string[]): boolean {
  return words.some((w) => text.includes(w));
}

/** detect_section (L49): the report section implied by a heading, or null. */
export function detectSection(text: string): string | null {
  const t = pyLower(text); // L51
  if (hasAny(t, ['urinalysis', 'clinical microscopy', 'microscopic examination', 'urine'])) {
    return 'urinalysis'; // L52
  }
  if (hasAny(t, ['hematology', 'complete blood count', 'cbc'])) {
    return 'hematology'; // L54
  }
  if (hasAny(t, ['chemistry', 'lipid', 'metabolic panel', 'liver function', 'thyroid'])) {
    return 'chemistry'; // L56
  }
  if (hasAny(t, ['radiolog', 'x-ray', 'xray', 'ultrasound', 'ct scan', 'mri'])) {
    return 'radiology'; // L58
  }
  return null;
}

/** report_type_of (L63): best report_type guess for display grouping; never used to decide what gets scored. */
export function reportTypeOf(rows: readonly Row[]): string | null {
  const counts = new Map<string, number>(); // L65, a Map keeps insertion order as a dict does
  for (const r of rows) {
    const s = detectSection(rowText(r)); // L67
    if (s !== null) {
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
  }
  if (counts.size === 0) {
    return null; // L71
  }
  // L72: max(counts, key=lambda k: (counts[k], k == "urinalysis")); the pair (n, flag) orders like 2 * n + flag
  const best = firstMax(Array.from(counts.keys()), (k) => 2 * (counts.get(k) as number) + (k === 'urinalysis' ? 1 : 0));
  return best === undefined ? null : best;
}

/** classify (L75): tabular | narrative | drug_test | empty | unrecognized. */
export function classify(rows: readonly Row[]): string {
  const blob = rows.map((r) => pyLower(rowText(r))).join(' '); // L77
  if (hasAny(blob, DRUG_MARKERS)) {
    return 'drug_test'; // L78
  }
  const resultRows = rows.filter((r) => isResultRow(r)).length; // L80
  if (resultRows >= 2) {
    return 'tabular'; // L82
  }
  if (rows.some((r) => isHeaderRow(r))) {
    return 'empty'; // L84
  }
  if (hasAny(blob, NARRATIVE_MARKERS)) {
    return 'narrative'; // L86
  }
  return 'unrecognized';
}
