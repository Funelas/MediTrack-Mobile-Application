// Extensions port (ML-27/ML-28, step 6): every case of docs/engine_vectors/extensions.json must be reproduced exactly
// (decision D4): the seven functions of ml/scoring/extensions.py, the 13 property cases (grids G1 to G4 and A to E,
// enumerated here from their parameters) and the SHA-256 digests of the five A to E grids. A refused weight must throw an
// Error whose message starts with the vector's text followed by ', got '. Only counts and case ids are ever reported,
// never case text. Expected values are read from the vector file; the rows typed here are the ones the plan names (B14 to
// B18, F1 to F3, DG-A to DG-E).
import * as crypto from 'crypto';
import { dictionary } from '../data';
import { normalizeQualitative } from '../parsing/qualitative';
import {
  bandDeviation,
  buildContractB,
  DictEntryLike,
  evaluateNumeric,
  evaluateQualitative,
  evaluateResult,
  PanelEval,
  ResultRow,
  scorePanel,
} from '../scoring/extensions';
import { calculateCompositeHealthScore, calculateDeviation } from '../scoring/meditrackerScoring';
import { compareWithHeader, decodeNonfinite, describeVectors, encodeNonfinite, Json } from './helpers/vectors';

interface VectorCase {
  id: string;
  fn: string;
  input: { [key: string]: Json };
  expected: Json;
}

/** The text of an expected {throws: text}, or undefined for any other expected value (which may be a string or null). */
function throwsText(c: VectorCase): string | undefined {
  const e = c.expected;
  if (typeof e === 'object' && e !== null && !Array.isArray(e) && typeof e.throws === 'string') {
    return e.throws;
  }
  return undefined;
}

const FN_NORMALIZE = 'normalize_qualitative';
const FN_QUALITATIVE = 'evaluate_qualitative';
const FN_NUMERIC = 'evaluate_numeric';
const FN_BAND = 'band_deviation';
const FN_RESULT = 'evaluate_result';
const FN_PANEL = 'score_panel';
const FN_CONTRACT_B = 'build_contract_b';
const FNS = [FN_NORMALIZE, FN_QUALITATIVE, FN_NUMERIC, FN_BAND, FN_RESULT, FN_PANEL, FN_CONTRACT_B];

const UNMAPPED = 'unknown_unmapped';

/** Freezes value and everything inside it, so that a port that writes to an input throws a TypeError. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as object).forEach((inner) => deepFreeze(inner));
  }
  return value;
}

// ---- the digest record of the A to E grids (ml/tests/vectorgen/v_extensions.py: _bits, _digest_record) ----------------

const bitsView = new DataView(new ArrayBuffer(8));

/** The text null for null, else the 16 lower-case hex digits of the big-endian binary64 pattern (-0 written as +0). */
function bits(value: number | null): string {
  if (value === null) {
    return 'null';
  }
  bitsView.setFloat64(0, value === 0 ? 0 : value, false);
  return bitsView.getUint32(0, false).toString(16).padStart(8, '0') + bitsView.getUint32(4, false).toString(16).padStart(8, '0');
}

interface FourFields {
  severity: string;
  penalty: number;
  direction: string | null;
  deviation_score: number | null;
}

/** bits(x)|bits(ref_low)|bits(ref_high)|severity|penalty|direction|bits(deviation_score) and a line feed. */
function digestRecord(x: number, lo: number | null, hi: number | null, out: FourFields): string {
  return (
    [bits(x), bits(lo), bits(hi), out.severity, String(out.penalty), out.direction === null ? 'null' : out.direction, bits(out.deviation_score)].join('|') +
    '\n'
  );
}

// ---- the grid families of the property cases (note item 8 of the vector file) --------------------------------------------

type Visit = (x: number, lo: number | null, hi: number | null, frozenLo: number | null, frozenHi: number | null) => void;

