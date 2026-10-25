// The scoring constants of the on-device engine (ML-28, plan sections 6.2 and 6.4). Every number is read from
// data/clinical_rules.json, which the Python generator writes from ml/scoring (decision U1); none is typed here.
// The file is decoded once, when this module loads, into read-only values.
import { clinicalRulesFile, EncodedNumber, RawStage } from '../data';

/** [threshold, label, penalty]: the first stage with value < threshold applies (strict <). */
export type Stage = readonly [threshold: number, label: string, penalty: number];

/** One staged analyte, shaped like an entry of CLINICAL_RULES in ml/scoring/meditracker_scoring.py. */
export interface ClinicalRule {
  readonly unit: string;
  readonly polarity: number;
  /** Ascending thresholds, for analytes where a high value is worse. Absent when stages_desc is present. */
  readonly stages?: readonly Stage[];
  /** Thresholds for analytes where a low value is worse. Absent when stages is present. */
  readonly stages_desc?: readonly Stage[];
}

/** The `scoring` group of clinical_rules.json (the `sources` notes stay in the file). */
export interface ScoringConstants {
  readonly ewma_alpha: number;
  readonly trend_stable_corridor: number;
  readonly glucose_low_limit: number;
  readonly min_scored_fraction: number;
  readonly alert_thresholds: { readonly concerning: number; readonly borderline: number };
  readonly deviation_bands: { readonly normal: number; readonly mild: number };
}

function isEncodedNumber(value: unknown): value is EncodedNumber {
  return typeof value === 'object' && value !== null && Object.keys(value).join() === '$number';
}

/** A stored number: a plain number, or {"$number": "NaN" | "Infinity" | "-Infinity"} as that number. */
function decodeNumber(value: number | string | EncodedNumber): number {
  if (typeof value === 'number') {
    return value;
  }
  if (isEncodedNumber(value)) {
    if (value.$number === 'NaN') {
      return NaN;
    }
    if (value.$number === 'Infinity') {
      return Infinity;
    }
    if (value.$number === '-Infinity') {
      return -Infinity;
    }
  }
  throw new Error('clinical_rules.json: a stage threshold is not a number');
}

function decodeStage(raw: RawStage): Stage {
  const [threshold, label, penalty] = raw;
  if (raw.length !== 3 || typeof label !== 'string' || typeof penalty !== 'number') {
    throw new Error('clinical_rules.json: a stage is not [threshold, label, penalty]');
  }
  return Object.freeze([decodeNumber(threshold), label, penalty] as const);
}

function decodeStages(raw: RawStage[]): readonly Stage[] {
  return Object.freeze(raw.map(decodeStage));
}

function decodeRules(): ReadonlyMap<string, ClinicalRule> {
  const rules = new Map<string, ClinicalRule>();
  for (const code of Object.keys(clinicalRulesFile.clinical_rules)) {
    const raw = clinicalRulesFile.clinical_rules[code];
    const rule: { unit: string; polarity: number; stages?: readonly Stage[]; stages_desc?: readonly Stage[] } = {
      unit: raw.unit,
      polarity: raw.polarity,
    };
    if (raw.stages !== undefined) {
      rule.stages = decodeStages(raw.stages);
    }
    if (raw.stages_desc !== undefined) {
      rule.stages_desc = decodeStages(raw.stages_desc);
    }
    rules.set(code, Object.freeze(rule));
  }
  return rules;
}

/** Staged analytes by canonical code. */
export const CLINICAL_RULES: ReadonlyMap<string, ClinicalRule> = decodeRules();

/** Decimal places that a deviation is rounded to before banding (ML-11). */
export const BAND_PRECISION: number = clinicalRulesFile.extensions.band_precision;

/** Codes whose cut-offs are project-defined rather than guideline-anchored (creatinine, ML-19). */
export const PROJECT_DEFINED_CODES: readonly string[] = Object.freeze([...clinicalRulesFile.extensions.project_defined_codes]);

/** The code given to a row that maps to no canonical analyte. */
export const UNMAPPED_CODE: string = clinicalRulesFile.extensions.unmapped_code;

/** Qualitative values that count as the expected result "negative". */
export const NEGATIVE_EQUIVALENT: readonly string[] = Object.freeze([...clinicalRulesFile.extensions.negative_equivalent]);

/** Smoothing, trend, composite and banding constants. */
export const SCORING: ScoringConstants = Object.freeze({
  ewma_alpha: clinicalRulesFile.scoring.ewma_alpha,
  trend_stable_corridor: clinicalRulesFile.scoring.trend_stable_corridor,
  glucose_low_limit: clinicalRulesFile.scoring.glucose_low_limit,
  min_scored_fraction: clinicalRulesFile.scoring.min_scored_fraction,
  alert_thresholds: Object.freeze({ ...clinicalRulesFile.scoring.alert_thresholds }),
  deviation_bands: Object.freeze({ ...clinicalRulesFile.scoring.deviation_bands }),
});
