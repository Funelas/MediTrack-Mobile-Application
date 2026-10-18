// Geometry (ML-27/ML-28, S8): port of ml/parsing/layout.py (elements, deskew, row grouping, cell building), line by
// line in Python's operation order. The three layout numbers are read from engine_constants.json (decision D8). Small
// literals inside expressions are written here with the layout.py line they come from. statistics.mean is the exact
// pyMean, statistics.median is pyMedian, sorted() is stableSort and max/min use the first-extreme helpers (D15).
// math.radians(x) is x * (pi / 180), the same product CPython computes. Plain TypeScript, no logging, no React Native,
// fs or path import.
import { engineConstants } from '../data';
import { pyMean } from '../py/mean';
import { firstMax, firstMin, pyMedian, stableSort } from '../py/sort';
import { pyFloat, pyStrip } from '../py/text';

/** [left, top, right, bottom] in image pixels. */
export type Box = [number, number, number, number];

/** A word from the OCR (the Element dataclass, layout.py L17); keys are snake_case as in the vector files (D12). */
export interface Element {
  text: string;
  box: Box;
  conf: number | null; // carried unchanged from the page; a value that is not a number fails only when averaged
}

/** Words merged into one printed cell (the Cell dataclass, L39). */
export interface Cell {
  text: string;
  box: Box;
  conf: number | null;
  n_words: number;
}

/** One printed row of cells (the Row dataclass, L58). */
export interface Row {
  cells: Cell[];
}

const LAYOUT = engineConstants.layout;
const ROW_TOLERANCE = LAYOUT.row_tolerance; // L11
const CELL_JOIN_GAP = LAYOUT.cell_join_gap; // L12
const MAX_SKEW_DEGREES = LAYOUT.max_skew_degrees; // L13

// ---- Element, Cell and Row properties (L22 to L67) -----------------------------------------------------------------

export function elementLeft(e: Element): number {
  return e.box[0]; // L23
}

export function elementTop(e: Element): number {
  return e.box[1]; // L25
}

export function elementRight(e: Element): number {
  return e.box[2]; // L27
}

export function elementBottom(e: Element): number {
  return e.box[3]; // L29
}

export function elementCx(e: Element): number {
  return (e.box[0] + e.box[2]) / 2.0; // L31
}

export function elementCy(e: Element): number {
  return (e.box[1] + e.box[3]) / 2.0; // L33
}

function pyMax2(a: number, b: number): number {
  return firstMax([a, b], (x) => x) as number;
}

export function elementHeight(e: Element): number {
  return pyMax2(e.box[3] - e.box[1], 1e-6); // L35, the floor keeps a flat box from dividing by zero
}

export function cellLeft(c: Cell): number {
  return c.box[0]; // L46
}

export function cellRight(c: Cell): number {
  return c.box[2]; // L48
}

export function cellCx(c: Cell): number {
  return (c.box[0] + c.box[2]) / 2.0; // L50
}

export function cellCy(c: Cell): number {
  return (c.box[1] + c.box[3]) / 2.0; // L52
}

export function cellHeight(c: Cell): number {
  return pyMax2(c.box[3] - c.box[1], 1e-6); // L54
}

/** Row.cy (L62): statistics.mean of the cell centres; throws for a row with no cells (StatisticsError). */
export function rowCy(row: Row): number {
  return pyMean(row.cells.map(cellCy));
}

/** Row.text (L66): the cell texts joined by one space. */
export function rowText(row: Row): string {
  return row.cells.map((c) => c.text).join(' ');
}

// ---- elements_from_page (L70) ---------------------------------------------------------------------------------------
// Input is JSON of unknown shape. Where Python raises (an element that is not a dict, text that is not a string, a box
// whose entries cannot be compared or converted), an Error is thrown; the vector files compare only that it throws.

type Obj = { [key: string]: unknown };