function gridG(denominator: number, iMax: number, target: string, visit: Visit): void {
  for (let i = 1; i <= iMax; i += 1) {
    for (let j = i + 1; j <= iMax; j += 1) {
      const lo = i / denominator;
      const hi = j / denominator;
      if (target === 'lower_limit') {
        visit(lo, lo, hi, null, null);
      } else if (target === 'upper_limit') {
        visit(hi, lo, hi, null, null);
      } else if (target === 'd_minus_2') {
        if (3 * i - j >= 0) {
          visit((3 * i - j) / (2 * denominator), lo, hi, null, null);
        }
      } else {
        visit((3 * j - i) / (2 * denominator), lo, hi, null, null);
      }
    }
  }
}

function gridA(iMax: number, kMax: number, visit: Visit): void {
  for (let i = 1; i <= iMax; i += 1) {
    for (let j = i + 1; j <= iMax; j += 1) {
      for (let k = 0; k <= kMax; k += 1) {
        const gap = Math.abs(2 * k - i - j);
        if (gap === j - i || gap === 2 * (j - i)) {
          continue;
        }
        const lo = i / 10;
        const hi = j / 10;
        visit(k / 10, lo, hi, lo, hi);
      }
    }
  }
}

function gridB(iMax: number, visit: Visit): void {
  for (let i = 1; i <= iMax; i += 1) {
    for (let j = i + 1; j <= iMax; j += 1) {
      const p = 10 * i;
      const q = 10 * j;
      for (const base of [p, q, 5 * (3 * i - j), 5 * (3 * j - i)]) {
        for (const s of [1, -1]) {
          const m = base + s;
          const gap = Math.abs(2 * m - p - q);
          if (m < 0 || gap === q - p || gap === 2 * (q - p)) {
            continue;
          }
          const lo = p / 1000;
          const hi = q / 1000;
          visit(m / 1000, lo, hi, lo, hi);
        }
      }
    }
  }
}

function gridC(pMax: number, qMax: number, visit: Visit): void {
  for (let p = 0; p <= pMax; p += 50) {
    for (let q = p + 50; q <= qMax; q += 50) {
      for (const base of [2 * p, 2 * q, 3 * p - q, 3 * q - p]) {
        for (const s of [1, -1, 2, -2]) {
          const m = base + 2 * s;
          const gap = Math.abs(m - p - q);
          if (m < 0 || gap === q - p || gap === 2 * (q - p)) {
            continue;
          }
          visit(m / 2, p, q, p, q);
        }
      }
    }
  }
}

function gridD(uMax: number, kMax: number, visit: Visit): void {
  for (let u = 1; u <= uMax; u += 1) {
    for (let k = 0; k <= kMax; k += 1) {
      const gap = Math.abs(2 * k - u);
      if (gap === u || gap === 2 * u) {
        continue;
      }
      const hi = u / 10;
      visit(k / 10, null, hi, 0.0, hi); // the frozen call has ref_low 0.0 and ref_high U
    }
  }
}

function gridE(tMax: number, visit: Visit): void {
  for (let t = 1; t <= tMax; t += 1) {
    for (let k = 0; k < t; k += 1) {
      const gap = Math.abs(2 * k - 3 * t);
      if (gap === t || gap === 2 * t) {
        continue;
      }
      const lo = t / 10;
      visit(k / 10, lo, null, lo, 2.0 * lo); // the frozen call has ref_low L and ref_high 2.0 * L
    }
  }
}

const PARITY_GRIDS = ['A', 'B', 'C', 'D', 'E'];

/** Calls visit at every point of the family of a property case, in the enumeration order of the note. */
function enumerate(c: VectorCase, visit: Visit): void {
  const input = c.input as { grid: string; rule: string; params: { [key: string]: number } };
  const params = input.params;
  const grid = input.grid;
  if (grid === 'A') {
    gridA(params.i_max, params.k_max, visit);
  } else if (grid === 'B') {
    gridB(params.i_max, visit);
  } else if (grid === 'C') {
    gridC(params.p_max, params.q_max, visit);
  } else if (grid === 'D') {
    gridD(params.u_max, params.k_max, visit);
  } else if (grid === 'E') {
    gridE(params.t_max, visit);
  } else {
    let target = '';
    if (input.rule.includes('x = L;')) {
      target = 'lower_limit';
    } else if (input.rule.includes('x = U;')) {
      target = 'upper_limit';
    } else if (input.rule.includes('x = (3i - j)/(2d)')) {
      target = 'd_minus_2';
    } else if (input.rule.includes('x = (3j - i)/(2d)')) {
      target = 'd_plus_2';
    } else {
      throw new Error('unknown target in the rule of ' + c.id);
    }
    gridG(params.denominator, params.i_max, target, visit);
  }
}

