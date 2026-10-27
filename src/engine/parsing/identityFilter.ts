// Identity filter, part 1 (MOB-03 takeover, step 3): labels, footer and dates of ml/parsing/identity_filter.py
// (_identity_cell_index, _row_has_identity, _row_is_footer, _dates_in, _date_candidates, _looks_like_result). The keep
// regions and sanitize (step 4) follow them in this module. The identity and signature expressions come from ./identityLabels, the
// cell typing from ./extract and the footer prefixes from identity_filter_config.json (no label list is typed here); the
// twelve month abbreviations (_MONTHS, L51) are not in the config and are a local constant. Python's \s, \d and \b are the
// Unicode ones: PY_SPACE_CLASS, PY_DIGIT_CLASS and lookarounds on PY_WORD_CLASS with the u flag; [A-Za-z] stays ASCII;
// int() is digitsToAscii then parseInt. A footer prefix is matched as re.I would (pyIgnoreCase and the flags iu), with no
// colon or end required. Where Python raises, this code throws; nothing is caught.
// Plain TypeScript, no logging, no React Native, fs or path import.
import { identityFilterConfig } from '../data';
import { stableSort } from '../py/sort';
import { pyRound } from '../py/round';
import {
  digitsToAscii,
  pyFloat,
  pyIgnoreCase,
  pyLower,
  pySlice,
  pySplit,
  PY_DIGIT_CLASS,
  PY_SPACE_CLASS,
  PY_WORD_CLASS,
} from '../py/text';
import { classify, detectSection, isHeaderRow, isResultRow, reportTypeOf } from './classify';
import { classifyCell } from './extract';
import { IDENTITY_RE, SIGNATURE_RE } from './identityLabels';
import {
  buildCells,
  cellLeft,
  deskew,
  Element,
  elementRight,
  elementsFromPage,
  groupRows,
  Row,
  rowText,
} from './layout';

const S = PY_SPACE_CLASS; // \s
const D = PY_DIGIT_CLASS; // \d
const B_START = '(?<!' + PY_WORD_CLASS + ')'; // \b before a word character
const B_END = '(?!' + PY_WORD_CLASS + ')'; // \b after a word character

/** _RE_FOOTER (L49): optional whitespace, then any footer prefix (config order), no colon or end required. */
const FOOTER_RE: RegExp = new RegExp(
  '^' + S + '*(?:' + identityFilterConfig.footer_prefixes.map(pyIgnoreCase).join('|') + ')',
  'iu',
);

// _MONTHS (L51): the first three letters of a month name, lower case, to its number.
const MONTHS: readonly string[] = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// The three date shapes of _dates_in (L85, L87, L91); the g flag is for matchAll only, which clones the expression.
const ISO_DATE = new RegExp(B_START + '(20' + D + '{2})-(' + D + '{1,2})-(' + D + '{1,2})' + B_END, 'gu');
const SLASH_DATE = new RegExp(B_START + '(' + D + '{1,2})/(' + D + '{1,2})/(20' + D + '{2})' + B_END, 'gu');
const NAMED_DATE = new RegExp(
  B_START + '([A-Za-z]{3,9})(?:-|' + S + ')(' + D + '{1,2})(?:[-,]|' + S + ')+(20' + D + '{2})' + B_END,
  'gu',
);
const DATE_WORD = new RegExp(B_START + 'date' + B_END, 'u'); // \bdate\b (L107)
const BIRTH_OR_DOB = /birth|dob/; // L104, no word boundary

/** int(s) on a run of Unicode decimal digits. */
function toInt(digits: string): number {
  return parseInt(digitsToAscii(digits), 10);
}

/** f"{n:04d}" for a non-negative n. */
function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

/** f"{n:02d}" for a non-negative n. */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** _identity_cell_index (L66): index of the first cell carrying an identity or signature label, or null. */
export function identityCellIndex(row: Row): number | null {
  for (let i = 0; i < row.cells.length; i += 1) {
    const text = row.cells[i].text;
    if (IDENTITY_RE.test(text) || SIGNATURE_RE.test(text)) {
      return i;
    }
  }
  return null;
}

