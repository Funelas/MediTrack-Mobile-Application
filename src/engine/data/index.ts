// Typed loaders for the data files copied by scripts/copy-engine-data.js (ML-27/ML-28). Do not edit the JSON
// files here: change the source under docs/ and run `npm run engine:data`.
import constantsJson from './engine_constants.json';
import dictionaryJson from './canonical_dictionary.json';
import unitConversionsJson from './unit_conversions.json';
import identityFilterConfigJson from './identity_filter_config.json';
import clinicalRulesJson from './clinical_rules.json';

export interface EngineConstants {
  version: number;
  generated_by: string;
  status: string;
  parser_version: string;
  parser: {
    review_threshold: number;
    review_reason_codes: string[];
    scored_without_printed_range: string[];
    value_kinds: string[];
  };
  layout: {
    row_tolerance: number;
    cell_join_gap: number;
    max_skew_degrees: number;
  };
  matching: {
    fuzzy_threshold: number;
    ambiguity_margin: number;
    min_fuzzy_len: number;
    single_edit_min_len: number;
    single_edit_score: number;
    unit_fuzzy_cutoff: number;
  };
  classify: {
    value_kinds: string[];
    header_phrases: string[];
    drug_markers: string[];
    narrative_markers: string[];
  };
  extract: {
    superscript_digits: Record<string, string>;
    superscript: Record<string, string>;
    qual_words: string[];
    known_units: string[];
    fuzzy_units: string[];
  };
  scoring: {
    qualitative: Record<string, string>;
  };
  labels: {
    identity: string[];
    signature: string[];
  };
  python_unicode: {
    version: string;
    whitespace: number[];
    decimal_zeros: number[];
    digit_extra: number[];
    word_ranges: number[][]; // inclusive [first, last] pairs of Python's \w (a JSON import infers number[][])
  };
}

export interface DefaultRefReason {
  code: string;
  text: string;
  sources_checked: string[];
  reviewed: string;
}

export interface DictionaryAnalyte {
  standard_unit: string | null;
  unit_aliases: string[];
  type: string; // 'staged' or 'not_staged'
  panel: string;
  aliases: string[];
  result_kind: string; // 'numeric', 'qualitative' or 'descriptive'
  plausible_range: number[] | null; // [low, high] when present
  default_ref_interval: unknown; // null for all 55 analytes today; no default is shipped
  default_ref_reason: DefaultRefReason | null;
  expected_values?: string[]; // qualitative analytes only
}

export interface Dictionary {
  version: string;
  description: string;
  matching_rules: string[];
  section_aliases: Record<string, Record<string, string>>;
  analytes: Record<string, DictionaryAnalyte>;
}

export interface LinearConversion {
  canonical_code: string;
  from_unit: string;
  to_unit: string;
  operation: string;
  factor?: number;
  divisor?: number;
  molar_mass_g_per_mol: number | null;
  scale: number | null;
  basis: string;
}

export interface AffineConversion {
  canonical_code: string;
  from_unit: string;
  to_unit: string;
  operation: string;
  a: number;
  b: number;
  basis: string;
}

export interface UnitConversions {
  version: string;
  description: string;
  linear: LinearConversion[];
  affine: AffineConversion[];
  fraction_to_percent: {
    canonical_codes: string[];
    applies_when: string;
    factor: number;
  };
}

export interface IdentityFilterConfig {
  version: number;
  note: string;
  identity_labels: string[];
  signature_labels: string[];
  footer_prefixes: string[];
  header_phrases: string[];
  drug_test_markers: string[];
  narrative_markers: string[];
  layout: {
    row_tolerance_of_median_height: number;
    cell_join_gap_of_row_height: number;
    max_skew_degrees: number;
  };
  name_matching: {
    fuzzy_threshold_token_sort_ratio: number;
    ambiguity_margin: number;
    min_fuzzy_length: number;
    single_edit_min_length: number;
  };
  qualitative_words: string[];
}

// A number as stored in clinical_rules.json: JSON cannot hold an infinity, so the open upper bound of the last stage
// is {"$number": "Infinity"} (the same convention as the vector files). scoring/rules.ts decodes it.
export interface EncodedNumber {
  $number: string;
}

// [threshold, label, penalty]: the first stage with value < threshold applies (strict <).
export type RawStage = Array<number | string | EncodedNumber>;

export interface RawClinicalRule {
  unit: string;
  polarity: number;
  stages?: RawStage[]; // ascending thresholds, for analytes where high is worse
  stages_desc?: RawStage[]; // for analytes where low is worse
}

export interface ClinicalRulesFile {
  version: number;
  generated_by: string;
  status: string;
  parser_version: string;
  rule: string;
  clinical_rules: Record<string, RawClinicalRule>;
  extensions: {
    band_precision: number;
    project_defined_codes: string[];
    unmapped_code: string;
    negative_equivalent: string[];
  };
  scoring: {
    ewma_alpha: number;
    trend_stable_corridor: number;
    glucose_low_limit: number;
    min_scored_fraction: number;
    alert_thresholds: { concerning: number; borderline: number };
    deviation_bands: { normal: number; mild: number };
    sources: Record<string, string[]>;
  };
}

export const engineConstants: EngineConstants = constantsJson;
export const dictionary: Dictionary = dictionaryJson;
export const unitConversions: UnitConversions = unitConversionsJson;
export const identityFilterConfig: IdentityFilterConfig = identityFilterConfigJson;
export const clinicalRulesFile: ClinicalRulesFile = clinicalRulesJson;
