// The scoring extensions of ml/scoring/extensions.py, copied function for function (ML-28, plan step 6): the qualitative
// expected-value rule, one-sided ranges, exact-limit banding on D rounded to BAND_PRECISION decimals (ML-11), the
// evaluate_result wrapper with its range_basis label, the panel composite and the Contract B builder. The Python file is
// the reference and the oracle; docs/engine_vectors/extensions.json pins every branch. Every scoring constant is read from
// rules.ts (decision U1); the only numbers typed here are the ones named T1 to T13 in the plan, each marked next to its
// line. normalize_qualitative is the one in parsing/qualitative.ts (S6). The frozen functions are in
// meditrackerScoring.ts and are not changed. Plain TypeScript, no logging, no React Native, fs or path import. The inputs
// are never changed.
import { dictionary } from '../data';
import { normalizeQualitative } from '../parsing/qualitative';
import { pyRound } from '../py/round';
import { pySum } from '../py/sum';
import { pyLower, pyStrip } from '../py/text';
import {
  calculateDeviation,
  computeTrend,
  DeviationResult,
  pyTruthy,
} from './meditrackerScoring';
import { BAND_PRECISION, CLINICAL_RULES, NEGATIVE_EQUIVALENT, PROJECT_DEFINED_CODES, SCORING, UNMAPPED_CODE } from './rules';

/** The dict that _eval returns: a qualitative or unreadable outcome (no deviation score). */
export interface Evaluation {
  severity: string;
  penalty: number;
  direction: string | null;
  deviation_score: null;
}

/** What evaluateResult returns: one evaluated row with its range_basis. */
export interface EvaluatedResult {
  canonical_code: string;
  test_name: string;
  severity: string;
  penalty: number;
  direction: string | null;
  deviation_score: number | null;
  range_basis: string;
}

/** The part of a dictionary entry that evaluateResult reads. */
export interface DictEntryLike {
  result_kind: string;
  expected_values?: readonly string[];
}

/** One Contract A result row; absent keys count as None. */
export interface ResultRow {
  test_name: string;
  canonical_code?: string | null;
  result_type?: string;
  value?: unknown;
  value_text?: string | null;
  unit?: string | null;
  ref_low?: number | null;
  ref_high?: number | null;
  ref_source?: string | null;
  supported?: unknown;
  [key: string]: unknown;
}

/** One evaluated row given to scorePanel (an eval may be as small as canonical_code, severity and penalty). */
export interface PanelEval {
  canonical_code: string;
  severity: string;
  penalty: number;
}

/** The result of scorePanel. */
export interface PanelScore {
  composite_score: number;
  alert_level: string;
  parameter_count: number;
  scored_count: number;
  unreadable_count: number;
  indeterminate_count: number;
}

/** The trend of one Contract B parameter. */
export interface ParameterTrend {
  pct_change: number | null;
  direction: string;
  clinical_trajectory: string;
}

/** One parameter of Contract B. */
export interface ContractBParameter {
  canonical_code: string;
  test_name: string;
  value: unknown;
  unit: string | null;
  severity: string;
  direction: string | null;
  trend: ParameterTrend | null;
  result_type: string | undefined;
  value_text: string | null;
  range_basis: string;
}

/** The result of buildContractB. */
export interface ContractB {
  visit_date: string;
  overall: PanelScore;
  parameters: ContractBParameter[];
}