interface FamilyResult {
  count: number;
  mismatches: number;
  firstBad: number; // index of the first point that differs, or -1
  digest: string | null; // A to E only
}

const familyCache = new Map<string, FamilyResult>();

function sameFour(a: FourFields, b: FourFields): boolean {
  return a.severity === b.severity && a.penalty === b.penalty && a.direction === b.direction && a.deviation_score === b.deviation_score;
}

/** Evaluates every point of a property case: against `each` (G1 to G4) or the frozen function (A to E), with the digest. */
function analyse(c: VectorCase): FamilyResult {
  const cached = familyCache.get(c.id);
  if (cached !== undefined) {
    return cached;
  }
  const parity = PARITY_GRIDS.includes((c.input as { grid: string }).grid);
  const each = (c.expected as unknown as { each: FourFields }).each;
  const hash = crypto.createHash('sha256');
  const result: FamilyResult = { count: 0, mismatches: 0, firstBad: -1, digest: null };
  enumerate(c, (x, lo, hi, frozenLo, frozenHi) => {
    const got = evaluateNumeric('T', x, null, lo, hi, null);
    const four: FourFields = { severity: got.severity, penalty: got.penalty, direction: got.direction, deviation_score: got.deviation_score };
    let want: FourFields = each;
    if (parity) {
      hash.update(digestRecord(x, lo, hi, four), 'ascii');
      const frozen = calculateDeviation('T', x, frozenLo, frozenHi, UNMAPPED, null);
      want = { severity: frozen.severity, penalty: frozen.penalty, direction: frozen.direction, deviation_score: frozen.deviation_score };
    }
    if (!sameFour(four, want)) {
      result.mismatches += 1;
      if (result.firstBad < 0) {
        result.firstBad = result.count;
      }
    }
    result.count += 1;
  });
  result.digest = parity ? hash.digest('hex') : null;
  familyCache.set(c.id, result);
  return result;
}

