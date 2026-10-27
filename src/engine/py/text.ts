// Python string and regex semantics for the engine (ML-27/ML-28, S3, decision D7). The Unicode tables (whitespace,
// decimal-digit zeros, extra isdigit characters) are the ones exported from the Python reference (Unicode 16.0.0);
// Node 20 and Hermes may know an older Unicode version, so these helpers never ask the JavaScript engine.
// Plain TypeScript, no logging, no React Native, fs or path import.
import { engineConstants } from '../data';

const unicode = engineConstants.python_unicode;

const WHITESPACE = new Set<number>(unicode.whitespace);
const DIGIT_VALUE = new Map<number, number>();
unicode.decimal_zeros.forEach((zero) => {
  for (let d = 0; d < 10; d += 1) {
    DIGIT_VALUE.set(zero + d, d);
  }
});
const DIGIT_EXTRA = new Set<number>(unicode.digit_extra);

function codePointOf(ch: string): number {
  return ch.codePointAt(0) as number; // ch comes from Array.from, so it is never empty
}

function escapeCode(code: number): string {
  return '\\u{' + code.toString(16).toUpperCase() + '}';
}

/** Regex character class (source text, for the u flag) of Python's whitespace: str.isspace(), \s, split(), strip(). */
export const PY_SPACE_CLASS = '[' + unicode.whitespace.map(escapeCode).join('') + ']';

/** Regex character class of Python's \d (Unicode decimal digits, blocks of ten starting at each zero). */
export const PY_DIGIT_CLASS =
  '[' + unicode.decimal_zeros.map((zero) => escapeCode(zero) + '-' + escapeCode(zero + 9)).join('') + ']';

/**
 * Python's \w (str pattern, Unicode 16.0.0) taken from the exported table python_unicode.word_ranges, as the body of a
 * character class. Use with the u flag; no JavaScript Unicode table is asked.
 */
export const PY_WORD_CHARS = unicode.word_ranges
  .map(([a, b]) => (a === b ? escapeCode(a) : escapeCode(a) + '-' + escapeCode(b)))
  .join('');

/** Python's \w as a character class. */
export const PY_WORD_CLASS = '[' + PY_WORD_CHARS + ']';

/** Python's . without DOTALL: everything except \n (so \r, U+2028 and U+2029 match). */
export const PY_DOT = '[^\\n]';

/** Python's $ without MULTILINE: the end, or before a final \n. A lookahead, so the \n is not consumed. */
export const PY_END = '(?=\\n?$)';

/** Escapes only the regex syntax characters and / so the result is valid in u mode. (re.escape escapes more.) */
export function pyEscape(s: string): string {
  return s.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&');
}

/**
 * pyEscape(literal) in which each i or I becomes a class that also holds U+0130 and U+0131, because Python's re.I
 * matches them and the flags iu do not. Use the result with the flags iu (Kelvin sign and long s then match as in Python).
 */
export function pyIgnoreCase(literal: string): string {
  return Array.from(literal)
    .map((ch) => (ch === 'i' || ch === 'I' ? '[iI\\u{130}\\u{131}]' : pyEscape(ch)))
    .join('');
}

/** str.isspace(): not empty and every code point is Python whitespace. */
export function pyIsSpace(s: string): boolean {
  const chars = Array.from(s);
  return chars.length > 0 && chars.every((ch) => WHITESPACE.has(codePointOf(ch)));
}

/** str.strip() with no argument. */
export function pyStrip(s: string): string {
  const chars = Array.from(s);
  let start = 0;
  let end = chars.length;
  while (start < end && WHITESPACE.has(codePointOf(chars[start]))) {
    start += 1;
  }
  while (end > start && WHITESPACE.has(codePointOf(chars[end - 1]))) {
    end -= 1;
  }
  return chars.slice(start, end).join('');
}

/** str.split() with no argument: runs of whitespace separate the parts and no part is empty. */
export function pySplit(s: string): string[] {
  const parts: string[] = [];
  let current = '';
  for (const ch of Array.from(s)) {
    if (WHITESPACE.has(codePointOf(ch))) {
      if (current !== '') {
        parts.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current !== '') {
    parts.push(current);
  }
  return parts;
}

/** str.isdecimal(): not empty and every code point is a Unicode decimal digit. */
export function pyIsDecimal(s: string): boolean {
  const chars = Array.from(s);
  return chars.length > 0 && chars.every((ch) => DIGIT_VALUE.has(codePointOf(ch)));
}

/** str.isdigit(): decimal digits plus the extra "digit" characters (superscripts and the like); not empty. */
export function pyIsDigit(s: string): boolean {
  const chars = Array.from(s);
  return (
    chars.length > 0 &&
    chars.every((ch) => {
      const code = codePointOf(ch);
      return DIGIT_VALUE.has(code) || DIGIT_EXTRA.has(code);
    })
  );
}

/** s[:n] counted in code points (n >= 0). */
export function pySlice(s: string, n: number): string {
  return Array.from(s).slice(0, Math.max(0, n)).join('');
}

/** str.lower(): the full lowercase mapping (the Unicode version difference is documented). */
export function pyLower(s: string): string {
  return s.toLowerCase();
}

/** Maps every Unicode decimal digit to ASCII 0-9 and leaves other characters alone. */
export function digitsToAscii(s: string): string {
  return Array.from(s)
    .map((ch) => {
      const value = DIGIT_VALUE.get(codePointOf(ch));
      return value === undefined ? ch : String(value);
    })
    .join('');
}

const DIGITS = '[0-9]+(?:_[0-9]+)*';
const FLOAT_TEXT = new RegExp(
  '^[+-]?(?:' + DIGITS + '(?:\\.(?:' + DIGITS + ')?)?|\\.' + DIGITS + ')(?:[eE][+-]?' + DIGITS + ')?$',
);
const FLOAT_WORD = /^([+-]?)(?:(inf|infinity)|(nan))$/i;

/**
 * Python's float(s) on a string: surrounding Python whitespace, an optional sign, a decimal literal with optional
 * single underscores between digits, an optional fraction and exponent, Unicode decimal digits; inf, infinity and
 * nan in any case with an optional sign. Anything else (including "", "0x10", "1e", "." and a U+FEFF or U+200B
 * prefix) returns null, which stands for Python's ValueError. Number() is called only on text that matched.
 */
export function pyFloat(s: string): number | null {
  // CPython turns only non-ASCII whitespace into spaces and then strips ASCII whitespace (space, \t, \n, \v, \f, \r),
  // so the ASCII separators U+001C to U+001F are not whitespace for float().
  const text = Array.from(s)
    .map((ch) => {
      const code = codePointOf(ch);
      return (code > 127 && WHITESPACE.has(code)) || code === 32 || (code >= 9 && code <= 13) ? ' ' : ch;
    })
    .join('')
    .replace(/^ +/, '')
    .replace(/ +$/, '');
  const ascii = digitsToAscii(text);
  const word = FLOAT_WORD.exec(ascii);
  if (word !== null) {
    if (word[3] !== undefined) {
      return NaN;
    }
    return word[1] === '-' ? -Infinity : Infinity;
  }
  if (!FLOAT_TEXT.test(ascii)) {
    return null;
  }
  const value = Number(ascii.replace(/_/g, ''));
  return Number.isNaN(value) ? null : value;
}
