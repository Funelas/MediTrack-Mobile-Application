// Checks of the data files copied into src/engine/data (ML-27/ML-28, S2) and of the vector comparison helper.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

import { dictionary, engineConstants, identityFilterConfig } from '../data';
import {
  compare,
  compareWithHeader,
  describeVectors,
  Json,
  loadVectorFile,
  readJsonNormalized,
  toleranceOf,
  VECTORS_DIR,
  VectorFile,
} from './helpers/vectors';

const MOBILE_DIR = path.resolve(__dirname, '..', '..', '..');
const SCRIPT = path.join(MOBILE_DIR, 'scripts', 'copy-engine-data.js');
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DOCS_CONSTANTS = path.join(VECTORS_DIR, 'engine_constants.json');
const DATA_FILES = [
  'canonical_dictionary.json',
  'unit_conversions.json',
  'identity_filter_config.json',
  'engine_constants.json',
  'clinical_rules.json',
];
const docsPresent = fs.existsSync(DOCS_CONSTANTS) && fs.existsSync(path.join(MOBILE_DIR, '..', 'docs', 'schemas'));
const itWithDocs = docsPresent ? it : it.skip;

function asJson(value: unknown): Json {
  return value as Json;
}

function runScript(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: MOBILE_DIR, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('engine_constants.json', () => {
  itWithDocs('equals the file under docs/engine_vectors', () => {
    expect(compare(readJsonNormalized(DOCS_CONSTANTS), asJson(engineConstants))).toEqual([]);
  });

  it('has the review threshold and the review reason codes', () => {
    expect(engineConstants.parser.review_threshold).toBe(0.7);
    expect(engineConstants.parser.review_reason_codes).toEqual(['low_confidence', 'missing_value', 'missing_range']);
  });

  it('lists the eight analytes scored without a printed range', () => {
    const expected = [
      'cholesterol_total',
      'creatinine',
      'egfr',
      'glucose_fasting',
      'hba1c',
      'hdl',
      'ldl',
      'triglycerides',
    ];
    expect(engineConstants.parser.scored_without_printed_range).toEqual(expected);
    expect([...expected].sort()).toEqual(expected);
  });

  it.each(['whitespace', 'decimal_zeros', 'digit_extra'] as const)(
    'python_unicode.%s is strictly ascending (sorted, no duplicates)',
    (key) => {
      const list = engineConstants.python_unicode[key];
      expect(list.length).toBeGreaterThan(0);
      for (let i = 1; i < list.length; i += 1) {
        expect(list[i]).toBeGreaterThan(list[i - 1]);
      }
    },
  );

  it('python_unicode.whitespace contains the space and the no-break space', () => {
    expect(engineConstants.python_unicode.whitespace).toContain(0x20);
    expect(engineConstants.python_unicode.whitespace).toContain(0xa0);
  });

  it('python_unicode.word_ranges is well formed (sorted, maximal, 771 pairs, 142940 code points)', () => {
    const ranges = engineConstants.python_unicode.word_ranges;
    expect(ranges.length).toBe(771);
    expect(ranges[0]).toEqual([48, 57]);
    let total = 0;
    let previousLast = -2;
    for (const pair of ranges) {
      expect(pair.length).toBe(2);
      const [first, last] = pair;
      expect(Number.isInteger(first)).toBe(true);
      expect(Number.isInteger(last)).toBe(true);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(last).toBeLessThanOrEqual(0x10ffff);
      expect(first).toBeLessThanOrEqual(last);
      expect(first).toBeGreaterThan(previousLast + 1);
      previousLast = last;
      total += last - first + 1;
    }
    expect(total).toBe(142940);
  });

  it('labels equal the label lists of identity_filter_config.json', () => {
    expect(compare(asJson(identityFilterConfig.identity_labels), asJson(engineConstants.labels.identity))).toEqual([]);
    expect(compare(asJson(identityFilterConfig.signature_labels), asJson(engineConstants.labels.signature))).toEqual([]);
  });
});

describe('canonical dictionary copy', () => {
  it('has a non-empty version string', () => {
    expect(typeof dictionary.version).toBe('string');
    expect(dictionary.version.length).toBeGreaterThan(0);
  });
});

describe('copy-engine-data.js', () => {
  const temporary: string[] = [];

  function freshCopy(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-data-'));
    temporary.push(dir);
    for (const name of DATA_FILES) {
      fs.copyFileSync(path.join(DATA_DIR, name), path.join(dir, name));
    }
    return dir;
  }

  afterAll(() => {
    for (const dir of temporary) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  itWithDocs('--check finds the committed copies up to date', () => {
    const result = runScript(['--check']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('up to date');
  });

  itWithDocs('copying into an empty folder gives copies that --check accepts', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-data-'));
    temporary.push(dir);
    const copied = runScript(['--dest', dir]);
    expect(copied.status).toBe(0);
    expect(fs.readdirSync(dir).sort()).toEqual([...DATA_FILES].sort());
    for (const name of DATA_FILES) {
      const text = fs.readFileSync(path.join(dir, name), 'utf8');
      expect(text.includes('\r')).toBe(false);
      expect(text.charCodeAt(0)).not.toBe(0xfeff);
    }
    const checked = runScript(['--check', '--dest', dir]);
    expect(checked.status).toBe(0);
    expect(checked.stdout).toContain('up to date');
  });

  itWithDocs('a copy with CRLF line endings is still up to date', () => {
    const dir = freshCopy();
    for (const name of DATA_FILES) {
      const file = path.join(dir, name);
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\r?\n/g, '\r\n'));
    }
    const result = runScript(['--check', '--dest', dir]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('up to date');
  });

  itWithDocs('a changed number makes --check exit 1 and name only that file', () => {
    const dir = freshCopy();
    const file = path.join(dir, 'engine_constants.json');
    const changed = JSON.parse(fs.readFileSync(file, 'utf8')) as typeof engineConstants;
    changed.parser.review_threshold = 0.8;
    fs.writeFileSync(file, JSON.stringify(changed, null, 1) + '\n');
    const result = runScript(['--check', '--dest', dir]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('engine_constants.json');
    for (const name of DATA_FILES.filter((n) => n !== 'engine_constants.json')) {
      expect(result.stdout).not.toContain(name);
    }
    expect(result.stdout).not.toContain('up to date');
  });

  itWithDocs('a missing copy makes --check exit 1', () => {
    const dir = freshCopy();
    fs.rmSync(path.join(dir, 'unit_conversions.json'));
    const result = runScript(['--check', '--dest', dir]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('unit_conversions.json');
  });
});

describe('vector compare helper', () => {
  it('accepts equal values', () => {
    expect(compare({ a: [1, 'x', null, true] }, { a: [1, 'x', null, true] })).toEqual([]);
  });

  it('rejects a changed number and reports its path', () => {
    expect(compare({ cases: [{ expected: { value: 1.5 } }] }, { cases: [{ expected: { value: 1.6 } }] })).toEqual([
      'cases/0/expected/value',
    ]);
  });

  it('does not treat a boolean as a number', () => {
    expect(compare({ v: true }, { v: 1 })).toEqual(['v']);
    expect(compare({ v: 1 }, { v: true })).toEqual(['v']);
    expect(compare({ v: false }, { v: 0 })).toEqual(['v']);
  });

  it('treats 1 and 1.0 as equal, and -0 and 0 as equal', () => {
    expect(compare(JSON.parse('{"v": 1}') as Json, JSON.parse('{"v": 1.0}') as Json)).toEqual([]);
    expect(compare({ v: -0 }, { v: 0 })).toEqual([]);
    expect(compare({ v: 0 }, { v: -0 })).toEqual([]);
  });

  it('compares arrays in order and by length', () => {
    expect(compare([1, 2, 3], [1, 3, 2])).toEqual(['1', '2']);
    expect(compare({ a: [1, 2] }, { a: [1, 2, 3] })).toEqual(['a']);
    expect(compare([], [1])).toEqual(['/']);
  });

  it('compares objects by key set, in either direction', () => {
    expect(compare({ a: 1, b: 2 }, { a: 1 })).toEqual(['b']);
    expect(compare({ a: 1 }, { a: 1, c: 3 })).toEqual(['c']);
    expect(compare({ a: 1, b: 2 }, { b: 2, a: 1 })).toEqual([]);
  });

  it('distinguishes types: null, string, array and object', () => {
    expect(compare({ v: null }, { v: 0 })).toEqual(['v']);
    expect(compare({ v: '1' }, { v: 1 })).toEqual(['v']);
    expect(compare({ v: [] }, { v: {} })).toEqual(['v']);
    expect(compare('a', 'b')).toEqual(['/']);
  });

  it('applies a tolerance only to numbers under a named field, at any depth below it', () => {
    const tolerance = { fields: ['score'], abs: 0.01 };
    expect(compare({ score: 1.0 }, { score: 1.005 }, tolerance)).toEqual([]);
    expect(compare({ score: 1.0 }, { score: 1.02 }, tolerance)).toEqual(['score']);
    expect(compare({ score: { parts: [1.0, 2.0] } }, { score: { parts: [1.005, 2.02] } }, tolerance)).toEqual([
      'score/parts/1',
    ]);
    expect(compare({ other: 1.0 }, { other: 1.005 }, tolerance)).toEqual(['other']);
    expect(compare({ score: 'a' }, { score: 'b' }, tolerance)).toEqual(['score']);
  });

  it('ignores the tolerance when abs is null or no field is named', () => {
    expect(compare({ score: 1.0 }, { score: 1.005 }, { fields: ['score'], abs: null })).toEqual(['score']);
    expect(compare({ score: 1.0 }, { score: 1.005 }, { fields: [], abs: 0.5 })).toEqual(['score']);
    expect(compare({ score: 1.0 }, { score: 1.005 }, null)).toEqual(['score']);
  });

  it('takes the tolerance from a vector file header', () => {
    const file = { comparison: { rule: 'r', tolerance: { fields: ['x'], abs: 0.1 } } } as unknown as VectorFile;
    expect(toleranceOf(file)).toEqual({ fields: ['x'], abs: 0.1 });
    expect(compareWithHeader(file, { x: 1 }, { x: 1.05 })).toEqual([]);
    expect(compareWithHeader(file, { y: 1 }, { y: 1.05 })).toEqual(['y']);
  });

  it('reads JSON files with CRLF line endings and a byte-order mark', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-json-'));
    try {
      const file = path.join(dir, 'crlf.json');
      fs.writeFileSync(file, '﻿{\r\n "a": [1,\r\n 2],\r\n "b": "x\\ny"\r\n}\r\n');
      expect(readJsonNormalized(file)).toEqual({ a: [1, 2], b: 'x\ny' });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns null for a vector file that does not exist', () => {
    expect(loadVectorFile('no_such_vector_file_for_this_test')).toBeNull();
  });
});

// The Python generator writes docs/engine_vectors/engine_constants.json with the same header fields as a vector
// file; when later steps add vector files, they use describeVectors the same way. Absent files give a skipped suite.
describeVectors('no_such_vector_file_for_this_test', () => {
  it('is never run', () => {
    throw new Error('this suite must be skipped');
  });
});
