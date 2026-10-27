// Field extraction (ML-27/ML-28, S6): port of ml/parsing/extract.py, line by line in Python's operation order.
// Tables (superscripts, qualitative words, known units, the unit fuzzy cutoff) are read from engine_constants.json
// (decision D8). Regular expressions and small literals inside expressions are written here with the extract.py line
// they come from. Python semantics (\d, \s, ., $, str.strip, str.split, float) come from ../py/text (decision D7).
// Plain TypeScript, no logging, no React Native, fs or path import.
import { engineConstants } from '../data';
import { extract as fuzzyExtract, ratio } from '../py/fuzz';
import {
  PY_DIGIT_CLASS,
  PY_DOT,
  PY_END,
  PY_SPACE_CLASS,
  PY_WORD_CHARS,
  pyFloat,
  pyIsDigit,
  pyLower,
  pySplit,
  pyStrip,
} from '../py/text';
import { normalizeQualitative } from './qualitative';

/** What a printed cell is (the Typed dataclass, extract.py L115); keys are snake_case as in the vector files (D12). */
export interface Typed {
  kind: string; // number, range, unit, qual, mixed, flag, sex, junk, text
  text: string;
  value: number | null; // number / mixed
  low: number | null; // range
  high: number | null;
  unit: string | null; // unit text carried inside the cell
  flag: string | null;
  fixed: boolean; // an OCR digit fix was applied
  stray: boolean; // a stray mark (handwriting, tick) was stripped from the cell
  is_count_range: boolean; // a range that is a result ("2-4/hpf"), not a reference interval
}

type TypedFields = Partial<Omit<Typed, 'kind' | 'text'>>;

function makeTyped(kind: string, text: string, fields: TypedFields = {}): Typed {
  return {
    kind,
    text,
    value: null,
    low: null,
    high: null,
    unit: null,
    flag: null,
    fixed: false,
    stray: false,
    is_count_range: false,
    ...fields,
  };
}

const EXTRACT = engineConstants.extract;
const D = PY_DIGIT_CLASS; // \d
const S = PY_SPACE_CLASS; // \s

const SUPERSCRIPT_DIGITS = new Map<string, string>(Object.entries(EXTRACT.superscript_digits)); // L16
const SUPERSCRIPT = new Map<string, string>(Object.entries(EXTRACT.superscript)); // L19, the str.translate table
const QUAL_WORDS = new Set<string>(EXTRACT.qual_words); // L31
const UNITS = new Set<string>(EXTRACT.known_units); // L66
const FUZZY_UNITS: readonly string[] = EXTRACT.fuzzy_units; // L69
const UNIT_FUZZY_CUTOFF = engineConstants.matching.unit_fuzzy_cutoff; // L70

function codeEscape(ch: string): string {
  return '\\u{' + (ch.codePointAt(0) as number).toString(16).toUpperCase() + '}';
}

// L18: "[" + all superscript digits + "]+"
const RE_SUPERSCRIPT_RUN = new RegExp('[' + Array.from(SUPERSCRIPT_DIGITS.keys()).map(codeEscape).join('') + ']+', 'gu');
// L23: _NUM
const NUM = D + '+(?:[.,]' + D + '+)?';
// L24
const RE_NUMBER = new RegExp('^[-+]?' + NUM + PY_END, 'u');
// L25, re.I; the pattern has no letter that Python's re.I treats differently from the flags iu
const RE_RANGE2 = new RegExp('^(' + NUM + ')' + S + '*(?:-|to)' + S + '*(' + NUM + ')' + S + '*(' + PY_DOT + '*)' + PY_END, 'iu');
// L26, re.I
const RE_UPPER = new RegExp('^(?:<=|<|up to|upto|less than)' + S + '*(' + NUM + ')' + S + '*(' + PY_DOT + '*)' + PY_END, 'iu');
// L27, re.I
const RE_LOWER = new RegExp('^(?:>=|>|more than)' + S + '*(' + NUM + ')' + S + '*(' + PY_DOT + '*)' + PY_END, 'iu');
// L28
const RE_FLAG = new RegExp('^\\(?(HH|LL|H|L|\\*|↑|↓|▲|▼)\\)?' + PY_END, 'u');
// L29: the class [\s\-_=.~'`|/\\!:;,•°] with \s spelled out (a class cannot hold another class)
const RE_JUNK = new RegExp("^(?:" + S + "|[\\-_=.~'`|/\\\\!:;,•°])*" + PY_END, 'u');
// L30
const RE_GRADE = new RegExp('^(?:[1-4]\\+|\\++)' + PY_END, 'u');
// L34
const MIXED = new RegExp('^([A-Za-z][A-Za-z ]*?)' + S + '+(' + NUM + ')' + PY_END, 'u');
// L129
const RE_FUSED = new RegExp('^(' + D + '+\\.' + D + '{2})(' + D + '+\\.' + D + '{1,2})' + PY_END, 'u');
// L130: \w is PY_WORD_CHARS (Python's \w, exported table)
const RE_GARBLED_TAIL = new RegExp("^x?" + S + "*[" + PY_WORD_CHARS + "^'¹²³.]*" + S + "*/" + S + "*[lL]" + PY_END, 'u');
// L166
const RE_STRAY = new RegExp('^[A-Za-z|/!()\\[\\]✓✔]' + PY_END, 'u');
// L220: [<>\d] spelled out as an alternative
const RE_FUSED_STRAY = new RegExp("^[A-Za-z|!'`](?=[<>]|" + D + ')(' + PY_DOT + '+)' + PY_END, 'u');
// L96
const RE_THOUSANDS = new RegExp('^' + D + '{1,3}(?:,' + D + '{3})+(?:\\.' + D + '+)?$', 'u');
// L110: fullmatch of the OCR-confusable character set, a digit, and one confusable letter
const RE_DIGITS_AND_LETTERS = /^[0-9OolI.,\-+]+$/u;
const RE_ANY_DIGIT = new RegExp(D, 'u');
const RE_CONFUSABLE = /[OolI]/u;
// L47 and L48 (the $ inside the lookahead is Python's $)
const RE_LEADING_TIMES = /^x(?=10\^)/u;
const RE_SLASH_MISREAD = new RegExp('^[il|](?=[hl]pf' + PY_END + ')', 'u');
const RE_LEADING_X = new RegExp('^x' + S + '*', 'u'); // L147
const RE_LOWER_WORDS = /[a-z]+/g; // L215, L217 (findall)

