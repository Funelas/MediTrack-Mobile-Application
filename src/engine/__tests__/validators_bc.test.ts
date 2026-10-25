// Schema validators for Contracts B and C and the B/C parity check (ML-27/ML-28, S10): every case of
// docs/engine_vectors/validators_bc.json must give the same {valid, count, paths} as validate_b and validate_c in
// Python, and {valid, count} as check_parity (decision D11: counts and Python-form paths, never messages). Only
// counts and case ids are ever reported, never document text.
import { checkParity, validateB, validateC, ValidationResult } from '../contracts/validate';
import * as generated from '../contracts/validators.generated';
import { compareWithHeader, describeVectors, Json } from './helpers/vectors';

const FN_B = 'contracts.contract_checks.validate_b';
const FN_C = 'contracts.contract_checks.validate_c';
const FN_PARITY = 'contracts.contract_checks.check_parity';

type Handler = (input: Json) => Json;

function summary(result: ValidationResult): Json {
  return {
    valid: result.valid,
    count: result.errors.length,
    paths: result.errors.map((error) => error.path).sort(),
  };
}

const HANDLERS: { [fn: string]: Handler } = {
  [FN_B]: (input) => summary(validateB(input)),
  [FN_C]: (input) => summary(validateC(input)),
  [FN_PARITY]: (input) => {
    const pair = input as unknown as { b: Parameters<typeof checkParity>[0]; c: Parameters<typeof checkParity>[1] };
    const result = checkParity(pair.b, pair.c);
    return { valid: result.valid, count: result.errors.length };
  },
};

interface VectorCase {
  id: string;
  fn: string;
  input: Json;
  expected: { [key: string]: Json };
}

/** Freezes value and everything inside it, so that a port that writes to an input throws a TypeError. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as object).forEach((inner) => deepFreeze(inner));
  }
  return value;
}

describeVectors('validators_bc', (file) => {
  const cases = file.cases as unknown as VectorCase[];
  const countOf = (fn: string): number => cases.filter((c) => c.fn === fn).length;

  it('has 271 cases with unique ids and the expected count per function', () => {
    expect(cases.length).toBe(271);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    expect(countOf(FN_B)).toBe(201);
    expect(countOf(FN_C)).toBe(50);
    expect(countOf(FN_PARITY)).toBe(20);
  });

  it('has a handler for every fn used and uses every handler', () => {
    const used = Array.from(new Set(cases.map((c) => c.fn))).sort();
    expect(used).toEqual(Object.keys(HANDLERS).sort());
  });

  it('has valid and invalid cases for B, C and the parity check', () => {
    for (const fn of Object.keys(HANDLERS)) {
      const mine = cases.filter((c) => c.fn === fn);
      expect(mine.some((c) => c.expected.valid === true)).toBe(true);
      expect(mine.some((c) => c.expected.valid === false)).toBe(true);
    }
  });

  it('has the astral-character cases, which count by code point', () => {
    expect(cases.some((c) => c.id.includes('astral'))).toBe(true);
  });

  it.each(Object.keys(HANDLERS))('reproduces the expected result of every case of %s', (fn) => {
    const mine = cases.filter((c) => c.fn === fn);
    const failed: string[] = [];
    for (const c of mine) {
      let actual: Json;
      try {
        actual = HANDLERS[fn](c.input);
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

  it('does not change a deep-frozen input and gives the same result when run again', () => {
    const failed: string[] = [];
    for (const c of cases) {
      const input = deepFreeze(JSON.parse(JSON.stringify(c.input)) as Json);
      try {
        const first = HANDLERS[c.fn](input);
        const second = HANDLERS[c.fn](input);
        if (compareWithHeader(file, first, second).length > 0 || compareWithHeader(file, c.input, input).length > 0) {
          failed.push(c.id);
        }
      } catch (error) {
        failed.push(c.id + ' (threw)');
      }
    }
    expect(failed).toEqual([]);
  });
});

describe('validators for B and C, direct checks', () => {
  it('ships a compiled validator for Contract B and for Contract C', () => {
    expect(typeof generated.validateB).toBe('function');
    expect(typeof generated.validateC).toBe('function');
  });

  it('reports the root for a document that is not an object', () => {
    for (const check of [validateB, validateC]) {
      expect(check([]).errors.map((e) => e.path)).toEqual(['<root>']);
      expect(check(null).errors.map((e) => e.path)).toEqual(['<root>']);
    }
  });

  it('keeps the wording of every error free of document text', () => {
    const odd = { parameters: [{ canonical_code: 'zz_unique_marker_zz', range_basis: 'dictionary_default' }] };
    const result = validateB(odd);
    expect(JSON.stringify(result.errors).includes('zz_unique_marker_zz')).toBe(false);
    const parity = checkParity({ parameters: [{ canonical_code: 'zz_a' }] }, { parameters: [{ canonical_code: 'zz_b' }] });
    expect(parity.valid).toBe(false);
    expect(JSON.stringify(parity.errors).includes('zz_')).toBe(false);
  });

  it('compares the codes of B and C by order and length', () => {
    const rows = (...codes: string[]): { parameters: Array<{ canonical_code: string }> } => ({
      parameters: codes.map((canonical_code) => ({ canonical_code })),
    });
    expect(checkParity(rows('a', 'b'), rows('a', 'b'))).toEqual({ valid: true, errors: [] });
    expect(checkParity(rows('a', 'b'), rows('b', 'a')).errors.map((e) => e.path)).toEqual(['<root>']);
    expect(checkParity(rows('a'), rows('a', 'b')).valid).toBe(false);
    expect(checkParity(rows(), rows()).valid).toBe(true);
  });
});
