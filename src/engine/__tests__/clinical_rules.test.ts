// Checks of clinical_rules.json (the scoring constants exported by the Python generator, decision U1) and of
// scoring/rules.ts, which decodes it (ML-28, plan sections 6.2 and 6.4). The expected numbers are typed here by hand.
import * as fs from 'fs';
import * as path from 'path';

import { clinicalRulesFile } from '../data';
import {
  BAND_PRECISION,
  CLINICAL_RULES,
  NEGATIVE_EQUIVALENT,
  PROJECT_DEFINED_CODES,
  SCORING,
  UNMAPPED_CODE,
} from '../scoring/rules';
import { compare, decodeNonfinite, encodeNonfinite, Json, readJsonNormalized, VECTORS_DIR } from './helpers/vectors';

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DOCS_RULES = path.join(VECTORS_DIR, 'clinical_rules.json');
const itWithDocs = fs.existsSync(DOCS_RULES) ? it : it.skip;

function asJson(value: unknown): Json {
  return value as Json;
}

function isRecord(value: Json | undefined): value is { [key: string]: Json } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The data copy parsed on its own and decoded with the shared helper, not with scoring/rules.ts. */
function decodedFile(): { [key: string]: Json } {
  const decoded = decodeNonfinite(readJsonNormalized(path.join(DATA_DIR, 'clinical_rules.json')));
  if (!isRecord(decoded)) {
    throw new Error('clinical_rules.json is not an object');
  }
  return decoded;
}

/** The stage lists of one decoded rule: a list of [threshold, label, penalty] triples. */
function stagesOf(rule: Json | undefined): Json[][] {
  if (!isRecord(rule)) {
    throw new Error('rule is not an object');
  }
  const list = rule.stages !== undefined ? rule.stages : rule.stages_desc;
  if (!Array.isArray(list)) {
    throw new Error('rule has neither stages nor stages_desc');
  }
  return list as Json[][];
}

function decodedRules(): { [code: string]: Json } {
  const rules = decodedFile().clinical_rules;
  if (!isRecord(rules)) {
    throw new Error('clinical_rules is not an object');
  }
  return rules;
}

describe('clinical_rules.json copy', () => {
  itWithDocs('equals the file under docs/engine_vectors', () => {
    expect(compare(readJsonNormalized(DOCS_RULES), readJsonNormalized(path.join(DATA_DIR, 'clinical_rules.json')))).toEqual(
      [],
    );
  });

  it('has the header fields and the groups the port reads', () => {
    const file = decodedFile();
    expect(Object.keys(file).sort()).toEqual(
      ['clinical_rules', 'extensions', 'generated_by', 'parser_version', 'rule', 'scoring', 'status', 'version'].sort(),
    );
    expect(file.version).toBe(1);
    expect(isRecord(file.scoring)).toBe(true);
  });

  it('lists the eight staged analytes', () => {
    expect(Object.keys(decodedRules()).sort()).toEqual(
      [
        'cholesterol_total',
        'creatinine',
        'egfr',
        'glucose_fasting',
        'hba1c',
        'hdl',
        'ldl',
        'triglycerides',
      ].sort(),
    );
  });
});

describe('scoring/rules.ts', () => {
  it('decodes the table so that it equals the independently decoded file', () => {
    const decoded = decodedRules();
    const table: { [code: string]: Json } = {};
    CLINICAL_RULES.forEach((rule, code) => {
      table[code] = asJson(rule);
    });
    expect(compare(asJson(decoded), asJson(table))).toEqual([]);
    expect([...CLINICAL_RULES.keys()]).toEqual(Object.keys(decoded));
  });

  it('decodes the open upper bounds to Infinity, as numbers', () => {
    const glucose = CLINICAL_RULES.get('glucose_fasting');
    const egfr = CLINICAL_RULES.get('egfr');
    expect(glucose?.stages?.[3][0]).toBe(Infinity);
    expect(egfr?.stages_desc?.[2][0]).toBe(Infinity);
    for (const rule of CLINICAL_RULES.values()) {
      for (const stage of rule.stages ?? rule.stages_desc ?? []) {
        expect(typeof stage[0]).toBe('number');
      }
    }
  });

  it('gives each rule either stages or stages_desc, with polarity 1 for stages and -1 for stages_desc', () => {
    for (const rule of CLINICAL_RULES.values()) {
      expect((rule.stages === undefined) !== (rule.stages_desc === undefined)).toBe(true);
      expect(rule.polarity).toBe(rule.stages !== undefined ? 1 : -1);
    }
  });

  it('is read-only', () => {
    expect(Object.isFrozen(SCORING)).toBe(true);
    expect(Object.isFrozen(SCORING.alert_thresholds)).toBe(true);
    expect(Object.isFrozen(SCORING.deviation_bands)).toBe(true);
    expect(Object.isFrozen(PROJECT_DEFINED_CODES)).toBe(true);
    expect(Object.isFrozen(NEGATIVE_EQUIVALENT)).toBe(true);
    for (const rule of CLINICAL_RULES.values()) {
      expect(Object.isFrozen(rule)).toBe(true);
      expect(Object.isFrozen(rule.stages ?? rule.stages_desc)).toBe(true);
    }
  });

  it('exports the extension constants', () => {
    expect(BAND_PRECISION).toBe(9);
    expect(UNMAPPED_CODE).toBe('unknown_unmapped');
    expect([...PROJECT_DEFINED_CODES]).toEqual(['creatinine']);
    expect([...NEGATIVE_EQUIVALENT]).toEqual(['negative', 'none']);
  });
});

