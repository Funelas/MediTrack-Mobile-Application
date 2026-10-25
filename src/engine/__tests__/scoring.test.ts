// Frozen scoring port (ML-27/ML-28, step 5): every case of docs/engine_vectors/scoring.json must be reproduced exactly
// (decision D4): calculate_deviation, compute_trend and calculate_composite_health_score. A weight the Python refuses
// must throw an Error whose message starts with the vector's text followed by ', got '. Only counts and case ids are
// ever reported, never case text. Expected values are read from the vector file, not typed here.
import * as fs from 'fs';
import * as path from 'path';
import {
  calculateCompositeHealthScore,
  calculateDeviation,
  computeTrend,
  PanelItem,
  pyTruthy,
} from '../scoring/meditrackerScoring';
import { compareWithHeader, decodeNonfinite, describeVectors, encodeNonfinite, Json } from './helpers/vectors';

interface VectorCase {
  id: string;
  fn: string;
  input: { [key: string]: Json };
  expected: { [key: string]: Json };
}

const FN_DEVIATION = 'calculate_deviation';
const FN_TREND = 'compute_trend';
const FN_COMPOSITE = 'calculate_composite_health_score';
const FNS = [FN_DEVIATION, FN_TREND, FN_COMPOSITE];

/** Freezes value and everything inside it, so that a port that writes to an input throws a TypeError. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as object).forEach((inner) => deepFreeze(inner));
  }
  return value;
}

describeVectors('scoring', (file) => {
  const cases = file.cases as unknown as VectorCase[];
  const ofFn = (fn: string): VectorCase[] => cases.filter((c) => c.fn === fn);

  /**
   * The actual output of one case in the form of its expected value. A refused weight becomes {throws: text} when the
   * message starts with the expected text and ', got '; any other exception becomes {unexpected_throw: true}.
   */
  function run(c: VectorCase, freezeInput: boolean): Json {
    const input = decodeNonfinite(c.input) as { [key: string]: Json };
    if (freezeInput) {
      deepFreeze(input);
    }
    try {
      if (c.fn === FN_DEVIATION) {
        const out = calculateDeviation(
          input.test_name as string,
          input.value,
          input.ref_low as number | null,
          input.ref_high as number | null,
          input.canonical_code as string | null,
          input.unit as string | null,
        );
        return encodeNonfinite(out as unknown as Json);
      }
      if (c.fn === FN_TREND) {
        const alpha = input.alpha === undefined ? undefined : (input.alpha as number);
        const out = computeTrend(
          input.test_name as string,
          input.historical_values as unknown[],
          alpha,
          input.canonical_code as string | null,
        );
        return encodeNonfinite(out as unknown as Json);
      }
      if (c.fn === FN_COMPOSITE) {
        const out = calculateCompositeHealthScore(
          input.panel_results as unknown as PanelItem[],
          input.custom_weights as { [code: string]: unknown } | null,
        );
        return encodeNonfinite(out as unknown as Json);
      }
    } catch (error) {
      const text = c.expected.throws;
      if (error instanceof Error && typeof text === 'string' && error.message.startsWith(text + ', got ')) {
        return { throws: text };
      }
      return { unexpected_throw: true };
    }
    throw new Error('no handler for ' + c.fn);
  }

  /** True when the port reproduces the case exactly. A case with expected {throws} must throw, so it cannot pass by returning. */
  function passes(c: VectorCase, freezeInput = false): boolean {
    return compareWithHeader(file, c.expected, run(c, freezeInput)).length === 0;
  }

  it('has cases and unique ids, and a handler for every function used (none unused)', () => {
    expect(cases.length).toBeGreaterThan(0);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    expect(Array.from(new Set(cases.map((c) => c.fn))).sort()).toEqual([...FNS].sort());
  });

  it.each(FNS)('reproduces every case of %s exactly', (fn) => {
    const mine = ofFn(fn);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.filter((c) => !passes(c)).map((c) => c.id)).toEqual([]);
  });

  it('reproduces every case when its input is deeply frozen (no input is changed)', () => {
    expect(cases.filter((c) => !passes(c, true)).map((c) => c.id)).toEqual([]);
  });

  it('throws only for the cases that expect it, and for each of them', () => {
    const throwing = cases.filter((c) => typeof c.expected.throws === 'string');
    expect(throwing.length).toBeGreaterThan(0);
    expect(throwing.every((c) => c.fn === FN_COMPOSITE)).toBe(true);
    expect(throwing.filter((c) => !passes(c)).map((c) => c.id)).toEqual([]);
    const others = cases.filter((c) => typeof c.expected.throws !== 'string');
    expect(others.filter((c) => compareWithHeader(file, { unexpected_throw: true }, run(c, false)).length === 0).map((c) => c.id)).toEqual([]);
  });

  describe('the named rows of the vector completion plan', () => {
    it.each([
      'row_N2_trend',
      'row_N4_trend',
      'row_N5_trend',
      'row_N12_trend',
      'row_TR7_a',
      'row_TR7_b',
      'row_SB2_glucose_fasting_below',
      'row_SB2_glucose_fasting_at',
    ])('the case %s exists once and passes', (id) => {
      const mine = cases.filter((c) => c.id === id);
      expect(mine.length).toBe(1);
      expect(passes(mine[0])).toBe(true);
    });

    it('the cases with id prefix row_CP7 exist and pass', () => {
      const mine = cases.filter((c) => c.id.startsWith('row_CP7'));
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.filter((c) => !passes(c)).map((c) => c.id)).toEqual([]);
    });
  });
});

