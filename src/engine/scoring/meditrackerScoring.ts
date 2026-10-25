// The frozen scoring functions of ml/scoring/meditracker_scoring.py, copied branch for branch (ML-28, plan step 5):
// calculate_deviation, compute_trend and calculate_composite_health_score. The Python file is the reference and the
// oracle; docs/engine_vectors/scoring.json pins every branch. Every scoring constant is read from rules.ts (decision
// U1); the only numbers typed here are the ones named T1 to T10 in the plan, each with its Python line next to it.
// Plain TypeScript, no logging, no React Native, fs or path import. The inputs are never changed.
import { pyRound } from '../py/round';
import { pyLower, pyStrip } from '../py/text';
import { CLINICAL_RULES, SCORING } from './rules';

/** Python truthiness: false for null, undefined, false, 0, '', an empty list and an object with no keys; NaN is true. */
export function pyTruthy(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0; // NaN !== 0 is true, as bool(float('nan')) is True in Python; -0 equals 0, so it is false
  }
  if (typeof value === 'string' || Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value as object).length > 0;
  }
  return true;
}

/** The result of calculateDeviation (the dict of calculate_deviation; keys as in the Python and in Contract B). */
export interface DeviationResult {
  test_name: string;
  canonical_code: string;
  value: unknown;
  severity: string;
  penalty: number;
  direction: string | null;
  deviation_score: number | null;
}

/** The result of computeTrend. */
export interface TrendResult {
  pct_change: number | null;
  smoothed_val: number | null;
  direction: string;
  clinical_trajectory: string;
}

/** One panel row given to calculateCompositeHealthScore; absent keys count as None. */
export interface PanelItem {
  test_name: string;
  canonical_code?: string | null;
  value?: unknown;
  ref_low?: number | null;
  ref_high?: number | null;
  unit?: string | null;
  [key: string]: unknown;
}

/** One row of the composite breakdown. */
export interface BreakdownRow {
  test_name: string;
  canonical_code: string;
  value: unknown;
  severity: string;
  penalty: number;
  direction: string | null;
  deviation_score: number | null;
  weight: number;
  weighted_penalty: number;
}

/** The result of calculateCompositeHealthScore. */
export interface CompositeResult {
  composite_score: number;
  alert_level: string;
  parameter_count: number;
  scored_count: number;
  unreadable_count: number;
  indeterminate_count: number;
  breakdown: BreakdownRow[];
}

/** Python's `v is None`; an absent argument and an explicit null are the same thing here. */
function isNone(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * True for a number that Python's guard lets through: a real int or float, not a bool, not NaN, not infinite
 * (L112-L118 and L268-L275 of the Python: None, bool, non-number, NaN and +-inf are refused).
 */
function isUsableNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value) && Number.isFinite(value);
}

/** test_name.lower().strip().replace(" ", "_"): lower, then strip, then only the ASCII space becomes "_" (L109, L324, L373). */
function codeFromName(testName: string): string {
  return pyStrip(pyLower(testName)).split(' ').join('_');
}

function deviationResult(
  testName: string,
  canonical: string,
  value: unknown,
  severity: string,
  penalty: number, // T1: the penalty of each severity is 0, 1 or 3 (L124, L135, L149, L206, L218)
  direction: string | null,
  deviationScore: number | null,
): DeviationResult {
  return {
    test_name: testName,
    canonical_code: canonical,
    value,
    severity,
    penalty,
    direction,
    deviation_score: deviationScore,
  };
}