/** _row_has_identity (L74). */
export function rowHasIdentity(row: Row): boolean {
  return identityCellIndex(row) !== null;
}

/** _row_is_footer (L78): the first cell starts with a footer prefix, or any cell carries a signature label. */
export function rowIsFooter(row: Row): boolean {
  return (
    row.cells.length > 0 && (FOOTER_RE.test(row.cells[0].text) || row.cells.some((c) => SIGNATURE_RE.test(c.text)))
  );
}

/** _dates_in (L83): ISO dates, then day/month/year or month/day/year, then "Mon d, yyyy" dates, as YYYY-MM-DD strings. */
export function datesIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(ISO_DATE)) {
    out.push(pad4(toInt(m[1])) + '-' + pad2(toInt(m[2])) + '-' + pad2(toInt(m[3]))); // L86
  }
  for (const m of text.matchAll(SLASH_DATE)) {
    const a = toInt(m[1]);
    const b = toInt(m[2]);
    // Ambiguous (D/M or M/D): this row gives no candidate; a lower-ranked date may be offered for confirmation.
    if (a >= 1 && a <= 12 && b >= 1 && b <= 12 && a !== b) continue;
    const [mo, da] = a <= 12 ? [a, b] : [b, a]; // L88
    if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
      out.push(pad4(toInt(m[3])) + '-' + pad2(mo) + '-' + pad2(da)); // L90
    }
  }
  for (const m of text.matchAll(NAMED_DATE)) {
    const index = MONTHS.indexOf(pyLower(pySlice(m[1], 3))); // L92
    const mo = index + 1;
    if (mo !== 0 && toInt(m[2]) >= 1 && toInt(m[2]) <= 31) {
      out.push(pad4(toInt(m[3])) + '-' + pad2(mo) + '-' + pad2(toInt(m[2]))); // L94
    }
  }
  return out;
}

/**
 * _date_candidates (L98): (priority, date) pairs sorted as Python sorts tuples (priority, then date string by code
 * unit). Collection dates rank first; birth dates are never candidates.
 */
export function dateCandidates(rows: readonly Row[]): Array<[number, string]> {
  const out: Array<[number, string]> = [];
  for (const r of rows) {
    const t = rowText(r);
    const low = pyLower(t);
    if (BIRTH_OR_DOB.test(low)) {
      continue;
    }
    const priority = low.includes('collection')
      ? 0
      : low.includes('transaction') || low.includes('report date')
        ? 2
        : DATE_WORD.test(low)
          ? 1
          : 3;
    for (const d of datesIn(t)) {
      out.push([priority, d]);
    }
  }
  return stableSort(out, (a, b) => {
    if (a[0] !== b[0]) {
      return a[0] - b[0];
    }
    return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
  });
}

/**
 * _looks_like_result (L121): a text cell followed by a value-like cell (strict: by a range or a unit, which names and
 * identity lines never have).
 */
export function looksLikeResult(row: Row, strict: boolean): boolean {
  if (row.cells.length < 2 || classifyCell(row.cells[0].text).kind !== 'text') {
    return false;
  }
  const kinds = row.cells.slice(1).map((c) => classifyCell(c.text).kind);
  const wanted = strict ? ['range', 'unit'] : ['range', 'unit', 'number', 'qual', 'mixed'];
  return kinds.some((k) => wanted.includes(k));
}

// ---- Keep regions and sanitize (MOB-03 takeover, step 4; L132 to L214) ----------------------------------------------

/** A region of rows as [start, endExclusive): the Python range(start, end + 1). */
export type RegionSpan = [number, number];

const REPORT_RE = new RegExp(pyIgnoreCase('report'), 'iu'); // L158, re.search(r"report", ..., re.I)
const IMPRESSION_RE = new RegExp(['impression', 'findings'].map(pyIgnoreCase).join('|'), 'iu'); // L161

