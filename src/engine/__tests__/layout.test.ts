// Geometry (ML-27/ML-28, S8): every case of docs/engine_vectors/layout.json must be reproduced (decision D4). The
// fields the header names as computed with atan2, cos or sin may differ by the recorded tolerance; every other field
// (row membership, cell grouping, text, counts, order) is compared exactly, and this file checks that separately. Only
// counts and case ids are ever reported, never case text.
import {
  buildCells,
  Cell,
  cellCx,
  cellCy,
  cellHeight,
  cellLeft,
  cellRight,
  deskew,
  Element,
  elementBottom,
  elementCx,
  elementCy,
  elementHeight,
  elementLeft,
  elementRight,
  elementsFromPage,
  elementTop,
  estimateSkew,
  groupRows,
  medianHeight,
  pageRows,
  Row,
  rowCy,
  rowText,
} from '../parsing/layout';
import { engineConstants } from '../data';
import { compare, compareWithHeader, describeVectors, Json, toleranceOf } from './helpers/vectors';

type Handler = (input: Json) => Json;

interface VectorCase {
  id: string;
  fn: string;
  input: Json;
  expected: Json;
}

/** The only keys the header may name: the ones computed with atan2, cos and sin. */
const TRIG_KEYS = ['box', 'angle'];

function isObject(value: Json | undefined): value is { [key: string]: Json } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asObject(value: Json): { [key: string]: Json } {
  if (!isObject(value)) {
    throw new Error('expected an object input');
  }
  return value;
}

function asList(value: Json): Json[] {
  if (!Array.isArray(value)) {
    throw new Error('expected a list input');
  }
  return value;
}

const asElements = (value: Json): Element[] => asList(value) as unknown as Element[];
const asElement = (value: Json): Element => value as unknown as Element;
const asCell = (value: Json): Cell => value as unknown as Cell;
const asRow = (value: Json): Row => value as unknown as Row;

function optionalNumber(value: Json | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'number') {
    throw new Error('expected a number');
  }
  return value;
}

const plainElements = (elements: Element[]): Json => elements.map((e) => ({ ...e }));
const plainCells = (cells: Cell[]): Json => cells.map((c) => ({ ...c }));

const HANDLERS: { [fn: string]: Handler } = {
  'parsing.layout.elements_from_page': (input) => plainElements(elementsFromPage(input)),
  'parsing.layout.median_height': (input) => medianHeight(asElements(input)),
  'parsing.layout.estimate_skew': (input) => ({ angle: estimateSkew(asElements(input)) }),
  'parsing.layout.deskew': (input) => {
    const given = asObject(input);
    return plainElements(deskew(asElements(given.elements), optionalNumber(given.angle)));
  },
  'parsing.layout.group_rows': (input) => groupRows(asElements(input)).map(plainElements),
  'parsing.layout.build_cells': (input) => plainCells(buildCells(asElements(input))),
  'parsing.layout.page_rows': (input) => {
    const given = asObject(input);
    return pageRows(given.page, optionalNumber(given.skew)).map((r) => ({ cells: plainCells(r.cells) }));
  },
  'parsing.layout.Element.left': (input) => elementLeft(asElement(input)),
  'parsing.layout.Element.top': (input) => elementTop(asElement(input)),
  'parsing.layout.Element.right': (input) => elementRight(asElement(input)),
  'parsing.layout.Element.bottom': (input) => elementBottom(asElement(input)),
  'parsing.layout.Element.cx': (input) => elementCx(asElement(input)),
  'parsing.layout.Element.cy': (input) => elementCy(asElement(input)),
  'parsing.layout.Element.height': (input) => elementHeight(asElement(input)),
  'parsing.layout.Cell.left': (input) => cellLeft(asCell(input)),
  'parsing.layout.Cell.right': (input) => cellRight(asCell(input)),
  'parsing.layout.Cell.cx': (input) => cellCx(asCell(input)),
  'parsing.layout.Cell.cy': (input) => cellCy(asCell(input)),
  'parsing.layout.Cell.height': (input) => cellHeight(asCell(input)),
  'parsing.layout.Row.cy': (input) => rowCy(asRow(input)),
  'parsing.layout.Row.text': (input) => rowText(asRow(input)),
};

/** True for the expected value of a call that raised in Python: {throws: <exception type name>}. */
function expectsThrow(expected: Json): boolean {
  return isObject(expected) && Object.keys(expected).length === 1 && typeof expected.throws === 'string';
}

/** The value with every key named in `keys` removed, at any depth. */
function withoutKeys(value: Json, keys: ReadonlySet<string>): Json {
  if (Array.isArray(value)) {
    return value.map((item) => withoutKeys(item, keys));
  }
  if (isObject(value)) {
    const out: { [key: string]: Json } = {};
    for (const key of Object.keys(value)) {
      if (!keys.has(key)) {
        out[key] = withoutKeys(value[key], keys);
      }
    }
    return out;
  }
  return value;
}