function isObject(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Python truth value of a JSON value. */
function pyTruthy(value: unknown): boolean {
  if (value === null || value === undefined || value === false || value === 0 || value === '') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (isObject(value)) {
    return Object.keys(value).length > 0;
  }
  return true;
}

/** value.get(key, fallback) for a dict; Python raises AttributeError for anything else. */
function pyGet(value: unknown, key: string, fallback: unknown): unknown {
  if (!isObject(value)) {
    throw new Error('AttributeError: no get');
  }
  return Object.prototype.hasOwnProperty.call(value, key) ? value[key] : fallback;
}

/** The items of `for e in value`: a list, or the characters or keys of a text or dict (all of which then fail). */
function pyIterate(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return Array.from(value);
  }
  if (isObject(value)) {
    return Object.keys(value);
  }
  throw new Error('TypeError: not iterable');
}

/** a <= b for two numbers or two texts (by code point); Python raises TypeError for anything else. */
function pyLe(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return a <= b;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    const x = Array.from(a);
    const y = Array.from(b);
    for (let i = 0; i < Math.min(x.length, y.length); i += 1) {
      const cx = x[i].codePointAt(0) as number;
      const cy = y[i].codePointAt(0) as number;
      if (cx !== cy) {
        return cx < cy;
      }
    }
    return x.length <= y.length;
  }
  throw new Error('TypeError: cannot compare');
}

/** float(v) for a number or a text; Python raises TypeError or ValueError for anything else. */
function pyToFloat(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = pyFloat(value);
    if (parsed === null) {
      throw new Error('ValueError: not a float');
    }
    return parsed;
  }
  throw new Error('TypeError: not a number');
}

/** Elements from a payload or raw page dict, dropping empty or malformed entries (L70). */
export function elementsFromPage(page: unknown): Element[] {
  const out: Element[] = [];
  for (const e of pyIterate(pyGet(page, 'elements', []))) {
    const rawText = pyGet(e, 'text', null); // L74
    const text = pyTruthy(rawText) ? rawText : '';
    if (typeof text !== 'string') {
      throw new Error('AttributeError: no strip');
    }
    const stripped = pyStrip(text);
    const box = pyGet(e, 'box', null);
    if (stripped === '' || !pyTruthy(box)) {
      continue;
    }
    let items: unknown[];
    if (Array.isArray(box)) {
      items = box;
    } else if (typeof box === 'string') {
      items = Array.from(box);
    } else if (isObject(box)) {
      if (Object.keys(box).length !== 4) {
        continue;
      }
      throw new Error('KeyError: 2'); // box[2] on a dict with text keys
    } else {
      throw new Error('TypeError: no len');
    }
    if (items.length !== 4 || pyLe(items[2], items[0]) || pyLe(items[3], items[1])) {
      continue; // L76
    }
    const values = items.map(pyToFloat);
    const conf = pyGet(e, 'confidence', null);
    out.push({
      text: stripped,
      box: [values[0], values[1], values[2], values[3]],
      conf: conf as number | null,
    });
  }
  return out;
}

// ---- median_height, estimate_skew, deskew (L82 to L130) -------------------------------------------------------------

export function medianHeight(elements: readonly Element[]): number {
  return elements.length > 0 ? pyMedian(elements.map(elementHeight)) : 0.0; // L83
}

/**
 * Skew angle in radians (positive = text runs downhill to the right), from the slope between far-apart words that sit
 * on the same printed line (L86). Returns 0 when there is too little evidence.
 */
export function estimateSkew(elements: readonly Element[]): number {
  const h = medianHeight(elements); // L89
  if (h <= 0 || elements.length < 6) {
    return 0.0; // L90
  }
  const angles: number[] = [];
  for (const a of elements) {
    let best: [number, number] | null = null;
    for (const b of elements) {
      const dx = elementCx(b) - elementCx(a);
      if (dx < 2 * h || dx > 20 * h) {
        continue; // L97
      }
      const dy = elementCy(b) - elementCy(a);
      if (Math.abs(dy) > 0.15 * dx + 0.5 * h) {
        continue; // L100
      }
      const slope = Math.abs(dy) / dx;
      if (best === null || slope < best[0]) {
        best = [slope, Math.atan2(dy, dx)];
      }
    }
    if (best !== null) {
      angles.push(best[1]);
    }
  }
  if (angles.length < 5) {
    return 0.0; // L107
  }
  const angle = pyMedian(angles);
  const limit = MAX_SKEW_DEGREES * (Math.PI / 180); // math.radians, L110
  // L111: max(-limit, min(limit, angle))
  const capped = firstMin([limit, angle], (x) => x) as number;
  return firstMax([-limit, capped], (x) => x) as number;
}

