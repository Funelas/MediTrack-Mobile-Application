// Name resolution (ML-27/ML-28, S7): every case of docs/engine_vectors/names.json must be reproduced exactly (decision
// D4: code, method and score), and the pool tables must equal tables.fuzzy_pool and tables.section_pools in order. Only
// counts and case ids are ever reported, never case text. Expected values are read from the vector file, not typed here.
import { SECTION_INDEX } from '../contracts/units';
import { entry, poolFor, poolPairs, POOL, resolve } from '../parsing/dictionary';
import { compareWithHeader, describeVectors, Json } from './helpers/vectors';

interface VectorCase {
  id: string;
  description: string;
  input: { name: string; section: string | null };
  expected: Json;
}

describeVectors('names', (file) => {
  const cases = file.cases as unknown as VectorCase[];
  const tables = (file as unknown as { tables: { [key: string]: Json } }).tables;

  it('has cases, unique ids, and only the inputs resolve takes', () => {
    expect(cases.length).toBeGreaterThan(0);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    const odd = cases.filter(
      (c) =>
        Object.keys(c.input).sort().join(',') !== 'name,section' ||
        typeof c.input.name !== 'string' ||
        (c.input.section !== null && typeof c.input.section !== 'string'),
    );
    expect(odd.map((c) => c.id)).toEqual([]);
  });

  it('reproduces every case: code, method and score exact, or null', () => {
    const failed: string[] = [];
    for (const c of cases) {
      let actual: Json;
      try {
        const match = resolve(c.input.name, c.input.section);
        actual = match === null ? null : { code: match.code, method: match.method, score: match.score };
      } catch (error) {
        failed.push(c.id + ' (threw)');
        continue;
      }
      if (compareWithHeader(file, c.expected, actual).length > 0) {
        failed.push(c.id);
      }
    }
    expect(failed).toEqual([]);
  });

  it('covers both outcomes and every method the file names', () => {
    const methods = new Set<string>();
    let nulls = 0;
    for (const c of cases) {
      if (c.expected === null) {
        nulls += 1;
      } else {
        methods.add((c.expected as { method: string }).method);
      }
    }
    expect(nulls).toBeGreaterThan(0);
    expect(Array.from(methods).sort()).toEqual(['exact', 'fuzzy', 'section']);
  });

  describe('derived tables', () => {
    it('holds exactly the tables this port builds', () => {
      expect(Object.keys(tables).sort()).toEqual(['fuzzy_pool', 'section_pools']);
    });

    it('the global pool equals tables.fuzzy_pool, order included', () => {
      expect(compareWithHeader(file, tables.fuzzy_pool, poolPairs(POOL))).toEqual([]);
      expect(poolFor(null)).toBe(POOL);
    });

    it('each section pool equals tables.section_pools, order included, for every section of the dictionary', () => {
      const expected = tables.section_pools as { [section: string]: Json };
      expect(Object.keys(expected).sort()).toEqual(Array.from(SECTION_INDEX.keys()).sort());
      const failed: string[] = [];
      for (const section of Object.keys(expected)) {
        if (compareWithHeader(file, expected[section], poolPairs(poolFor(section))).length > 0) {
          failed.push(section);
        }
      }
      expect(failed).toEqual([]);
    });
  });

  describe('Python quirks', () => {
    it('a section named after an inherited object property is unknown and uses the global pool', () => {
      for (const section of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
        expect(poolFor(section)).toBe(POOL);
      }
      const named = cases.filter((c, i) => c.expected !== null && i % 25 === 0);
      const failed: string[] = [];
      for (const c of named) {
        const plain = resolve(c.input.name, null);
        const odd = resolve(c.input.name, 'constructor');
        if (JSON.stringify(plain) !== JSON.stringify(odd) && c.input.section === null) {
          failed.push(c.id);
        }
      }
      expect(failed).toEqual([]);
    });

    it('an empty, blank or null section uses the global pool', () => {
      expect(poolFor('')).toBe(POOL);
      expect(poolFor(null)).toBe(POOL);
    });

    it('an empty or blank name gives null', () => {
      expect(resolve('', null)).toBeNull();
      expect(resolve('   ', null)).toBeNull();
      expect(resolve(' \t', 'urinalysis')).toBeNull();
    });

    it('entry gives a dictionary row for a known code and throws for an unknown or inherited name', () => {
      const first = cases.find((c) => c.expected !== null);
      expect(first).toBeDefined();
      const code = ((first as VectorCase).expected as { code: string }).code;
      expect(entry(code).aliases.length).toBeGreaterThan(0);
      expect(() => entry('constructor')).toThrow();
      expect(() => entry('no_such_code')).toThrow();
    });
  });
});