/** _keep_region_tabular (L132): the rows from the header or the first result row to the last result-like row, or null. */
export function keepRegionTabular(rows: readonly Row[]): RegionSpan | null {
  let header: number | null = null; // L133
  for (let i = 0; i < rows.length; i += 1) {
    if (isHeaderRow(rows[i]) && !rowHasIdentity(rows[i])) {
      header = i;
      break;
    }
  }
  const resultIdx: number[] = []; // L134
  for (let i = 0; i < rows.length; i += 1) {
    if (isResultRow(rows[i]) && !rowHasIdentity(rows[i])) {
      resultIdx.push(i);
    }
  }
  if (resultIdx.length === 0) {
    return null; // L136
  }
  let first = resultIdx[0]; // L137
  const last = resultIdx[resultIdx.length - 1];
  while (
    first > 0 &&
    !rowHasIdentity(rows[first - 1]) &&
    !rowIsFooter(rows[first - 1]) &&
    !isHeaderRow(rows[first - 1]) &&
    looksLikeResult(rows[first - 1], true)
  ) {
    first -= 1; // L138 to L139
  }
  let start = header !== null && header <= first ? header : first; // L140
  if (start === first) {
    // L141: headerless, so also keep up to two heading-like rows directly above
    for (const j of [first - 1, first - 2]) {
      if (
        j >= 0 &&
        !rowHasIdentity(rows[j]) &&
        !rowIsFooter(rows[j]) &&
        pySplit(rowText(rows[j])).length <= 5 &&
        !rowText(rows[j]).includes(':')
      ) {
        start = j; // L144 to L145
      } else {
        break; // L147
      }
    }
  }
  let end = last; // L148
  for (let i = last + 1; i < rows.length; i += 1) {
    if (rowHasIdentity(rows[i]) || rowIsFooter(rows[i])) {
      break; // L150 to L151
    }
    end = isResultRow(rows[i]) || looksLikeResult(rows[i], false) ? i : end; // L152
  }
  return [start, end + 1]; // L153
}

/** _keep_region_narrative (L156): from the report title (or the first impression or findings row) to before the footer. */
export function keepRegionNarrative(rows: readonly Row[]): RegionSpan | null {
  let title: number | null = null; // L157
  for (let i = 0; i < rows.length; i += 1) {
    if (REPORT_RE.test(rowText(rows[i])) && detectSection(rowText(rows[i])) === 'radiology' && !rowHasIdentity(rows[i])) {
      title = i;
      break;
    }
  }
  if (title === null) {
    for (let i = 0; i < rows.length; i += 1) {
      if (IMPRESSION_RE.test(rowText(rows[i]))) {
        title = i; // L161
        break;
      }
    }
    if (title === null) {
      return null; // L163
    }
  }
  let end = rows.length - 1; // L164
  for (let i = title + 1; i < rows.length; i += 1) {
    if (rowIsFooter(rows[i]) || SIGNATURE_RE.test(rows[i].cells.length > 0 ? rows[i].cells[0].text : '')) {
      end = i - 1; // L167
      break;
    }
  }
  return [title, end + 1]; // L169
}

/** A word of the sanitized payload (ocr_payload_contract.json). */
export interface PayloadElement {
  text: string;
  box: number[];
  confidence: number | null;
}

/** A page of the sanitized payload; a page that kept nothing is still listed. */
export interface PayloadPage {
  page_index: number;
  width: number;
  height: number;
  elements: PayloadElement[];
}

/** The sanitized payload (the key order is the one of the Python dict). */
export interface SanitizedPayload {
  visit_date: string | null;
  report_type: string;
  page_count: number;
  pages: PayloadPage[];
}

export type FilterReason = 'no_table_region' | 'no_results' | 'drug_test_held';

/** FilterResult (L113); the shape src/scan/identityFilter.ts expects. */
export interface FilterResult {
  payload: SanitizedPayload | null;
  reason: FilterReason | null;
  doc_types: string[];
  visit_date: string | null;
  dropped_rows: number;
}

type PageDict = { [key: string]: unknown };

