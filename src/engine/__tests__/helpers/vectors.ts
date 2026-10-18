// Test helper for the shared vector files in docs/engine_vectors/ (ML-27). Test code only: it uses fs and path.
// compare() mirrors compare() in ml/tests/vectorgen/common.py (decision D4).
import * as fs from 'fs';
import * as path from 'path';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export interface Tolerance {
  fields: string[];
  abs: number | null;
  measured_max?: number | null;
  measured_on?: string | null;
}

export interface VectorFile {
  version: number;
  stage: string;
  parser_version: string;
  dictionary_version: string;
  contract_version: string;
  status: string;
  generated_by: string;
  note: string;
  comparison: { rule: string; tolerance: Tolerance };
  cases: Json[];
}

/** MediTracker/docs/engine_vectors, found relative to this file (mobile/src/engine/__tests__/helpers). */
export const VECTORS_DIR = path.resolve(__dirname, '..', '..', '..', '..', '..', 'docs', 'engine_vectors');

function isPlainObject(value: Json | undefined): value is { [key: string]: Json } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasKey(obj: { [key: string]: Json }, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function walk(
  exp: Json,
  act: Json,
  at: string,
  fields: Set<string>,
  limit: number | null,
  tolerant: boolean,
  diffs: string[],
): void {
  if (isPlainObject(exp) && isPlainObject(act)) {
    for (const key of Object.keys(exp)) {
      const sub = at ? at + '/' + key : key;
      if (!hasKey(act, key)) {
        diffs.push(sub);
      } else {
        walk(exp[key], act[key], sub, fields, limit, tolerant || fields.has(key), diffs);
      }
    }
    for (const key of Object.keys(act)) {
      if (!hasKey(exp, key)) {
        diffs.push(at ? at + '/' + key : key);
      }
    }
  } else if (Array.isArray(exp) && Array.isArray(act)) {
    if (exp.length !== act.length) {
      diffs.push(at || '/');
      return;
    }
    exp.forEach((item, i) => {
      walk(item, act[i], at ? at + '/' + i : String(i), fields, limit, tolerant, diffs);
    });
  } else if (typeof exp === 'number' && typeof act === 'number') {
    // === makes 1 equal 1.0 and -0 equal 0; never Object.is, which would tell -0 from 0
    if (exp === act) {
      return;
    }
    if (!(tolerant && limit !== null && Math.abs(exp - act) <= limit)) {
      diffs.push(at || '/');
    }
  } else if (exp !== act) {
    // strings, booleans and nulls compare exactly; a boolean is never equal to a number, nor an array to an object
    diffs.push(at || '/');
  }
}

/**
 * Paths (like 'cases/3/expected/value') where actual differs from expected; empty when they are equal.
 *
 * Strings, booleans, nulls and numbers compare exactly. A boolean is not a number, 1 equals 1.0 and -0 equals 0.
 * Arrays compare in order, objects by key set. A tolerance {fields, abs} lets numbers under a key named in
 * fields (at any depth below it) differ by at most abs; it has no effect when abs is null.
 */
export function compare(expected: Json, actual: Json, tolerance?: Tolerance | null): string[] {
  let fields = new Set<string>();
  let limit: number | null = null;
  if (tolerance && tolerance.fields && tolerance.fields.length > 0 && tolerance.abs !== null && tolerance.abs !== undefined) {
    fields = new Set(tolerance.fields);
    limit = Number(tolerance.abs);
  }
  const diffs: string[] = [];
  walk(expected, actual, '', fields, limit, false, diffs);
  return diffs;
}

/** Parsed JSON of a file whose line endings may be CRLF or LF (decision D14); a byte-order mark is ignored. */
export function readJsonNormalized(file: string): Json {
  const raw = fs.readFileSync(file, 'utf8');
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return JSON.parse(text) as Json;
}

/** The vector file docs/engine_vectors/<name>.json, or null when it does not exist yet. */
export function loadVectorFile(name: string): VectorFile | null {
  const file = path.join(VECTORS_DIR, name + '.json');
  if (!fs.existsSync(file)) {
    return null;
  }
  return readJsonNormalized(file) as unknown as VectorFile;
}

/** The file's own comparison.tolerance (a header field), as compare() expects it. */
export function toleranceOf(file: VectorFile): Tolerance | null {
  return file.comparison && file.comparison.tolerance ? file.comparison.tolerance : null;
}

/** compare() with the tolerance the vector file declares in its header. */
export function compareWithHeader(file: VectorFile, expected: Json, actual: Json): string[] {
  return compare(expected, actual, toleranceOf(file));
}

/**
 * Runs fn inside describe() with the loaded vector file. When the file is absent the suite is reported as
 * skipped with a placeholder test, so a missing file never counts as a pass.
 */
export function describeVectors(name: string, fn: (file: VectorFile) => void): void {
  const file = loadVectorFile(name);
  if (file === null) {
    describe.skip('vectors: ' + name + ' (file absent)', () => {
      it('is skipped because the vector file does not exist', () => {
        // never runs
      });
    });
    return;
  }
  describe('vectors: ' + name, () => fn(file));
}
