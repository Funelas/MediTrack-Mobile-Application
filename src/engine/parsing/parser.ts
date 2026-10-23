// Parser (ML-27/ML-28, S11b): port of parse_report, _build_result and _unreadable_row of ml/parsing/parser.py, line by
// line in Python's operation order (the helpers they call are in parserHelpers.ts, S11a). Every result must equal the
// Python one (docs/engine_vectors/parse.json, exact comparison of the record and the notes). The confidence multipliers,
// the 0.3 of an unreadable row and the other numbers inside expressions are literals of the Python and carry the
// parser.py line they come from. parser_version comes from engine_constants.json (decision D8), the dictionary version
// from the dictionary file. statistics.mean is pyMean, round is pyRound, max and min use the first-extreme helpers (D15).
// A failure throws an Error that starts with the Python ValueError prefix; nothing is logged and no document text is put
// into an error message. The review functions (parser.py L447 onward) belong to S12. Plain TypeScript, no logging, no
// React Native, fs or path import.
import { dictionary, DictionaryAnalyte, engineConstants } from '../data';
import { toStandardUnit } from '../contracts/units';
import { validateA, validatePayload, ValidationError } from '../contracts/validate';
import { pyMean } from '../py/mean';
import { pyRound } from '../py/round';
import { firstMax, firstMin } from '../py/sort';
import { PY_SPACE_CLASS, pySlice, pyStrip } from '../py/text';
import { classify, isHeaderRow } from './classify';
import { entry as dictionaryEntry, Match, resolve } from './dictionary';
import { canonicalUnit, Typed } from './extract';
import { findIdentityLabels } from './identityLabels';
import { Cell, pageRows, Row, rowText } from './layout';
import {
  blocks,
  convert,
  defaultInterval,
  firstValueGroup,
  Group,
  inferUnit,
  sexedRanges,
  splitStreams,
  TypedCell,
  unitScore,
  within,
} from './parserHelpers';
import { markSupported, RecordWithResults, ResultRow } from './router';

/** The ParseContext dataclass (L34): the visit, the date the user confirmed and the sex from the account profile. */
export interface ParseContext {
  visitId: string;
  visitDate?: string | null; // confirmed by the user; falls back to the payload's candidate; '' counts as not given
  sex?: string | null; // "male" / "female" from the account profile, never from the scan
}

/** The ParseOutput dataclass (L41): the Contract A record and the advisory notes, in order. */
export interface ParseOutput {
  record: RecordWithResults;
  notes: string[];
}

const WHITESPACE_RUN = new RegExp(PY_SPACE_CLASS + '+', 'gu'); // L215, \s+

/** Python truth value of a string or None. */
function truthyText(s: string | null | undefined): s is string {
  return s !== null && s !== undefined && s !== '';
}