describe('pyTruthy', () => {
  it.each([
    ['', false],
    [{}, false],
    [[], false],
    [0, false],
    [-0, false],
    [null, false],
    [undefined, false],
    [false, false],
    [NaN, true],
    ['a', true],
    [1, true],
    [-1, true],
    [{ a: 1 }, true],
    [[0], true],
    [true, true],
  ])('is as Python bool() for case %#', (value, expected) => {
    expect(pyTruthy(value)).toBe(expected);
  });
});

describe('the functions do not change their inputs', () => {
  it('leaves a frozen panel, weights and history untouched', () => {
    const panel = deepFreeze<PanelItem[]>([
      { test_name: 'Glucose Fasting', canonical_code: 'glucose_fasting', value: 130.0, unit: 'mg/dL' },
      { test_name: ' Alt ', value: 55.0, ref_low: 7.0, ref_high: 40.0 },
      { test_name: 'bad', value: null },
    ]);
    const weights = deepFreeze({ glucose_fasting: 2.0, alt: 1.5 });
    const history = deepFreeze([100.0, null, 'x', 120.0, 130.0]);
    const panelBefore = JSON.stringify(panel);
    const weightsBefore = JSON.stringify(weights);
    const historyBefore = JSON.stringify(history);

    const result = calculateCompositeHealthScore(panel, weights);
    expect(result.parameter_count).toBe(3);
    computeTrend('Glucose Fasting', history);
    calculateDeviation(' Alt ', 55.0, 7.0, 40.0);

    expect(JSON.stringify(panel)).toBe(panelBefore);
    expect(JSON.stringify(weights)).toBe(weightsBefore);
    expect(JSON.stringify(history)).toBe(historyBefore);
  });
});

describe('meditrackerScoring.ts holds no scoring constant of its own', () => {
  // The constants 0.3, 0.03, 70, 0.5 and 6 must come from rules.ts. The penalty 3 is typed only on the two lines that
  // carry the marker comment "// T1" (penalty per severity) or "// T8" (the significant-penalty test). Block comments
  // are removed and the line comment is cut off before a line is checked; the marker is read from the comment part.
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'scoring', 'meditrackerScoring.ts'), 'utf8');
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));
  const lines = withoutBlocks.split(/\r?\n/);
  const FORBIDDEN = /(?<![\w.])(?:0\.03|0\.3|0\.5|70\.0|70|6\.0|6)(?![\w.])/;
  const PENALTY_THREE = /(?<![\w.])(?:3\.0|3)(?![\w.])/;

  function split(line: string): { code: string; comment: string } {
    const at = line.indexOf('//');
    return at < 0 ? { code: line, comment: '' } : { code: line.slice(0, at), comment: line.slice(at) };
  }

  it('has none of 0.3, 0.03, 70, 0.5 or 6 as a number in code', () => {
    const bad = lines.map((line, i) => (FORBIDDEN.test(split(line).code) ? i + 1 : 0)).filter((n) => n > 0);
    expect(bad).toEqual([]);
  });

  it('has the number 3 only on lines marked T1 or T8', () => {
    const bad = lines
      .map((line, i) => {
        const { code, comment } = split(line);
        return PENALTY_THREE.test(code) && !/\bT[18]\b/.test(comment) ? i + 1 : 0;
      })
      .filter((n) => n > 0);
    expect(bad).toEqual([]);
  });

  it('finds the marked 3 at least once (the check can see a line)', () => {
    const marked = lines.filter((line) => PENALTY_THREE.test(split(line).code));
    expect(marked.length).toBeGreaterThan(0);
  });
});
