// Name matching and unit conversion (ML-27/ML-28, S5): every case of docs/engine_vectors/units.json must be reproduced
// exactly (decision D4), plus direct checks of the named rows V1-V9. Only counts and case ids are ever reported, never
// case text. The direct checks type their values from the plan and cross-check them against the row_U* vector cases.
import {
  ALIAS_INDEX,
  buildAliasIndex,
  convertToStandard,
  isUnitlessFraction,
  matchAlias,
  normalizeName,
  normalizeUnit,
  SECTION_INDEX,
  toStandardUnit,
} from '../contracts/units';
import { compareWithHeader, describeVectors, Json } from './helpers/vectors';

type Handler = (input: { [key: string]: Json }) => Json;

function str(value: Json | undefined): string {
  if (typeof value !== 'string') {
    throw new Error('expected a string input');
  }
  return value;
}

function strOrNull(value: Json | undefined): string | null {
  return value === null || value === undefined ? null : str(value);
}

function mapToObject(table: ReadonlyMap<string, string>): { [key: string]: Json } {
  const out: { [key: string]: Json } = {};
  table.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function sectionTables(): Json {
  const out: { [key: string]: Json } = {};
  SECTION_INDEX.forEach((table, section) => {
    out[section] = mapToObject(table);
  });
  return out;
}

function buildOver(analytes: Json): Json {
  try {
    return { index: mapToObject(buildAliasIndex(analytes as unknown as { [code: string]: { aliases: string[] } })) };
  } catch (error) {
    return { error: 'ValueError', message: error instanceof Error ? error.message : '' };
  }
}

function convert(input: { [key: string]: Json }): Json {
  const value = input.value;
  if (value !== null && typeof value !== 'number' && typeof value !== 'boolean') {
    throw new Error('expected a number, a boolean or null');
  }
  const result = convertToStandard(str(input.code), value as number | boolean | null, strOrNull(input.raw_unit));
  return result === null ? null : { value: result.value, unit: result.unit };
}

const HANDLERS: { [fn: string]: Handler } = {
  'contracts.contract_checks.normalize_name': (input) => normalizeName(str(input.text)),
  'contracts.contract_checks.normalize_unit': (input) => normalizeUnit(str(input.unit)),
  'contracts.contract_checks.match_alias': (input) => matchAlias(str(input.name), strOrNull(input.section)),
  'contracts.contract_checks.to_standard_unit': (input) => toStandardUnit(str(input.code), strOrNull(input.raw_unit)),
  'contracts.contract_checks.convert_to_standard': convert,
  'contracts.contract_checks.is_unitless_fraction': (input) =>
    isUnitlessFraction(str(input.code), strOrNull(input.raw_unit)),
  'contracts.contract_checks._build_alias_index': (input) =>
    input.analytes === undefined ? mapToObject(ALIAS_INDEX) : buildOver(input.analytes),
  'contracts.contract_checks._SECTION_INDEX': () => sectionTables(),
};

interface VectorCase {
  id: string;
  fn: string;
  input: { [key: string]: Json };
  expected: Json;
}

describeVectors('units', (file) => {
  const cases = file.cases as unknown as VectorCase[];

  it('has cases, unique ids, and a handler for every fn', () => {
    expect(cases.length).toBeGreaterThan(0);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    const unknown = Array.from(new Set(cases.map((c) => c.fn))).filter((fn) => HANDLERS[fn] === undefined);
    expect(unknown).toEqual([]);
    expect(Object.keys(HANDLERS).filter((fn) => !cases.some((c) => c.fn === fn))).toEqual([]);
  });

  const fns = Array.from(new Set(cases.map((c) => c.fn)));
  it.each(fns)('reproduces every case of %s', (fn) => {
    const mine = cases.filter((c) => c.fn === fn);
    const failed: string[] = [];
    for (const c of mine) {
      const handler = HANDLERS[c.fn];
      if (handler === undefined) {
        failed.push(c.id + ' (no handler)');
        continue;
      }
      let actual: Json;
      try {
        actual = handler(c.input);
      } catch (error) {
        failed.push(c.id + ' (threw)');
        continue;
      }
      if (compareWithHeader(file, c.expected, actual).length > 0) {
        failed.push(c.id);
      }
    }
    expect(failed).toEqual([]);
    expect(mine.length).toBeGreaterThan(0);
  });

  describe('named rows V1-V9, values typed from the plan and cross-checked with the vector file', () => {
    function expectedOf(id: string): Json {
      const found = cases.find((c) => c.id === id);
      if (found === undefined) {
        throw new Error('the vector file has no case ' + id);
      }
      return found.expected;
    }

    it('V1 glucose_fasting 5.2 mmol/L gives 93.6832 mg/dL', () => {
      const out = convertToStandard('glucose_fasting', 5.2, 'mmol/L');
      expect(out).toEqual({ value: 93.6832, unit: 'mg/dL' });
      expect({ ...out }).toEqual(expectedOf('row_U1_linear_multiply'));
    });

    it('V2 creatinine 97 umol/L gives 1.097285067873303 mg/dL', () => {
      const out = convertToStandard('creatinine', 97, 'umol/L');
      expect(out).toEqual({ value: 1.097285067873303, unit: 'mg/dL' });
      expect({ ...out }).toEqual(expectedOf('row_U2_linear_divide'));
    });

    it('V3 hemoglobin 135 g/L gives 13.5 g/dL', () => {
      const out = convertToStandard('hemoglobin', 135, 'g/L');
      expect(out).toEqual({ value: 13.5, unit: 'g/dL' });
      expect({ ...out }).toEqual(expectedOf('row_U3_linear_divide'));
    });

    it('V4 hba1c 48 mmol/mol gives 6.54304 %', () => {
      const out = convertToStandard('hba1c', 48, 'mmol/mol');
      expect(out).toEqual({ value: 6.54304, unit: '%' });
      expect({ ...out }).toEqual(expectedOf('row_U4_affine'));
    });

    it('V5 hematocrit 0.42 with no unit gives 42.0 %', () => {
      const out = convertToStandard('hematocrit', 0.42, null);
      expect(out).toEqual({ value: 42.0, unit: '%' });
      expect({ ...out }).toEqual(expectedOf('row_U5_fraction_rule'));
    });

    it('V6 hematocrit 1.0 gives 100.0; one ulp above 1.0 gives null (no unit)', () => {
      expect(convertToStandard('hematocrit', 1.0, null)).toEqual({ value: 100.0, unit: '%' });
      expect({ ...convertToStandard('hematocrit', 1.0, null) }).toEqual(expectedOf('row_U6_top_exact'));
      expect(convertToStandard('hematocrit', 1.0000000000000002, null)).toBeNull();
      expect(expectedOf('row_U6_top_one_ulp')).toBeNull();
    });

    it('V7 hematocrit 0.0 gives 0.0; the next double below 0 gives null', () => {
      expect(convertToStandard('hematocrit', 0.0, null)).toEqual({ value: 0.0, unit: '%' });
      expect({ ...convertToStandard('hematocrit', 0.0, null) }).toEqual(expectedOf('row_U7_bottom_exact'));
      expect(convertToStandard('hematocrit', -5e-324, null)).toBeNull();
      expect(expectedOf('row_U7_bottom_one_ulp')).toBeNull();
    });

    it('V8 hematocrit 0.42: "%" gives null, "fraction" and "L/L" give 42.0', () => {
      expect(convertToStandard('hematocrit', 0.42, '%')).toBeNull();
      expect(expectedOf('row_U8_unit_percent')).toBeNull();
      expect(convertToStandard('hematocrit', 0.42, 'fraction')).toEqual({ value: 42.0, unit: '%' });
      expect({ ...convertToStandard('hematocrit', 0.42, 'fraction') }).toEqual(expectedOf('row_U8_unit_fraction'));
      expect(convertToStandard('hematocrit', 0.42, 'L/L')).toEqual({ value: 42.0, unit: '%' });
      expect({ ...convertToStandard('hematocrit', 0.42, 'L/L') }).toEqual(expectedOf('row_U8_unit_l_per_l'));
    });

    it('V9 basophils 0.5 with no unit gives 50.0 % at function level', () => {
      const out = convertToStandard('basophils', 0.5, null);
      expect(out).toEqual({ value: 50.0, unit: '%' });
      expect({ ...out }).toEqual(expectedOf('row_U9_basophils_function_level'));
    });

    it('a boolean value is not a number, a missing value gives null', () => {
      expect(convertToStandard('hematocrit', true, null)).toBeNull();
      expect(convertToStandard('hematocrit', false, 'L/L')).toBeNull();
      expect(convertToStandard('hematocrit', null, 'L/L')).toBeNull();
    });

    it('a code or section name that is an inherited object property is not found', () => {
      expect(toStandardUnit('constructor', 'mg/dL')).toBeNull();
      expect(toStandardUnit('__proto__', null)).toBeNull();
      expect(convertToStandard('constructor', 0.5, null)).toBeNull();
      expect(matchAlias('rbc', 'constructor')).toBe(matchAlias('rbc', null));
    });
  });
});