/** Per-parameter deviation and severity: guideline stages for the staged analytes, normalized deviation otherwise. */
export function calculateDeviation(
  testName: string,
  value: unknown,
  refLow?: number | null,
  refHigh?: number | null,
  canonicalCode?: string | null,
  unit?: string | null,
): DeviationResult {
  const canonical = pyTruthy(canonicalCode) ? (canonicalCode as string) : codeFromName(testName); // L109

  // 1. Input guard (L112-L127)
  if (!isUsableNumber(value)) {
    return deviationResult(testName, canonical, value, 'unreadable', 0, null, null); // T1
  }

  if (value < 0) {
    // T9, T13: L129 `value < 0`
    return deviationResult(testName, canonical, value, 'indeterminate', 0, null, null); // T1
  }

  // 2. Unit check (L141-L152): the unit is stripped, then lowered
  const staged = CLINICAL_RULES.get(canonical);
  if (!isNone(unit) && staged !== undefined) {
    if (pyLower(pyStrip(unit)) !== pyLower(staged.unit)) {
      return deviationResult(testName, canonical, value, 'indeterminate', 0, null, null); // T1
    }
  }

  // 3. Guideline-specific threshold check (L155-L209)
  if (staged !== undefined) {
    const polarity = staged.polarity; // T10: L157 rule.get("polarity", 1); every rule has one
    if (staged.stages !== undefined) {
      for (const [threshold, label, sev] of staged.stages) {
        if (value < threshold) {
          let direction: string | null;
          if (label === 'normal') {
            direction = null;
          } else if (canonical === 'glucose_fasting') {
            direction = value < SCORING.glucose_low_limit ? 'low' : 'high'; // L165
          } else if (polarity === 1) {
            direction = 'high'; // T10
          } else if (polarity === -1) {
            direction = 'low'; // T10
          } else {
            direction = 'high';
          }
          return deviationResult(testName, canonical, value, label, sev, direction, null);
        }
      }
      // like the Python, a value past every stage (not reachable: the last threshold is infinite) falls through to 4
    } else if (staged.stages_desc !== undefined) {
      for (const [threshold, label, sev] of staged.stages_desc) {
        if (value < threshold) {
          let direction: string | null;
          if (label === 'normal') {
            direction = null;
          } else if (polarity === -1) {
            direction = 'low'; // T10
          } else {
            direction = 'high';
          }
          return deviationResult(testName, canonical, value, label, sev, direction, null);
        }
      }
      return deviationResult(testName, canonical, value, 'normal', 0, null, null); // T1 (L201-L209)
    }
  }

  // 4. Universal linear normalized deviation fallback (L211-L246)
  if (isNone(refLow) || isNone(refHigh) || refHigh <= refLow) {
    return deviationResult(testName, canonical, value, 'indeterminate', 0, null, null); // T1
  }

  const rMid = (refLow + refHigh) / 2.0; // T3: L223
  const rHalf = (refHigh - refLow) / 2.0; // T3: L224
  const d = (value - rMid) / rHalf;
  const absD = Math.abs(d);

  let label: string;
  let sev: number;
  let direction: string | null;
  if (absD <= SCORING.deviation_bands.normal) {
    label = 'normal';
    sev = 0; // T1
    direction = null;
  } else if (absD <= SCORING.deviation_bands.mild) {
    label = 'mild';
    sev = 1; // T1
    direction = d > 0 ? 'high' : 'low'; // T13: L233 `d > 0`
  } else {
    label = 'significant';
    sev = 3; // T1
    direction = d > 0 ? 'high' : 'low'; // T13
  }

  return deviationResult(testName, canonical, value, label, sev, direction, pyRound(d, 2)); // T2: L245
}

/** Visit-over-visit percentage change and the smoothed (EWMA) trajectory; bad entries of the history are ignored. */
export function computeTrend(
  testName: string,
  historicalValues: readonly unknown[],
  alpha: number = SCORING.ewma_alpha,
  canonicalCode?: string | null,
): TrendResult {
  // 1. Clean history: drop None, bool, non-numeric, NaN, inf (L267-L276)
  const cleanHistory: number[] = [];
  for (const v of historicalValues) {
    if (isUsableNumber(v)) {
      cleanHistory.push(v);
    }
  }

  if (cleanHistory.length === 0) {
    return { pct_change: null, smoothed_val: null, direction: 'none', clinical_trajectory: 'unknown' };
  }

  if (cleanHistory.length === 1) {
    return {
      pct_change: null,
      smoothed_val: pyRound(cleanHistory[0], 2), // T2: L289
      direction: 'baseline',
      clinical_trajectory: 'baseline',
    };
  }

  const prev = cleanHistory[cleanHistory.length - 2];
  const curr = cleanHistory[cleanHistory.length - 1];

  // Defensive math (L297-L300): no percent when the previous value is 0
  let pctChange: number | null;
  if (prev === 0) {
    // T5, T13
    pctChange = null;
  } else {
    pctChange = pyRound(((curr - prev) / prev) * 100.0, 2); // T5: L300; T2
  }

  // S_prev is the EWMA of the clean values excluding the latest (L303-L305)
  let sPrev = cleanHistory[0];
  for (let i = 1; i < cleanHistory.length - 1; i += 1) {
    sPrev = alpha * cleanHistory[i] + (1.0 - alpha) * sPrev; // T6: L305
  }

  // smoothed_val is the EWMA including the latest value (L308)
  const sCurr = alpha * curr + (1.0 - alpha) * sPrev; // T6

  // Corridor comparing curr to S_prev (L311-L321)
  let direction: string;
  if (sPrev === 0) {
    // T5, T13: L311
    if (curr === 0) {
      direction = 'stable';
    } else {
      direction = curr > 0 ? 'rising' : 'declining'; // L315
    }
  } else {
    const relDiff = Math.abs(curr - sPrev) / Math.abs(sPrev);
    if (relDiff < SCORING.trend_stable_corridor) {
      direction = 'stable';
    } else {
      direction = curr > sPrev ? 'rising' : 'declining';
    }
  }

  // Map the trajectory against clinical polarity (L324-L341), the checks in this order
  const canonical = pyTruthy(canonicalCode) ? (canonicalCode as string) : codeFromName(testName); // L324
  const rule = CLINICAL_RULES.get(canonical);

  let trajectory: string;
  if (rule === undefined && direction !== 'stable') {
    trajectory = 'indeterminate'; // (a) unmapped analyte, not stable
  } else if (canonical === 'glucose_fasting' && (curr < SCORING.glucose_low_limit || sPrev < SCORING.glucose_low_limit)) {
    trajectory = 'indeterminate'; // (b) bilateral ambiguity around hypoglycemia, also when stable
  } else if (direction === 'stable') {
    trajectory = 'stable'; // (c)
  } else {
    // (d) biological polarity; `rule` is defined here because (a) took every unmapped, non-stable code
    const polarity = rule === undefined ? 1 : rule.polarity; // T10: L337 .get("polarity", 1)
    if ((direction === 'rising' && polarity === 1) || (direction === 'declining' && polarity === -1)) {
      trajectory = 'worsening';
    } else {
      trajectory = 'improving';
    }
  }

  return { pct_change: pctChange, smoothed_val: pyRound(sCurr, 2), direction, clinical_trajectory: trajectory }; // T2: L345
}