/** Superscript digit runs become ^digits, micro signs become u, typographic dashes become '-'. */
export function normalizeText(s: string): string {
  const withCarets = s.replace(
    RE_SUPERSCRIPT_RUN,
    (run) =>
      '^' +
      Array.from(run)
        .map((ch) => SUPERSCRIPT_DIGITS.get(ch) as string) // the run holds only keys of the table
        .join(''),
  );
  const translated = Array.from(withCarets)
    .map((ch) => {
      const mapped = SUPERSCRIPT.get(ch);
      return mapped === undefined ? ch : mapped;
    })
    .join('');
  return pyStrip(translated);
}

/** Lowercase, no spaces, superscripts to ^n, micro sign to u, leading 'x' (times) removed. */
export function normalizeUnitText(s: string): string {
  let t = pyLower(normalizeText(s)).split(' ').join('').split('×').join('x');
  t = t.replace(RE_LEADING_TIMES, '');
  t = t.replace(RE_SLASH_MISREAD, '/');
  return t;
}

/** (known unit, was_fuzzy) for a printed unit, or null. A garbled unit is matched to the closest known unit when it is close enough and unambiguous. */
export function canonicalUnit(text: string): [string, boolean] | null {
  const key = normalizeUnitText(text);
  if (key === '') {
    return null;
  }
  if (UNITS.has(key)) {
    return [key, false];
  }
  if (Array.from(key).length < 5) {
    return null;
  }
  const hits = fuzzyExtract(key, FUZZY_UNITS, ratio, { limit: 2, scoreCutoff: UNIT_FUZZY_CUTOFF });
  if (hits.length === 0 || (hits.length === 2 && hits[0].score - hits[1].score < 3)) {
    return null;
  }
  return [hits[0].choice, true];
}

export function isUnit(text: string): boolean {
  return canonicalUnit(text) !== null;
}

/** Parse a plain number. A comma is a thousands separator only in the 1,234 pattern. Null stands for Python's None. */
export function toFloat(token: string): number | null {
  let t = pyStrip(token).replace(/^\++/, '');
  if (RE_THOUSANDS.test(t)) {
    t = t.split(',').join('');
  } else {
    t = t.split(',').join('.');
  }
  return pyFloat(t); // float(t); null when Python raises ValueError
}

/** Fix OCR letter/digit confusions (O,o to 0; l,I to 1) in a token that is otherwise digits. Returns [text, changed]. */
export function fixNumeric(text: string): [string, boolean] {
  const t = pyStrip(text);
  if (RE_DIGITS_AND_LETTERS.test(t) && RE_ANY_DIGIT.test(t) && RE_CONFUSABLE.test(t)) {
    const fixed = Array.from(t)
      .map((ch) => ('OolI'.includes(ch) ? '0011'['OolI'.indexOf(ch)] : ch))
      .join('');
    return [fixed, true];
  }
  return [t, false];
}