/** Rotate element centres by -angle about their centroid, keeping each box's size (L114). */
export function deskew(elements: readonly Element[], angle: number | null = null): Element[] {
  if (elements.length === 0) {
    return [];
  }
  const theta = angle === null ? estimateSkew(elements) : angle;
  if (Math.abs(theta) < 1e-4) {
    return elements.slice(); // L119, the skew floor
  }
  const ox = pyMean(elements.map(elementCx));
  const oy = pyMean(elements.map(elementCy));
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const out: Element[] = [];
  for (const e of elements) {
    const x = elementCx(e) - ox;
    const y = elementCy(e) - oy;
    const nx = x * c + y * s + ox;
    const ny = -x * s + y * c + oy;
    const w = (elementRight(e) - elementLeft(e)) / 2.0;
    const hh = (elementBottom(e) - elementTop(e)) / 2.0;
    out.push({ text: e.text, box: [nx - w, ny - hh, nx + w, ny + hh], conf: e.conf });
  }
  return out;
}

// ---- group_rows, build_cells, page_rows (L133 to L174) --------------------------------------------------------------

function compareNumbers(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Cluster elements into printed rows by vertical centre, tolerance scaled to text height (L133). */
export function groupRows(elements: readonly Element[]): Element[][] {
  if (elements.length === 0) {
    return [];
  }
  const tol = ROW_TOLERANCE * medianHeight(elements);
  const rows: Element[][] = [];
  for (const e of stableSort(elements, (a, b) => compareNumbers(elementCy(a), elementCy(b)))) {
    if (rows.length > 0 && Math.abs(elementCy(e) - pyMean(rows[rows.length - 1].map(elementCy))) <= tol) {
      rows[rows.length - 1].push(e);
    } else {
      rows.push([e]);
    }
  }
  return rows.map((r) => stableSort(r, (a, b) => compareNumbers(elementLeft(a), elementLeft(b))));
}

/**
 * Merge neighbouring words of one row into cells; a gap wider than CELL_JOIN_GAP text heights starts a new cell
 * (L147).
 */
export function buildCells(row: readonly Element[]): Cell[] {
  if (row.length === 0) {
    return [];
  }
  const h = pyMedian(row.map(elementHeight));
  const groups: Element[][] = [[row[0]]];
  for (const e of row.slice(1)) {
    const last = groups[groups.length - 1];
    if (elementLeft(e) - elementRight(last[last.length - 1]) <= CELL_JOIN_GAP * h) {
      last.push(e);
    } else {
      groups.push([e]);
    }
  }
  const cells: Cell[] = [];
  for (const g of groups) {
    const confs: number[] = [];
    for (const e of g) {
      if (e.conf !== null && e.conf !== undefined) {
        confs.push(e.conf);
      }
    }
    let left = elementLeft(g[0]);
    let top = elementTop(g[0]);
    let right = elementRight(g[0]);
    let bottom = elementBottom(g[0]);
    for (const e of g) {
      left = elementLeft(e) < left ? elementLeft(e) : left;
      top = elementTop(e) < top ? elementTop(e) : top;
      right = elementRight(e) > right ? elementRight(e) : right;
      bottom = elementBottom(e) > bottom ? elementBottom(e) : bottom;
    }
    cells.push({
      text: g.map((e) => e.text).join(' '),
      box: [left, top, right, bottom],
      conf: confs.length === g.length ? pyMean(confs) : null,
      n_words: g.length,
    });
  }
  return cells;
}

/** Elements -> deskewed -> rows -> cells for one page dict (L171). */
export function pageRows(page: unknown, skew: number | null = null): Row[] {
  const els = deskew(elementsFromPage(page), skew);
  return groupRows(els).map((r) => ({ cells: buildCells(r) }));
}
