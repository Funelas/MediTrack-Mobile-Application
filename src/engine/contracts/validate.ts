// Schema checks of the sanitized OCR payload and of Contract A (ML-27/ML-28, S10), the TypeScript side of
// validate_payload and validate_a in ml/contracts/contract_checks.py. The schemas are compiled ahead of time into
// validators.generated.js by scripts/build-validators.js, so nothing here compiles a schema at run time.
//
// Errors are normalized as in decision D11: only the count and the Python-form paths (results/0/value_text, or
// <root>) are meant to agree with Python, never the wording. Ajv reports an extra error for an if/then (dropped
// here) and one error per extra property (merged into one per path), where jsonschema reports one error for all
// of them. The two code-level rules of validate_a run only when the schema found no errors, as in Python.
import { dictionary } from '../data';
import { SchemaError, validateA as schemaValidateA, validatePayload as schemaValidatePayload } from './validators.generated';

export interface ValidationError {
  /** Python form: 'results/0/value_text', or '<root>'; a code-level error has the path 'results/<row>'. */
  path: string;
  /** Wording of the check; it never quotes the document. */
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  /** Sorted by path, duplicates kept. */
  errors: ValidationError[];
}

interface ResultRow {
  canonical_code: string | null;
  ref_low: number | null;
  ref_high: number | null;
  ref_source: string | null;
}

/** '/results/0/value' becomes 'results/0/value'; the root ('') becomes '<root>'. */
function pythonPath(instancePath: string): string {
  if (instancePath === '') {
    return '<root>';
  }
  return instancePath
    .slice(1)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .join('/');
}

function byPath(a: ValidationError, b: ValidationError): number {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

function normalize(raw: SchemaError[] | null | undefined): ValidationError[] {
  const errors: ValidationError[] = [];
  const extraAt = new Set<string>();
  for (const error of raw ?? []) {
    if (error.keyword === 'if') {
      continue; // jsonschema reports only the errors of the then branch
    }
    const path = pythonPath(error.instancePath);
    if (error.keyword === 'additionalProperties') {
      if (extraAt.has(path)) {
        continue; // one error for all the extra properties of an object
      }
      extraAt.add(path);
    }
    errors.push({ path, message: error.message ?? '' });
  }
  return errors;
}

/** Same rules as _range_source_error in ml/contracts/contract_checks.py; null when the row is fine. */
function rangeSourceError(row: ResultRow, index: number): string | null {
  const low = row.ref_low;
  const high = row.ref_high;
  const source = row.ref_source;
  if (source === 'printed' && low === null && high === null) {
    return "A: results[" + index + "]: ref_source 'printed' needs ref_low or ref_high";
  }
  if (source === 'default' && (low === null || high === null)) {
    return "A: results[" + index + "]: ref_source 'default' needs both ref_low and ref_high";
  }
  if (source === null && (low !== null || high !== null)) {
    return 'A: results[' + index + ']: ref_low and ref_high must be null when ref_source is null';
  }
  return null;
}

/** Checks a sanitized OCR payload against ocr_payload_contract.json. */
export function validatePayload(doc: unknown): ValidationResult {
  schemaValidatePayload(doc);
  const errors = normalize(schemaValidatePayload.errors).sort(byPath);
  return { valid: errors.length === 0, errors };
}

/** Checks a Contract A record against parsing_contract_template.json, then (only if that passes) its code rules. */
export function validateA(doc: unknown): ValidationResult {
  schemaValidateA(doc);
  const errors = normalize(schemaValidateA.errors);
  if (errors.length === 0) {
    const rows = (doc as { results: ResultRow[] }).results;
    rows.forEach((row, index) => {
      const code = row.canonical_code;
      if (code !== null && !Object.prototype.hasOwnProperty.call(dictionary.analytes, code)) {
        errors.push({ path: 'results/' + index, message: 'A: unknown canonical_code' });
      }
      const rangeError = rangeSourceError(row, index);
      if (rangeError !== null) {
        errors.push({ path: 'results/' + index, message: rangeError });
      }
    });
  }
  errors.sort(byPath);
  return { valid: errors.length === 0, errors };
}