export function parseRange(text: string): Typed | null {
  const t = normalizeText(text);
  const fused = RE_FUSED.exec(t);
  if (fused !== null) {
    // the dash between two decimals was lost: '3.805.50'
    const lo = toFloat(fused[1]);
    const hi = toFloat(fused[2]);
    if (lo !== null && hi !== null && lo < hi) {
      return makeTyped('range', text, { low: lo, high: hi, fixed: true });
    }
  }
  let m = RE_RANGE2.exec(t);
  if (m !== null) {
    const lo = toFloat(m[1]);
    const hi = toFloat(m[2]);
    let tail = pyStrip(m[3]);
    if (lo === null || hi === null || lo > hi) {
      return null;
    }
    let garbled = false;
    if (tail !== '' && !(isUnit(tail) || isUnit(tail.replace(RE_LEADING_X, '')))) {
      if (!RE_GARBLED_TAIL.test(tail)) {
        return null;
      }
      garbled = true;
      tail = ''; // a unit ending in '/L' that OCR mangled: keep the numbers, drop the unit
    }
    const unitText = normalizeUnitText(tail);
    return makeTyped('range', text, {
      low: lo,
      high: hi,
      unit: tail === '' ? null : tail,
      fixed: garbled,
      is_count_range: tail !== '' && (unitText.endsWith('hpf') || unitText.endsWith('lpf')),
    });
  }
  m = RE_UPPER.exec(t);
  if (m !== null) {
    const hi = toFloat(m[1]);
    const tail = pyStrip(m[2]);
    if (hi !== null && (tail === '' || isUnit(tail))) {
      return makeTyped('range', text, { high: hi, unit: tail === '' ? null : tail });
    }
  }
  m = RE_LOWER.exec(t);
  if (m !== null) {
    const lo = toFloat(m[1]);
    const tail = pyStrip(m[2]);
    if (lo !== null && (tail === '' || isUnit(tail))) {
      return makeTyped('range', text, { low: lo, unit: tail === '' ? null : tail });
    }
  }
  return null;
}

/**
 * Remove a single stray mark (one character) at either end of a multi-token cell, so that '/ 8.3' or 'f 0.78'
 * still reads as a number. A trailing H or L is a flag, not a stray mark.
 */
function stripStray(t: string): string | null {
  const parts = pySplit(t);
  if (parts.length < 2) {
    return null;
  }
  if (RE_STRAY.test(parts[0])) {
    return parts.slice(1).join(' ');
  }
  const last = parts[parts.length - 1];
  if (RE_STRAY.test(last) && last !== 'H' && last !== 'L') {
    return parts.slice(0, -1).join(' ');
  }
  return null;
}

function lowerWords(s: string): string[] {
  const found = pyLower(s).match(RE_LOWER_WORDS);
  return found === null ? [] : found;
}

export function classifyCell(text: string): Typed {
  const raw = pyStrip(text);
  const t = normalizeText(raw);
  if (t === '' || RE_JUNK.test(t)) {
    return makeTyped('junk', raw);
  }
  const flagMatch = RE_FLAG.exec(t);
  if (flagMatch !== null) {
    return makeTyped('flag', raw, { flag: flagMatch[1] });
  }
  const lowered = pyLower(t);
  if (lowered === 'male' || lowered === 'female') {
    return makeTyped('sex', raw, { flag: lowered });
  }
  const r = parseRange(t);
  if (r !== null) {
    r.text = raw;
    return r;
  }
  const [fixedText, fixed] = fixNumeric(t);
  if (RE_NUMBER.test(fixedText)) {
    return makeTyped('number', raw, { value: toFloat(fixedText), fixed });
  }
  // number followed by a unit and/or a flag: "125 g/L", "134 H"
  const parts = pySplit(t);
  if (parts.length >= 2) {
    const [first, fx] = fixNumeric(parts[0]);
    if (RE_NUMBER.test(first)) {
      const rest = parts.slice(1).join(' ');
      const fm = RE_FLAG.exec(parts[parts.length - 1]);
      const body = fm !== null ? parts.slice(1, -1).join(' ') : rest;
      if ((body === '' || isUnit(body)) && (fm !== null || body !== '')) {
        return makeTyped('number', raw, {
          value: toFloat(first),
          unit: body === '' ? null : body,
          flag: fm !== null ? fm[1] : null,
          fixed: fx,
        });
      }
    }
  }
  if (isUnit(t)) {
    return makeTyped('unit', raw, { unit: t });
  }
  if (normalizeQualitative(t) !== null || RE_GRADE.test(t)) {
    return makeTyped('qual', raw);
  }
  const mm = MIXED.exec(t);
  if (mm !== null && lowerWords(mm[1]).every((w) => QUAL_WORDS.has(w))) {
    return makeTyped('mixed', raw, { value: toFloat(mm[2]) });
  }
  const words = lowerWords(t);
  if (words.length > 0 && words.every((w) => QUAL_WORDS.has(w) || normalizeQualitative(w) !== null)) {
    return makeTyped('qual', raw);
  }
  const fusedStray = RE_FUSED_STRAY.exec(t);
  if (fusedStray !== null) {
    const inner = classifyCell(fusedStray[1]);
    if (inner.kind === 'number' || inner.kind === 'range') {
      inner.text = pyStrip(fusedStray[1]);
      inner.stray = true;
      return inner;
    }
  }
  const stripped = stripStray(t);
  if (stripped !== null) {
    const inner = classifyCell(stripped);
    if (inner.kind === 'number' || inner.kind === 'range') {
      inner.text = pyStrip(stripped);
      inner.stray = true;
      return inner;
    }
  }
  if (Array.from(t).length <= 1 && !pyIsDigit(t)) {
    return makeTyped('junk', raw);
  }
  return makeTyped('text', raw);
}