/** float(page.get(key) or 1.0) (L203): a falsy or missing value gives 1.0; a value float() cannot read throws. */
function pageSize(page: PageDict, key: string): number {
  const raw = Object.prototype.hasOwnProperty.call(page, key) ? page[key] : null;
  const falsy =
    raw === null ||
    raw === undefined ||
    raw === false ||
    raw === 0 ||
    raw === '' ||
    (Array.isArray(raw) && raw.length === 0) ||
    (typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw as PageDict).length === 0);
  if (falsy) {
    return 1.0;
  }
  if (typeof raw === 'number') {
    return raw;
  }
  if (raw === true) {
    return 1.0;
  }
  if (typeof raw === 'string') {
    const parsed = pyFloat(raw);
    if (parsed === null) {
      throw new Error('ValueError: not a float');
    }
    return parsed;
  }
  throw new Error('TypeError: not a number');
}

/**
 * sanitize (L172): raw ML Kit pages -> sanitized payload, or no payload with the reason. Where Python raises (a page that
 * is not a dict, elements that cannot be read) this throws and catches nothing; the app's filterScan turns a throw into
 * could_not_read.
 */
export function sanitize(rawPages: readonly unknown[], holdDrugTests = true): FilterResult {
  const outPages: PayloadPage[] = []; // L176
  const docTypes: string[] = [];
  const allRows: Row[] = [];
  let dropped = 0;
  for (let idx = 0; idx < rawPages.length; idx += 1) {
    const page = rawPages[idx]; // L180
    const els = deskew(elementsFromPage(page)); // L181, throws for a page that is not a dict
    const elRows = groupRows(els); // L182
    const rows: Row[] = elRows.map((r) => ({ cells: buildCells(r) })); // L183
    allRows.push(...rows); // L184
    const kind = rows.length > 0 ? classify(rows) : 'unrecognized'; // L185
    docTypes.push(kind); // L186
    if (kind === 'drug_test' && holdDrugTests) {
      return { payload: null, reason: 'drug_test_held', doc_types: docTypes, visit_date: null, dropped_rows: 0 }; // L188
    }
    const span = kind === 'tabular' ? keepRegionTabular(rows) : kind === 'narrative' ? keepRegionNarrative(rows) : null; // L189
    const kept: Element[] = []; // L190
    if (span !== null) {
      for (let i = span[0]; i < span[1]; i += 1) {
        const k = identityCellIndex(rows[i]); // L195
        if (k === null) {
          kept.push(...elRows[i]); // L197
          continue;
        }
        dropped += 1; // L199
        if (k > 0) {
          // L200: a label wedged after results on the same printed row: keep only what is left of it
          const cut = cellLeft(rows[i].cells[k]); // L201
          kept.push(...elRows[i].filter((e) => elementRight(e) <= cut)); // L202
        }
      }
    }
    const pageDict = page as PageDict; // a dict, or elementsFromPage would have thrown
    outPages.push({
      page_index: idx, // L203
      width: pageSize(pageDict, 'width'),
      height: pageSize(pageDict, 'height'),
      elements: kept.map((e) => ({
        text: pySlice(e.text, 200), // L205
        box: e.box.map((v) => pyRound(v, 2)),
        confidence: e.conf,
      })),
    });
  }
  if (!outPages.some((p) => p.elements.length > 0)) {
    // L207
    const reason: FilterReason =
      docTypes.length > 0 && docTypes.every((k) => k === 'empty') ? 'no_results' : 'no_table_region'; // L208
    return { payload: null, reason, doc_types: docTypes, visit_date: null, dropped_rows: dropped }; // L209
  }
  const dates = dateCandidates(allRows); // L210
  const visitDate = dates.length > 0 ? dates[0][1] : null; // L211
  const payload: SanitizedPayload = {
    visit_date: visitDate,
    report_type: reportTypeOf(allRows) || 'other', // L212, an empty text also becomes "other"
    page_count: outPages.length,
    pages: outPages,
  };
  return { payload, reason: null, doc_types: docTypes, visit_date: visitDate, dropped_rows: dropped }; // L214
}