describe('PC1: stage labels and penalties', () => {
  const EXPECTED_STAGE_COUNTS: { [code: string]: number } = {
    glucose_fasting: 4,
    hba1c: 3,
    egfr: 3,
    creatinine: 3,
    triglycerides: 3,
    cholesterol_total: 3,
    ldl: 3,
    hdl: 2,
  };
  const PENALTY_OF_LABEL: { [label: string]: number } = { normal: 0, mild: 1, significant: 3 };

  it('has 24 stage triples, split as expected', () => {
    const rules = decodedRules();
    const counts: { [code: string]: number } = {};
    let total = 0;
    for (const code of Object.keys(rules)) {
      counts[code] = stagesOf(rules[code]).length;
      total += counts[code];
    }
    expect(counts).toEqual(EXPECTED_STAGE_COUNTS);
    expect(total).toBe(24);
  });

  it('gives normal 0, mild 1 and significant 3 in every stage', () => {
    const rules = decodedRules();
    let checked = 0;
    for (const code of Object.keys(rules)) {
      for (const [threshold, label, penalty] of stagesOf(rules[code])) {
        expect(typeof threshold).toBe('number');
        expect(Object.keys(PENALTY_OF_LABEL)).toContain(label);
        expect(penalty).toBe(PENALTY_OF_LABEL[label as string]);
        checked += 1;
      }
    }
    expect(checked).toBe(24);
  });

  it('holds for the decoded table of scoring/rules.ts too', () => {
    let checked = 0;
    for (const rule of CLINICAL_RULES.values()) {
      for (const [, label, penalty] of rule.stages ?? rule.stages_desc ?? []) {
        expect(penalty).toBe(PENALTY_OF_LABEL[label]);
        checked += 1;
      }
    }
    expect(checked).toBe(24);
  });
});

describe('PC2: glucose low limit', () => {
  it('equals the threshold of the first glucose_fasting stage, both 70', () => {
    const first = CLINICAL_RULES.get('glucose_fasting')?.stages?.[0];
    expect(first?.[0]).toBe(70);
    expect(SCORING.glucose_low_limit).toBe(70);
    expect(SCORING.glucose_low_limit).toBe(first?.[0]);
  });
});

describe('scoring group (K1 to K7)', () => {
  it('is present in the data copy', () => {
    expect(clinicalRulesFile.scoring).toBeDefined();
    expect(isRecord(decodedFile().scoring)).toBe(true);
  });

  it('equals the values typed here', () => {
    expect(SCORING).toEqual({
      ewma_alpha: 0.3,
      trend_stable_corridor: 0.03,
      glucose_low_limit: 70.0,
      min_scored_fraction: 0.5,
      alert_thresholds: { concerning: 6.0, borderline: 3.0 },
      deviation_bands: { normal: 1.0, mild: 2.0 },
    });
  });

  it('has exactly these keys in the file (the sources notes included)', () => {
    const scoring = decodedFile().scoring;
    expect(isRecord(scoring) ? Object.keys(scoring).sort() : []).toEqual(
      [
        'alert_thresholds',
        'deviation_bands',
        'ewma_alpha',
        'glucose_low_limit',
        'min_scored_fraction',
        'sources',
        'trend_stable_corridor',
      ].sort(),
    );
  });
});

describe('encodeNonfinite and decodeNonfinite', () => {
  it('write and read NaN and the infinities', () => {
    expect(encodeNonfinite(Infinity)).toEqual({ $number: 'Infinity' });
    expect(encodeNonfinite(-Infinity)).toEqual({ $number: '-Infinity' });
    expect(encodeNonfinite(NaN)).toEqual({ $number: 'NaN' });
    expect(decodeNonfinite({ $number: 'Infinity' })).toBe(Infinity);
    expect(decodeNonfinite({ $number: '-Infinity' })).toBe(-Infinity);
    expect(Number.isNaN(decodeNonfinite({ $number: 'NaN' }))).toBe(true);
  });

  it('leave finite numbers, strings, booleans and nulls alone', () => {
    const value: Json = { a: [1.5, 0, -2, 'x', true, false, null], b: { c: 'inf' } };
    expect(encodeNonfinite(value)).toEqual(value);
    expect(decodeNonfinite(value)).toEqual(value);
  });

  it('recurse through lists and objects, and round-trip', () => {
    const value: Json = [[1, Infinity, 'normal', 0], { x: [-Infinity, { y: 2 }] }];
    const encoded = encodeNonfinite(value);
    expect(encoded).toEqual([[1, { $number: 'Infinity' }, 'normal', 0], { x: [{ $number: '-Infinity' }, { y: 2 }] }]);
    expect(JSON.parse(JSON.stringify(encoded))).toEqual(encoded);
    expect(compare(value, decodeNonfinite(encoded))).toEqual([]);
  });

  it('refuse an unknown encoded number, but not an object with other keys', () => {
    expect(() => decodeNonfinite({ $number: 'big' })).toThrow('unknown encoded number');
    expect(decodeNonfinite({ $number: 'Infinity', other: 1 })).toEqual({ $number: 'Infinity', other: 1 });
  });
});