/** Python's `v is None`; an absent argument and an explicit null are the same thing here. */
function isNone(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/** _finite: a real number that is not a bool, not NaN and not infinite. */
function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** `code in CLINICAL_RULES`. */
function isStaged(code: unknown): boolean {
  return typeof code === 'string' && CLINICAL_RULES.has(code);
}

/** `code in PROJECT_DEFINED_CODES`. */
function isProjectDefined(code: unknown): boolean {
  return typeof code === 'string' && PROJECT_DEFINED_CODES.indexOf(code) >= 0;
}

/** _eval: the outcome of a row that has no deviation score. */
function evaluation(severity: string, penalty: number, direction: string | null): Evaluation {
  return { severity, penalty, direction, deviation_score: null };
}

/**
 * normal when the result is an expected value, mild when it is a known grade that is not, indeterminate when it is not a
 * known grade. Never significant (no published staging to cite).
 */
export function evaluateQualitative(text: string | null | undefined, expected: Iterable<string>): Evaluation {
  if (isNone(text) || pyStrip(text) === '') {
    return evaluation('unreadable', 0, null); // T1
  }
  const grade = normalizeQualitative(text);
  if (grade === null) {
    return evaluation('indeterminate', 0, null); // T1
  }
  const exp = new Set<string>();
  for (const e of expected) {
    exp.add(pyLower(e));
  }
  const negativeExpected = NEGATIVE_EQUIVALENT.some((n) => exp.has(n)); // exp & _NEGATIVE_EQUIVALENT
  if (exp.has(grade) || (NEGATIVE_EQUIVALENT.indexOf(grade) >= 0 && negativeExpected)) {
    return evaluation('normal', 0, null); // T1
  }
  return evaluation('mild', 1, 'high'); // T1
}

/** D uses the same floating-point operations as calculateDeviation; D is rounded to BAND_PRECISION decimals, then banded. */
export function bandDeviation(value: number, refLow: number, refHigh: number): [string, number, string | null] {
  const rMid = (refLow + refHigh) / 2.0; // T3
  const rHalf = (refHigh - refLow) / 2.0; // T3
  const d = pyRound((value - rMid) / rHalf, BAND_PRECISION);
  const absD = Math.abs(d);
  if (absD <= SCORING.deviation_bands.normal) {
    return ['normal', 0, null]; // T1
  }
  if (absD <= SCORING.deviation_bands.mild) {
    return ['mild', 1, d > 0 ? 'high' : 'low']; // T1, T13
  }
  return ['significant', 3, d > 0 ? 'high' : 'low']; // T1, T13
}

/** calculateDeviation with the band re-derived from the rounded D; all guards and the deviation_score stay as the frozen function's. */
function bandedDeviation(
  name: string,
  value: unknown,
  refLow: number | null | undefined,
  refHigh: number | null | undefined,
  code: string,
  unit: string | null | undefined,
): DeviationResult {
  const out = calculateDeviation(name, value, refLow, refHigh, code, unit);
  if (out.deviation_score === null || !(finite(value) && finite(refLow) && finite(refHigh))) {
    return out;
  }
  const [severity, penalty, direction] = bandDeviation(value, refLow, refHigh);
  return { ...out, severity, penalty, direction };
}

function normalResult(name: string, value: unknown, code: string | null | undefined): DeviationResult {
  return {
    test_name: name,
    canonical_code: pyTruthy(code) ? (code as string) : UNMAPPED_CODE,
    value,
    severity: 'normal',
    penalty: 0, // T1
    direction: null,
    deviation_score: null,
  };
}

/**
 * Numeric result. Staged (CLINICAL_RULES) analytes go straight to calculateDeviation. Two-sided and anchored one-sided
 * ranges are banded on D rounded to BAND_PRECISION decimals (deviation_score is unchanged). One-sided ranges are anchored
 * so the existing formula applies: upper only (<U): range [0, U]; lower only (>L): normal at or above L, else [L, 2L].
 */
export function evaluateNumeric(
  name: string,
  value: unknown,
  unit: string | null | undefined,
  refLow: number | null | undefined,
  refHigh: number | null | undefined,
  code: string | null | undefined,
): DeviationResult {
  if (isStaged(code)) {
    return calculateDeviation(name, value, refLow, refHigh, code, unit);
  }
  const hasLow = finite(refLow);
  const hasHigh = finite(refHigh);
  const label: string = pyTruthy(code) ? (code as string) : UNMAPPED_CODE;
  if (hasHigh && !hasLow && (refHigh as number) > 0) {
    return bandedDeviation(name, value, 0.0, refHigh, label, unit); // T4: the anchor of an upper-only range
  }
  if (hasLow && !hasHigh && (refLow as number) > 0) {
    if (finite(value) && value >= (refLow as number)) {
      return normalResult(name, value, code);
    }
    return bandedDeviation(name, value, refLow, 2.0 * (refLow as number), label, unit); // T4: the anchor of a lower-only range
  }
  return bandedDeviation(name, value, refLow, refHigh, label, unit);
}

/**
 * Evaluates one Contract A result row. range_basis is a provenance label and never changes a severity: expected_value
 * (qualitative), project_defined, guideline, dictionary_default (the row's ref_source is "default" and a dictionary entry
 * exists), otherwise lab_range.
 */
export function evaluateResult(row: ResultRow, dictEntry: DictEntryLike | null | undefined): EvaluatedResult {
  const code = isNone(row.canonical_code) ? null : row.canonical_code;
  const kind = pyTruthy(dictEntry) ? (dictEntry as DictEntryLike).result_kind : 'numeric';
  let out: Evaluation | DeviationResult;
  let basis: string;
  if (kind === 'qualitative') {
    out = evaluateQualitative(row.value_text, (dictEntry as DictEntryLike).expected_values as readonly string[]);
    basis = 'expected_value';
  } else {
    out = evaluateNumeric(row.test_name, row.value, row.unit, row.ref_low, row.ref_high, code);
    if (isProjectDefined(code)) {
      basis = 'project_defined';
    } else if (isStaged(code)) {
      basis = 'guideline';
    } else if (!isNone(dictEntry) && row.ref_source === 'default') {
      basis = 'dictionary_default';
    } else {
      basis = 'lab_range';
    }
  }
  return {
    canonical_code: pyTruthy(code) ? (code as string) : UNMAPPED_CODE,
    test_name: row.test_name,
    severity: out.severity,
    penalty: out.penalty,
    direction: out.direction,
    deviation_score: out.deviation_score === undefined ? null : out.deviation_score,
    range_basis: basis,
  };
}

/**
 * Composite over evaluated rows, with the thresholds and the insufficient-data rule of calculateCompositeHealthScore. The
 * total is Python's sum() (compensated, pySum) over weight * penalty in panel order. Throws an Error for a weight that is
 * not a finite number >= 1.0 (message as Python's up to ', got ').
 */
export function scorePanel(
  evals: readonly PanelEval[],
  weights?: { readonly [code: string]: unknown } | null,
): PanelScore {
  const w: { readonly [code: string]: unknown } = pyTruthy(weights) ? (weights as { readonly [code: string]: unknown }) : {};
  for (const k of Object.keys(w)) {
    const weight = w[k];
    if (typeof weight !== 'number' || !finite(weight) || weight < 1.0) {
      // T7: the weight floor is 1.0
      throw new Error("Weight for '" + k + "' must be a finite number >= 1.0, got " + String(weight));
    }
  }
  const terms: number[] = evals.map((e) => {
    const weight: number = Object.prototype.hasOwnProperty.call(w, e.canonical_code) ? (w[e.canonical_code] as number) : 1.0; // T7
    return weight * e.penalty;
  });
  const total = pySum(terms);
  const n = evals.length;
  const scored = evals.filter((e) => e.severity === 'normal' || e.severity === 'mild' || e.severity === 'significant').length;
  const unreadable = evals.filter((e) => e.severity === 'unreadable').length;
  const indeterminate = evals.filter((e) => e.severity === 'indeterminate').length;
  const hasSignificant = evals.some((e) => e.penalty === 3); // T8
  let level: string;
  if (n === 0 || scored === 0 || (scored / n < SCORING.min_scored_fraction && !hasSignificant)) {
    level = 'insufficient_data';
  } else if (total >= SCORING.alert_thresholds.concerning) {
    level = 'concerning';
  } else if (total >= SCORING.alert_thresholds.borderline) {
    level = 'borderline';
  } else {
    level = 'stable';
  }
  return {
    composite_score: pyRound(total, 2), // T2
    alert_level: level,
    parameter_count: n,
    scored_count: scored,
    unreadable_count: unreadable,
    indeterminate_count: indeterminate,
  };
}

/**
 * Contract B from Contract A rows, with the shipped canonical dictionary. Only rows the router marked supported are
 * scored. history maps canonical_code to earlier numeric values, oldest first, current value excluded.
 */
export function buildContractB(
  visitDate: string,
  results: readonly ResultRow[],
  history?: { readonly [code: string]: readonly unknown[] } | null,
  weights?: { readonly [code: string]: unknown } | null,
): ContractB {
  const hist: { readonly [code: string]: readonly unknown[] } = pyTruthy(history)
    ? (history as { readonly [code: string]: readonly unknown[] })
    : {};
  const analytes = dictionary.analytes;
  const params: ContractBParameter[] = [];
  const evals: EvaluatedResult[] = [];
  for (const r of results) {
    if (!pyTruthy(r.supported)) {
      continue;
    }
    const code = isNone(r.canonical_code) ? null : r.canonical_code;
    const entry: DictEntryLike | null =
      pyTruthy(code) && Object.prototype.hasOwnProperty.call(analytes, code as string) ? analytes[code as string] : null;
    const ev = evaluateResult(r, entry);
    evals.push(ev);
    let trend: ParameterTrend | null;
    if (ev.severity === 'unreadable' || ev.severity === 'indeterminate') {
      trend = null;
    } else if (ev.range_basis === 'expected_value' || code === null || isNone(r.value)) {
      trend = { pct_change: null, direction: 'none', clinical_trajectory: 'unknown' }; // _NO_TREND
    } else {
      const earlier: readonly unknown[] = Object.prototype.hasOwnProperty.call(hist, code) ? hist[code] : [];
      const t = computeTrend(r.test_name, [...earlier, r.value], undefined, code);
      trend = { pct_change: t.pct_change, direction: t.direction, clinical_trajectory: t.clinical_trajectory };
    }
    params.push({
      canonical_code: ev.canonical_code,
      test_name: r.test_name,
      value: isNone(r.value) ? null : r.value,
      unit: isNone(r.unit) ? null : r.unit,
      severity: ev.severity,
      direction: ev.direction,
      trend,
      result_type: r.result_type,
      value_text: isNone(r.value_text) ? null : r.value_text,
      range_basis: ev.range_basis,
    });
  }
  return { visit_date: visitDate, overall: scorePanel(evals, weights), parameters: params };
}