describeVectors('extensions', (file) => {
  const cases = file.cases as unknown as VectorCase[];
  const isProperty = (c: VectorCase): boolean => c.id.startsWith('property_');
  const pointCases = cases.filter((c) => !isProperty(c));
  const propertyCases = cases.filter(isProperty);
  const ofFn = (fn: string): VectorCase[] => pointCases.filter((c) => c.fn === fn);

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
      if (c.fn === FN_NORMALIZE) {
        return normalizeQualitative(input.text as string | null);
      }
      if (c.fn === FN_QUALITATIVE) {
        return encodeNonfinite(evaluateQualitative(input.text as string | null, input.expected as string[]) as unknown as Json);
      }
      if (c.fn === FN_NUMERIC) {
        const out = evaluateNumeric(
          input.name as string,
          input.value,
          input.unit as string | null,
          input.ref_low as number | null,
          input.ref_high as number | null,
          input.code as string | null,
        );
        return encodeNonfinite(out as unknown as Json);
      }
      if (c.fn === FN_BAND) {
        const out = bandDeviation(input.value as number, input.ref_low as number, input.ref_high as number);
        return encodeNonfinite(out as unknown as Json);
      }
      if (c.fn === FN_RESULT) {
        let entry: DictEntryLike | null;
        if (Object.prototype.hasOwnProperty.call(input, 'dict_entry_code')) {
          const code = input.dict_entry_code as string | null;
          entry = code === null ? null : dictionary.analytes[code];
        } else {
          entry = input.dict_entry as unknown as DictEntryLike | null;
        }
        return encodeNonfinite(evaluateResult(input.row as unknown as ResultRow, entry) as unknown as Json);
      }
      if (c.fn === FN_PANEL) {
        const out = scorePanel(input.evals as unknown as PanelEval[], input.weights as { [code: string]: unknown } | null);
        return encodeNonfinite(out as unknown as Json);
      }
      if (c.fn === FN_CONTRACT_B) {
        const out = buildContractB(
          input.visit_date as string,
          input.results as unknown as ResultRow[],
          input.history as { [code: string]: unknown[] } | null,
          input.weights as { [code: string]: unknown } | null,
        );
        return encodeNonfinite(out as unknown as Json);
      }
    } catch (error) {
      const text = throwsText(c);
      if (error instanceof Error && text !== undefined && error.message.startsWith(text + ', got ')) {
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

  it('has 377 cases in all, 13 of them property cases, unique ids, and a handler for every function used (none unused)', () => {
    expect(cases.length).toBe(377);
    expect(propertyCases.length).toBe(13); // G1 to G4 have two cases each, A to E one each
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    expect(Array.from(new Set(cases.map((c) => c.fn))).sort()).toEqual([...FNS].sort());
    expect(propertyCases.every((c) => c.fn === FN_NUMERIC)).toBe(true);
  });

  it.each(FNS)('reproduces every case of %s exactly', (fn) => {
    const mine = ofFn(fn);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.filter((c) => !passes(c)).map((c) => c.id)).toEqual([]);
  });

  it('reproduces every case when its input is deeply frozen (no input is changed)', () => {
    expect(pointCases.filter((c) => !passes(c, true)).map((c) => c.id)).toEqual([]);
  });

  it('throws only for the cases that expect it, and for each of them', () => {
    const throwing = pointCases.filter((c) => throwsText(c) !== undefined);
    expect(throwing.length).toBeGreaterThan(0);
    expect(throwing.every((c) => c.fn === FN_PANEL || c.fn === FN_CONTRACT_B)).toBe(true);
    expect(throwing.filter((c) => !passes(c)).map((c) => c.id)).toEqual([]);
    const others = pointCases.filter((c) => throwsText(c) === undefined);
    expect(others.filter((c) => compareWithHeader(file, { unexpected_throw: true }, run(c, false)).length === 0).map((c) => c.id)).toEqual([]);
  });

  describe('the property cases', () => {
    it.each(propertyCases.map((c) => c.id))('%s: the point count equals expected.count', (id) => {
      const c = propertyCases.find((p) => p.id === id) as VectorCase;
      expect(analyse(c).count).toBe((c.expected as { count: number }).count);
    });

    it.each(propertyCases.map((c) => c.id))('%s: every point matches (G: each; A to E: the frozen function)', (id) => {
      const c = propertyCases.find((p) => p.id === id) as VectorCase;
      const r = analyse(c);
      expect({ id, mismatches: r.mismatches, firstBadIndex: r.firstBad }).toEqual({ id, mismatches: 0, firstBadIndex: -1 });
    });

    it('the A to E cases name the frozen call the enumerators mirror (D: ref_low 0.0, ref_high U; E: ref_high 2.0 * L)', () => {
      const equalsOf = (id: string): { [key: string]: Json } => {
        const c = propertyCases.find((p) => p.id === id) as VectorCase;
        return (((c.expected as { [key: string]: Json }).each as { [key: string]: Json }).equals as { [key: string]: Json });
      };
      expect(equalsOf('property_D').ref_low).toBe(0.0);
      expect(equalsOf('property_D').ref_high).toBe('U');
      expect(equalsOf('property_E').ref_low).toBe('L');
      expect(equalsOf('property_E').ref_high).toBe('2.0 * L');
      ['property_A', 'property_B', 'property_C'].forEach((id) => {
        expect(equalsOf(id).ref_low).toBe('L');
        expect(equalsOf(id).ref_high).toBe('U');
      });
    });

    it.each(PARITY_GRIDS)('DG-%s: the digest equals the vector file and the plan, and the count matches', (grid) => {
      const planned: { [grid: string]: [number, string] } = {
        A: [38360, 'd6826e376282c53c5c107a68490ca82bb0148f04d5b50d96441118703ec09c49'],
        B: [13000, '584e8629a7ee280a674a2b53e46c4333b11743997662f030e13c544c57e06875'],
        C: [2280, '70ec92e3205051bad8961bc13a8fca78cf8fdf3eec2bf28ff0139c7d0054b235'],
        D: [7425, '8bb5cd17a19e794abd4a92098deb77b20a759f3fa9171cdd68ae8fa3e0eaa0f6'],
        E: [1250, 'a44f121f38cd6397a941dd4f9c3c8ec4d890cb2e20ba26f18c20de2298f77874'],
      };
      const c = propertyCases.find((p) => p.id === 'property_' + grid) as VectorCase;
      const r = analyse(c);
      expect(r.count).toBe(planned[grid][0]);
      expect(r.digest).toBe(planned[grid][1]);
      expect((c.expected as { sha256: string }).sha256).toBe(planned[grid][1]);
      expect(r.digest).toBe((c.expected as { sha256: string }).sha256);
    });
  });

  describe('the named rows of the vector completion plan', () => {
    it.each(['row_N6_ext', 'row_N7_ext'])('the case %s exists once and passes', (id) => {
      const mine = cases.filter((c) => c.id === id);
      expect(mine.length).toBe(1);
      expect(passes(mine[0])).toBe(true);
    });

    it.each(['row_CP7', 'row_DV', 'row_OS'])('the cases with id prefix %s exist and pass', (prefix) => {
      const mine = cases.filter((c) => c.id.startsWith(prefix));
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.filter((c) => !passes(c)).map((c) => c.id)).toEqual([]);
    });
  });
});