/** Cumulative penalty across a multi-analyte panel. Throws an Error for a weight that is not a finite number >= 1.0. */
export function calculateCompositeHealthScore(
  panelResults: readonly PanelItem[],
  customWeights?: { readonly [code: string]: unknown } | null,
): CompositeResult {
  const weights: { readonly [code: string]: unknown } = pyTruthy(customWeights)
    ? (customWeights as { readonly [code: string]: unknown })
    : {}; // L358
  for (const k of Object.keys(weights)) {
    const w = weights[k];
    if (typeof w !== 'number' || Number.isNaN(w) || !Number.isFinite(w) || w < 1.0) {
      // T7: L365 the weight floor is 1.0; the message is Python's up to ", got "
      throw new Error("Weight for '" + k + "' must be a finite number >= 1.0, got " + String(w));
    }
  }

  let totalPenalty = 0.0;
  const breakdown: BreakdownRow[] = [];

  for (const item of panelResults) {
    const canonical = pyTruthy(item.canonical_code) ? (item.canonical_code as string) : codeFromName(item.test_name); // L373
    const w: number = Object.prototype.hasOwnProperty.call(weights, canonical) ? (weights[canonical] as number) : 1.0; // T7: L374

    const evalRes = calculateDeviation(
      item.test_name,
      item.value,
      item.ref_low,
      item.ref_high,
      item.canonical_code,
      item.unit,
    );
    const weightedPenalty = w * evalRes.penalty;
    totalPenalty += weightedPenalty;

    breakdown.push({
      test_name: item.test_name,
      canonical_code: evalRes.canonical_code,
      value: item.value === undefined ? null : item.value, // item.get("value")
      severity: evalRes.severity,
      penalty: evalRes.penalty,
      direction: evalRes.direction,
      deviation_score: evalRes.deviation_score,
      weight: w,
      weighted_penalty: weightedPenalty,
    });
  }

  const parameterCount = panelResults.length;
  const scoredCount = breakdown.filter((b) => b.severity === 'normal' || b.severity === 'mild' || b.severity === 'significant').length;
  const unreadableCount = breakdown.filter((b) => b.severity === 'unreadable').length;
  const indeterminateCount = breakdown.filter((b) => b.severity === 'indeterminate').length;

  // insufficient_data = nothing scorable, or fewer than the minimum fraction scorable with no significant finding
  const hasSignificant = breakdown.some((b) => b.penalty === 3); // T8: L406
  const insufficient =
    parameterCount === 0 ||
    scoredCount === 0 ||
    (scoredCount / parameterCount < SCORING.min_scored_fraction && !hasSignificant); // L408-L412

  let alertLevel: string;
  if (insufficient) {
    alertLevel = 'insufficient_data';
  } else if (totalPenalty >= SCORING.alert_thresholds.concerning) {
    alertLevel = 'concerning';
  } else if (totalPenalty >= SCORING.alert_thresholds.borderline) {
    alertLevel = 'borderline';
  } else {
    alertLevel = 'stable';
  }

  return {
    composite_score: pyRound(totalPenalty, 2), // T2: L424
    alert_level: alertLevel,
    parameter_count: parameterCount,
    scored_count: scoredCount,
    unreadable_count: unreadableCount,
    indeterminate_count: indeterminateCount,
    breakdown,
  };
}