describeVectors('layout', (file) => {
  const cases = file.cases as unknown as VectorCase[];
  const tolerance = toleranceOf(file);
  const toleranceKeys = new Set<string>(tolerance ? tolerance.fields : []);

  it('has cases, unique ids, and a handler for every fn', () => {
    expect(cases.length).toBeGreaterThan(0);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    const unknown = Array.from(new Set(cases.map((c) => c.fn))).filter((fn) => HANDLERS[fn] === undefined);
    expect(unknown).toEqual([]);
    expect(Object.keys(HANDLERS).filter((fn) => !cases.some((c) => c.fn === fn))).toEqual([]);
  });

  it('names only trigonometric fields in the tolerance, with the measurement recorded', () => {
    expect(tolerance).not.toBeNull();
    const fields = tolerance ? tolerance.fields : [];
    expect(fields.filter((f) => !TRIG_KEYS.includes(f))).toEqual([]);
    if (tolerance && tolerance.abs !== null) {
      expect(tolerance.abs).toBeGreaterThanOrEqual(0);
      expect(typeof tolerance.measured_max).toBe('number');
      expect(tolerance.measured_max as number).toBeLessThanOrEqual(1e-6);
      expect(tolerance.measured_max as number).toBeLessThanOrEqual(tolerance.abs);
      expect(typeof tolerance.measured_on).toBe('string');
    }
  });

  const fns = Array.from(new Set(cases.map((c) => c.fn)));
  it.each(fns)('reproduces every case of %s', (fn) => {
    const mine = cases.filter((c) => c.fn === fn);
    const failed: string[] = [];
    const handler = HANDLERS[fn];
    for (const c of mine) {
      if (handler === undefined) {
        failed.push(c.id + ' (no handler)');
        continue;
      }
      let actual: Json;
      try {
        actual = handler(c.input);
      } catch (error) {
        if (!expectsThrow(c.expected)) {
          failed.push(c.id + ' (threw)');
        }
        continue;
      }
      if (expectsThrow(c.expected)) {
        failed.push(c.id + ' (did not throw)');
      } else if (compareWithHeader(file, c.expected, actual).length > 0) {
        failed.push(c.id);
      } else if (
        compare(withoutKeys(c.expected, toleranceKeys), withoutKeys(actual, toleranceKeys), null).length > 0
      ) {
        failed.push(c.id + ' (discrete field)');
      }
    }
    expect(failed).toEqual([]);
    expect(mine.length).toBeGreaterThan(0);
  });

  it('the tolerance never covers text, counts, confidences or order', () => {
    const rowCases = cases.filter((c) => c.fn === 'parsing.layout.page_rows' && Array.isArray(c.expected));
    const sample = rowCases.find((c) => asList(c.expected).length > 1);
    expect(sample).toBeDefined();
    const expected = (sample as VectorCase).expected;
    const loose = { fields: TRIG_KEYS, abs: 1 };
    // a change in a tolerance field passes under the wide tolerance, a change in any other field does not
    const moved = JSON.parse(JSON.stringify(expected)) as Json[];
    const firstCell = asList(asObject(moved[0]).cells)[0] as { [key: string]: Json };
    (firstCell.box as number[])[0] += 0.5;
    expect(compare(expected, moved, loose)).toEqual([]);
    for (const key of ['text', 'n_words', 'conf']) {
      const changed = JSON.parse(JSON.stringify(expected)) as Json[];
      const cell = asList(asObject(changed[0]).cells)[0] as { [name: string]: Json };
      cell[key] = key === 'text' ? 'changed' : 99;
      expect(compare(expected, changed, loose)).not.toEqual([]);
    }
    const swapped = JSON.parse(JSON.stringify(expected)) as Json[];
    const [first, second] = [swapped[0], swapped[1]];
    swapped[0] = second;
    swapped[1] = first;
    expect(compare(expected, swapped, loose)).not.toEqual([]);
    expect(compare(expected, (expected as Json[]).slice(1), loose)).not.toEqual([]);
  });

  it('the estimate is capped at the limit on both sides', () => {
    const limit = engineConstants.layout.max_skew_degrees * (Math.PI / 180);
    const angles = cases
      .filter((c) => c.fn === 'parsing.layout.estimate_skew')
      .map((c) => (asObject(c.expected) as { angle: number }).angle);
    expect(angles).toContain(limit);
    expect(angles).toContain(-limit);
    expect(angles.every((a) => Math.abs(a) <= limit)).toBe(true);
  });
});