/** Python truth value of a JSON value (None, False, 0, "", [] and {} are false). */
function pyTruthy(value: unknown): boolean {
  if (value === null || value === undefined || value === false || value === 0 || value === '') {
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

/** str.strip(" :."): removes the characters space, colon and dot from both ends. */
function stripMarks(s: string): string {
  const chars = Array.from(s);
  const marks = ' :.';
  let start = 0;
  let end = chars.length;
  while (start < end && marks.includes(chars[start])) {
    start += 1;
  }
  while (end > start && marks.includes(chars[end - 1])) {
    end -= 1;
  }
  return chars.slice(start, end).join('');
}

/** "; ".join of the error texts, each with its Python-form path (the wording never quotes the document). */
function joinErrors(errors: ValidationError[]): string {
  return errors.map((e) => e.path + ': ' + e.message).join('; ');
}

/**
 * _build_result (L213): one Contract A row from a name cell and the typed rows of its block, or null when the row is
 * dropped (no name, an identity label in the name, or no result and no printed unit). Notes are appended in order.
 */
function buildResult(
  nameCell: Cell,
  blockRows: TypedCell[][],
  section: string | null,
  sex: string | null,
  notes: string[],
): ResultRow | null {
  const name = stripMarks(nameCell.text.replace(WHITESPACE_RUN, ' ')); // L215
  if (name === '' || findIdentityLabels(name).length > 0) {
    return null; // L217
  }
  const sexed = sexedRanges(blockRows); // L218
  const sexedValues = Object.keys(sexed).map((k) => sexed[k]);
  const flat: TypedCell[] = []; // L219
  for (const row of blockRows) {
    for (const [c, t] of row) {
      if (t.kind !== 'sex' && !(t.kind === 'range' && sexedValues.some((s) => t === s))) {
        flat.push([c, t]);
      }
    }
  }
  const groups = firstValueGroup(flat); // L221
  const withValue = groups.filter((g) => g.value !== null); // L222
  const match: Match | null = resolve(name, section); // L223
  const code: string | null = match !== null ? match.code : null; // L224
  const entry: DictionaryAnalyte | null = code !== null ? dictionaryEntry(code) : null; // L225
  if (withValue.length === 0) {
    return unreadableRow(name, groups, match, entry, notes); // L227
  }

  let best: Group = withValue[0]; // L229
  if (code !== null) {
    // L231 to L233: the highest unit score, the earliest group on a tie
    let bestScore = -1;
    withValue.forEach((g, i) => {
      const gv = g.value as Typed;
      const score = unitScore(code, g.unit, gv.value !== null ? gv.value : gv.high);
      if (i === 0 || score > bestScore) {
        best = g;
        bestScore = score;
      }
    });
  }
  const vt = best.value as Typed; // L234
  let validation = 1.0; // L235
  const fixed = vt.fixed; // L236

  // --- result type, value, text
  let valueText: string | null = null; // L239
  let value: number | null = null; // L240
  let low: number | null = null; // L241
  let high: number | null = null;
  let resultType: string;
  if (vt.kind === 'number') {
    resultType = 'numeric';
    value = vt.value; // L243
  } else if (vt.kind === 'mixed') {
    resultType = 'numeric';
    value = vt.value;
    valueText = pyStrip(vt.text); // L245
  } else if (vt.kind === 'range') {
    resultType = 'range';
    value = vt.high;
    valueText = pyStrip(vt.text);
    low = vt.low;
    high = vt.high; // L247
  } else {
    resultType = 'qualitative';
    valueText = pyStrip(vt.text); // L249
  }
  let unit: string | null = truthyText(best.unit) ? best.unit : vt.unit; // L250

  // --- reference range: the group's own, else the sex-specific one, else the default
  let refLow: number | null = best.rng !== null ? best.rng.low : null; // L253
  let refHigh: number | null = best.rng !== null ? best.rng.high : null; // L254
  if (best.rng === null && sexedValues.length > 0) {
    // L255
    const hasPick = (sex === 'male' || sex === 'female') && Object.prototype.hasOwnProperty.call(sexed, sex);
    const pick: Typed | null = hasPick ? sexed[sex as string] : null; // L256
    if (pick === null) {
      const los = sexedValues.filter((t) => t.low !== null).map((t) => t.low as number); // L258
      const his = sexedValues.filter((t) => t.high !== null).map((t) => t.high as number); // L259
      refLow = los.length > 0 ? (firstMin(los, (x) => x) as number) : null; // L260
      refHigh = his.length > 0 ? (firstMax(his, (x) => x) as number) : null;
      validation *= 0.9; // L261
      notes.push(name + ': sex unknown, used the widest printed range'); // L262
    } else {
      refLow = pick.low; // L264
      refHigh = pick.high;
    }
    for (const t of pick !== null ? [pick] : sexedValues) {
      // L265
      if (truthyText(t.unit) && !truthyText(unit)) {
        unit = t.unit; // L266
      }
    }
  }
  let refSource: string | null = refLow !== null || refHigh !== null ? 'printed' : null; // L268

  if (truthyText(unit)) {
    // L270
    const fixedUnit = canonicalUnit(unit);
    if (fixedUnit !== null) {
      const usable = code !== null && truthyText(toStandardUnit(code, fixedUnit[0])); // L273
      if (fixedUnit[1] || usable) {
        if (fixedUnit[1]) {
          validation *= 0.9; // L276, a garbled unit read as the closest known one
        }
        unit = fixedUnit[0];
      }
    }
  }
  const reportedValue = value; // L278
  const reportedUnit = unit;
  const numeric = (resultType === 'numeric' || resultType === 'range') && value !== null; // L279
  if (match !== null) {
    // L280, L281: exact and section matches count 1.0, a fuzzy match counts its score
    validation *= match.method === 'exact' || match.method === 'section' ? 1.0 : match.score;
  } else {
    validation *= 0.7; // L283, no dictionary match
  }

  if (entry !== null && code !== null && numeric && entry.result_kind === 'numeric') {
    // L285
    const std = entry.standard_unit; // L286
    if (std === null) {
      unit = null; // L288
    } else if (!truthyText(unit)) {
      const conv = convert(code, value, null, refLow, refHigh); // L290
      const inferred = conv !== null ? null : inferUnit(code, entry, value, refLow, refHigh); // L291
      if (conv !== null) {
        [value, refLow, refHigh] = conv; // L293
        unit = std;
        validation *= 0.95; // L294
      } else if (inferred !== null) {
        [value, refLow, refHigh] = inferred; // L296
        unit = std;
        validation *= 0.75; // L297
        notes.push(name + ': no unit was read; inferred it from the value and range, please confirm'); // L298
      } else {
        unit = std;
        validation *= 0.8; // L300, no unit printed: assume the standard unit
      }
    } else if (truthyText(toStandardUnit(code, unit))) {
      unit = std; // L302
    } else {
      const conv = convert(code, value, unit, refLow, refHigh); // L304
      if (conv !== null) {
        [value, refLow, refHigh] = conv; // L306
        unit = std;
        validation *= 0.95; // L307
      } else {
        validation *= 0.5; // L309, unit mismatch: keep the raw unit
      }
    }
    if (refSource === null && (unit === std || std === null)) {
      // L310
      const iv = defaultInterval(entry, sex); // L311
      if (iv !== null) {
        refLow = iv[0]; // L313
        refHigh = iv[1];
        refSource = 'default';
      }
    }
    if (!within(entry, value)) {
      validation *= 0.4; // L315
    }
  } else if (entry !== null && numeric && entry.result_kind !== 'numeric') {
    validation *= 0.6; // L317, a number where a text result is expected
  }
  if (fixed || (best.rng !== null && best.rng.fixed)) {
    validation *= 0.85; // L319
  }
  if (blockRows.some((row) => row.some(([, t]) => t === best.value && t.stray))) {
    validation *= 0.85; // L321
  }
  if (value !== null && unit === null && resultType === 'numeric' && entry === null && refSource === null) {
    validation *= 0.9; // L323
  }

  const confs: number[] = []; // L325
  for (const c of [nameCell, ...best.cells]) {
    if (c.conf !== null) {
      confs.push(c.conf);
    }
  }
  let valueConf: number | null = null; // L326
  for (const c of best.cells) {
    if (c.conf !== null) {
      valueConf = c.conf;
      break;
    }
  }
  const native = valueConf !== null; // L327
  const ocr = native && confs.length > 0 ? pyMean(confs) : null; // L328
  const product = (ocr !== null ? ocr : 1.0) * validation; // L329
  const confidence = pyRound(
    firstMax([0.0, firstMin([1.0, product], (x) => x) as number], (x) => x) as number,
    4,
  );

  const flag = best.flag; // L339
  return {
    test_name: pySlice(name, 80),
    canonical_code: code,
    result_type: resultType,
    value,
    value_text: truthyText(valueText) ? pySlice(valueText, 80) : null,
    value_low: low,
    value_high: high,
    unit,
    reported_value: numeric && value !== reportedValue ? reportedValue : null, // L335, only when converted
    reported_unit: numeric && value !== reportedValue ? reportedUnit : null,
    ref_low: refLow,
    ref_high: refHigh,
    ref_source: refSource,
    confidence,
    confidence_source: native ? 'native' : 'derived',
    value_source: 'ocr',
    flag: flag === 'H' || flag === 'L' || flag === 'HH' || flag === 'LL' ? flag : null,
    supported: false,
  };
}

/**
 * _unreadable_row (L344): a dictionary test whose result OCR dropped, but whose unit was printed (labs print units only
 * where a result exists). It is sent as an unreadable result so the user is asked to enter it, rather than being
 * silently left out. Rows with no unit are treated as 'test not done' and omitted (null).
 */
function unreadableRow(
  name: string,
  groups: Group[],
  match: Match | null,
  entry: DictionaryAnalyte | null,
  notes: string[],
): ResultRow | null {
  if (match === null || entry === null || entry.result_kind !== 'numeric') {
    return null; // L348
  }
  const printed = groups.filter((g) => truthyText(g.unit)); // L350
  if (printed.length === 0) {
    return null; // L352
  }
  const code = match.code; // L353
  let best: Group = printed[0]; // L354: the first group with the highest unit score
  let bestScore = -1;
  printed.forEach((g, i) => {
    const score = unitScore(code, g.unit, null);
    if (i === 0 || score > bestScore) {
      best = g;
      bestScore = score;
    }
  });
  let unit: string | null = best.unit; // L355
  const fixedUnit = truthyText(unit) ? canonicalUnit(unit) : null; // L356
  if (fixedUnit !== null && (fixedUnit[1] || truthyText(toStandardUnit(code, fixedUnit[0])))) {
    unit = fixedUnit[0]; // L358
  }
  const std = entry.standard_unit; // L359
  if (std !== null && truthyText(unit) && truthyText(toStandardUnit(code, unit))) {
    unit = std; // L361
  }
  const refLow = best.rng !== null ? best.rng.low : null; // L362
  const refHigh = best.rng !== null ? best.rng.high : null; // L363
  notes.push(name + ': the result was not read; asking for it'); // L364
  return {
    test_name: pySlice(name, 80),
    canonical_code: code,
    result_type: 'numeric',
    value: null,
    value_text: null,
    value_low: null,
    value_high: null,
    unit,
    reported_value: null,
    reported_unit: null,
    ref_low: refLow,
    ref_high: refHigh,
    ref_source: refLow !== null || refHigh !== null ? 'printed' : null, // L369
    confidence: 0.3, // L370, a fixed low confidence: the row always goes to the correction screen
    confidence_source: 'derived',
    value_source: 'ocr',
    flag: null,
    supported: false,
  };
}

/**
 * parse_report (L402): sanitized payload -> Contract A record (validated) plus advisory notes. Throws an Error whose
 * message starts with 'invalid payload:', 'visit_date is required' or 'parser produced an invalid record:'.
 */
export function parseReport(payload: unknown, ctx: ParseContext): ParseOutput {
  const errs = validatePayload(payload); // L404
  if (!errs.valid) {
    throw new Error('invalid payload: ' + joinErrors(errs.errors)); // L406
  }
  const doc = payload as { [key: string]: unknown };
  const visitDate: unknown = truthyText(ctx.visitDate) ? ctx.visitDate : doc.visit_date; // L407
  if (!pyTruthy(visitDate)) {
    throw new Error('visit_date is required: confirm it with the user'); // L409
  }
  const sex = ctx.sex === undefined ? null : ctx.sex;
  const notes: string[] = []; // L410
  const results: ResultRow[] = []; // L411
  const narrative: string[] = []; // L412
  const reportType = doc.report_type === undefined ? null : doc.report_type;
  const section =
    reportType === 'urinalysis' || reportType === 'hematology' || reportType === 'chemistry' ? reportType : null; // L413

  for (const page of doc.pages as unknown[]) {
    // L415
    const rows: Row[] = pageRows(page); // L416
    if (rows.length === 0) {
      continue; // L418
    }
    const kind = classify(rows); // L419
    if (kind === 'narrative' || reportType === 'radiology') {
      // L420
      for (const r of rows) {
        const text = rowText(r);
        if (findIdentityLabels(text).length === 0) {
          narrative.push(text); // L423
        } else {
          notes.push('dropped a narrative line carrying an identity label'); // L425
        }
      }
      continue; // L426
    }
    const body = rows.filter((r) => !isHeaderRow(r)); // L427
    for (const stream of splitStreams(body, section)) {
      // L428
      for (const [nameCell, blockRows, sec] of blocks(stream, section, notes)) {
        // L429
        const res = buildResult(nameCell, blockRows, sec, sex, notes); // L430
        if (res !== null) {
          results.push(res); // L432
        }
      }
    }
  }

  const record: RecordWithResults = {
    visit_id: ctx.visitId,
    visit_date: visitDate,
    report_type: reportType,
    page_count: doc.page_count,
    parser_version: engineConstants.parser_version, // L17
    dictionary_version: dictionary.version, // L437
    narrative_text: narrative.length > 0 ? pySlice(narrative.join('\n'), 4000) : null, // L438
    results,
  };
  markSupported(record); // L440
  const problems = validateA(record); // L441
  if (!problems.valid) {
    throw new Error('parser produced an invalid record: ' + joinErrors(problems.errors)); // L443
  }
  return { record, notes }; // L444
}