// ---- the plan rows with hand-typed expected values ----------------------------------------------------------------

/** A panel row as the frozen composite takes it, and the same row as evaluateResult takes it. */
function item(name: string, code: string, value: number, unit: string): ResultRow {
  return { test_name: name, canonical_code: code, value, unit };
}

const FBS = (value: number): ResultRow => item('FBS', 'glucose_fasting', value, 'mg/dL');
const LDL = (value: number): ResultRow => item('LDL', 'ldl', value, 'mg/dL');
const HDL = (value: number): ResultRow => item('HDL', 'hdl', value, 'mg/dL');
const A1C = (value: number): ResultRow => item('HbA1c', 'hba1c', value, '%');

function frozenPanel(rows: ResultRow[], weights?: { [code: string]: number }): { composite_score: number; alert_level: string } {
  return calculateCompositeHealthScore(rows, weights ?? null);
}

function extensionPanel(rows: ResultRow[], weights?: { [code: string]: number }): { composite_score: number; alert_level: string } {
  return scorePanel(rows.map((r) => evaluateResult(r, null)), weights ?? null);
}

describe('B14: panels with totals 2, 3, 5 and 6 sit on the alert thresholds (frozen and extension agree)', () => {
  it.each([
    ['2', [FBS(110), LDL(142)], 2.0, 'stable'],
    ['3', [FBS(150)], 3.0, 'borderline'],
    ['5', [FBS(150), LDL(142), A1C(6.0)], 5.0, 'borderline'],
    ['6', [FBS(150), HDL(35)], 6.0, 'concerning'],
  ] as Array<[string, ResultRow[], number, string]>)('total %s', (_name, rows, total, level) => {
    expect(frozenPanel(rows).composite_score).toBe(total);
    expect(frozenPanel(rows).alert_level).toBe(level);
    expect(extensionPanel(rows).composite_score).toBe(total);
    expect(extensionPanel(rows).alert_level).toBe(level);
  });
});

describe('B15 (= CP7): FBS 110, HDL 35, LDL 142 with weights 1.1, 1.2, 1.3', () => {
  const rows = [FBS(110), HDL(35), LDL(142)];
  const weights = { glucose_fasting: 1.1, hdl: 1.2, ldl: 1.3 };

  it('the frozen composite is 6.0 and borderline (plain left-to-right sum 5.999999999999999)', () => {
    const out = frozenPanel(rows, weights);
    expect(out.composite_score).toBe(6.0);
    expect(out.alert_level).toBe('borderline');
  });

  it('the extension composite is 6.0 and concerning (compensated sum)', () => {
    const out = extensionPanel(rows, weights);
    expect(out.composite_score).toBe(6.0);
    expect(out.alert_level).toBe('concerning');
  });
});

