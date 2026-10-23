// Review routing and typed range (ML-27/ML-28, S12): port of needs_review, review_reasons, split_for_review,
// _typed_bound_ok and apply_typed_range of ml/parsing/parser.py (L447 to L532), line by line in Python's operation order.
// Every result must equal the Python one (docs/engine_vectors/review.json, exact comparison, error messages included).
// REVIEW_THRESHOLD, REVIEW_REASON_CODES and the staged set come from engine_constants.json (decision D8); the reason
// strings pushed by review_reasons are literals of the Python. A Python bool is not a bound (typeof checks), NaN, an
// infinity and an integer too large for a double (read as Infinity by JSON.parse) are refused with the same message, and
// the row is deep-copied after the checks, as copy.deepcopy does, so the input row never changes. Failures throw an Error
// with the Python ValueError text; nothing is logged and no document text is put into a message. Plain TypeScript, no
// logging, no React Native, fs or path import.
import { dictionary, DictionaryAnalyte, engineConstants } from '../data';
import { convert, within } from './parserHelpers';
import { ResultRow } from './router';

/** L25: rows with a confidence below this go to the correction screen. */
export const REVIEW_THRESHOLD: number = engineConstants.parser.review_threshold;

/** L27: why a row goes to the correction screen, in the order review_reasons returns them (ML-10). */
export const REVIEW_REASON_CODES: readonly string[] = engineConstants.parser.review_reason_codes;

/** L29: staged analytes are scored without a printed range, so a missing range is not asked about (ML-10). */
export const SCORED_WITHOUT_PRINTED_RANGE: ReadonlySet<string> = new Set<string>(
  engineConstants.parser.scored_without_printed_range,
);

/** The two lists split_for_review returns, named: the rows to score as they are and the rows to show for review. */
export interface ReviewSplit {
  ready: ResultRow[];
  toReview: ResultRow[];
}

/** Python None: a missing key reads as None through dict.get. */
function isNone(value: unknown): boolean {
  return value === null || value === undefined;
}

/** Python truth value of a JSON value (None, False, 0, "", [] and {} are false). */
function pyTruthy(value: unknown): boolean {
  if (isNone(value) || value === false || value === 0 || value === '') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value as object).length > 0;
  }
  return true;
}

/**
 * cc.load_dictionary()["analytes"].get(code) if code else None (L466, L506): null for a missing, empty or non-string
 * code and for a code that is not an own key of the dictionary (an inherited name such as "toString" is not an analyte).
 */
function analyteOf(code: unknown): DictionaryAnalyte | null {
  if (typeof code !== 'string' || code === '' || !Object.prototype.hasOwnProperty.call(dictionary.analytes, code)) {
    return null;
  }
  return dictionary.analytes[code];
}

/**
 * needs_review (L447): true when the row's confidence is missing or below the threshold. This is one reason in
 * reviewReasons(), not the whole routing rule.
 */
export function needsReview(result: ResultRow, threshold: number = REVIEW_THRESHOLD): boolean {
  const c = result.confidence; // L450
  return isNone(c) || (c as number) < threshold; // L451
}

/**
 * review_reasons (L454): why a row goes to the correction screen, drawn from REVIEW_REASON_CODES and in that order.
 * Empty when the row may be scored as it is. Changes no value and no score.
 *
 * missing_range is a project-defined routing rule (ML-10): a supported, numeric dictionary analyte that is not scored
 * without a printed range, with no printed bound, and not already answered by the user.
 */
export function reviewReasons(row: ResultRow, threshold: number = REVIEW_THRESHOLD): string[] {
  const reasons: string[] = []; // L460
  if (needsReview(row, threshold)) {
    reasons.push('low_confidence');
  }
  if (pyTruthy(row.supported) && isNone(row.value) && row.result_type === 'numeric') {
    reasons.push('missing_value');
  }
  const code = row.canonical_code; // L465
  const entry = analyteOf(code); // L466
  if (
    pyTruthy(row.supported) &&
    row.value_source !== 'user' &&
    entry !== null &&
    entry.result_kind === 'numeric' &&
    !SCORED_WITHOUT_PRINTED_RANGE.has(code as string) &&
    isNone(row.ref_low) &&
    isNone(row.ref_high)
  ) {
    reasons.push('missing_range');
  }
  return reasons;
}