describe('B16 to B18: exact-limit banding on the extension side, the frozen function unchanged', () => {
  const frozen = (value: number, low: number, high: number): FourFields => {
    const out = calculateDeviation('T', value, low, high, UNMAPPED, null);
    return { severity: out.severity, penalty: out.penalty, direction: out.direction, deviation_score: out.deviation_score };
  };
  const extension = (value: number, low: number, high: number): FourFields => {
    const out = evaluateNumeric('T', value, null, low, high, null);
    return { severity: out.severity, penalty: out.penalty, direction: out.direction, deviation_score: out.deviation_score };
  };

  it('B16: 3.8 on [3.8, 5.5]', () => {
    expect(frozen(3.8, 3.8, 5.5)).toEqual({ severity: 'mild', penalty: 1, direction: 'low', deviation_score: -1.0 });
    expect(extension(3.8, 3.8, 5.5)).toEqual({ severity: 'normal', penalty: 0, direction: null, deviation_score: -1.0 });
  });

  it.each([
    [2.0000000004999996, 'mild', 'normal'],
    [2.0000000005, 'mild', 'mild'],
  ])('B17: %s on [0, 2]', (value, frozenSeverity, extensionSeverity) => {
    expect(frozen(value, 0, 2).severity).toBe(frozenSeverity);
    expect(extension(value, 0, 2).severity).toBe(extensionSeverity);
  });

  it.each([
    [3.0000000004, 'significant', 'mild'],
    [3.0000000006, 'significant', 'significant'],
  ])('B18: %s on [0, 2]', (value, frozenSeverity, extensionSeverity) => {
    expect(frozen(value, 0, 2).severity).toBe(frozenSeverity);
    expect(extension(value, 0, 2).severity).toBe(extensionSeverity);
  });
});

describe('F1 to F3: the digest record format', () => {
  const record = (x: number, lo: number | null, hi: number | null): string => {
    const out = evaluateNumeric('T', x, null, lo, hi, null);
    return digestRecord(x, lo, hi, out);
  };

  it('F1: the first point of grid A (x 0.0, L 0.1, U 0.2)', () => {
    expect(record(0.0, 1 / 10, 2 / 10)).toBe('0000000000000000|3fb999999999999a|3fc999999999999a|significant|3|low|c008000000000000\n');
  });

  it('F2: x 0.6 on [0.1, 1.1] has deviation field 0000000000000000 (-0.0 written as +0.0) and normal|0|null', () => {
    const text = record(6 / 10, 1 / 10, 11 / 10);
    expect(text.endsWith('|normal|0|null|0000000000000000\n')).toBe(true);
  });

  it('F3: the first point of grid D (x 0.2, ref_low null, ref_high 0.1)', () => {
    expect(record(2 / 10, null, 1 / 10)).toBe('3fc999999999999a|null|3fb999999999999a|significant|3|high|4008000000000000\n');
  });
});

describe('the extension functions do not change their inputs', () => {
  it('leaves a frozen row, panel, weights and history untouched', () => {
    const rows = deepFreeze<ResultRow[]>([
      { test_name: 'Glucose Fasting', canonical_code: 'glucose_fasting', result_type: 'numeric', value: 130.0, unit: 'mg/dL', supported: true },
      { test_name: ' Alt ', canonical_code: 'alt', result_type: 'numeric', value: 55.0, ref_low: 7.0, ref_high: 40.0, supported: true },
    ]);
    const weights = deepFreeze({ glucose_fasting: 2.0, alt: 1.5 });
    const history = deepFreeze({ glucose_fasting: [100.0, 120.0], alt: [50.0] });
    const before = JSON.stringify([rows, weights, history]);
    const out = buildContractB('2026-01-01', rows, history, weights);
    expect(out.parameters.length).toBe(2);
    expect(JSON.stringify([rows, weights, history])).toBe(before);
  });
});