/**
 * split_for_review (L474): the rows the app may score as they are (ready) and the rows to show on the correction screen
 * (toReview). A row goes to review when reviewReasons() is not empty. Non-destructive: the record is not changed, and the
 * rows in both lists are the record's own row objects.
 */
export function splitForReview(record: { results: ResultRow[] }, threshold: number = REVIEW_THRESHOLD): ReviewSplit {
  const ready: ResultRow[] = [];
  const toReview: ResultRow[] = [];
  for (const r of record.results) {
    (reviewReasons(r, threshold).length > 0 ? toReview : ready).push(r); // L480
  }
  return { ready, toReview };
}

/**
 * _typed_bound_ok (L484): true for None or a finite number. A bool, a string, NaN or an infinity is not a bound. An
 * integer too large for a double reads as Infinity here and is refused, as OverflowError is in Python (same message).
 */
function typedBoundOk(bound: unknown): boolean {
  if (isNone(bound)) {
    return true;
  }
  if (typeof bound !== 'number') {
    return false;
  }
  return Number.isFinite(bound);
}

/** copy.deepcopy of a JSON value: arrays and plain objects are copied, keys keep their order. */
function deepCopy<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => deepCopy(item)) as unknown as T;
  }
  if (typeof value === 'object' && value !== null) {
    const out: { [key: string]: unknown } = {};
    for (const key of Object.keys(value as object)) {
      out[key] = deepCopy((value as { [key: string]: unknown })[key]);
    }
    return out as T;
  }
  return value;
}

/**
 * apply_typed_range (L496): a copy of a Contract A row with the range the user typed from the report (ML-10).
 *
 * The bounds are in the unit as printed and are converted with the parser's own rule (convert), so a converted row gets
 * bounds on the same scale as its value. Both null means "no range is printed". The function never guesses: any doubt
 * throws an Error ("typed range: ...") and the input row is not changed. The checks are project-defined: the value must
 * convert to the stored value, low must be below high, a lone bound must be above 0 (the one-sided scoring needs it), and
 * each bound must lie within the analyte's plausible_range. confidence and supported are unchanged; the caller re-scores
 * the row.
 */
export function applyTypedRange(row: ResultRow, low: number | null, high: number | null): ResultRow {
  const code = row.canonical_code; // L505
  const entry = analyteOf(code); // L506
  if (entry === null || entry.result_kind !== 'numeric' || SCORED_WITHOUT_PRINTED_RANGE.has(code as string)) {
    throw new Error('typed range: this row does not take a typed range'); // L508
  }
  if (!(typedBoundOk(low) && typedBoundOk(high))) {
    throw new Error('typed range: a bound must be a finite number'); // L510
  }
  const out = deepCopy(row); // L511
  out.value_source = 'user';
  if (isNone(low) && isNone(high)) {
    out.ref_low = null;
    out.ref_high = null;
    out.ref_source = null;
    return out; // L515
  }
  let lowBound: number | null = isNone(low) ? null : low;
  let highBound: number | null = isNone(high) ? null : high;
  if (!isNone(row.reported_value)) {
    const reportedUnit = isNone(row.reported_unit) ? null : (row.reported_unit as string);
    const conv = convert(code as string, row.reported_value as number, reportedUnit, lowBound, highBound); // L517
    if (conv === null || conv[0] !== (isNone(row.value) ? null : row.value)) {
      throw new Error("typed range: could not convert the bounds with the value's unit"); // L519
    }
    lowBound = conv[1];
    highBound = conv[2];
  } else if (entry.standard_unit !== null && (isNone(row.unit) ? null : row.unit) !== entry.standard_unit) {
    throw new Error('typed range: unit does not match the printed unit'); // L522
  }
  if (lowBound !== null && highBound !== null && !(lowBound < highBound)) {
    throw new Error('typed range: low must be below high'); // L526
  }
  if ((lowBound === null) !== (highBound === null)) {
    const lone = lowBound !== null ? lowBound : (highBound as number);
    if (lone <= 0) {
      throw new Error('typed range: a single bound must be above 0'); // L528
    }
  }
  if (!(within(entry, lowBound) && within(entry, highBound))) {
    throw new Error('typed range: outside the plausible range'); // L530
  }
  out.ref_low = lowBound;
  out.ref_high = highBound;
  out.ref_source = 'printed';
  return out; // L532
}
