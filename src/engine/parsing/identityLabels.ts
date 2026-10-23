// Identity and signature labels (ML-27/ML-28, S9): the label part of ml/parsing/identity_filter.py (_label_re,
// _RE_IDENTITY, _RE_SIGNATURE, find_identity_labels). The rest of that file (footer, dates, keep regions, sanitize) is
// the identity-filter port of MOB-02, not this module. The two word lists are read from engine_constants.json (decision
// D8); they are word lists, not patient data. Python's re.I matches i and I against U+0130 and U+0131 and the flags iu do
// not, so every i of a label becomes an explicit class (pyIgnoreCase); the Kelvin sign and the long s match through the
// flags iu, as they do in Python (decision D7). \s is Python's whitespace and $ is the end or before a final newline.
// Plain TypeScript, no logging, no React Native, fs or path import.
import { engineConstants } from '../data';
import { stableSort } from '../py/sort';
import { PY_END, PY_SPACE_CLASS, pyIgnoreCase, pySlice, pyStrip } from '../py/text';

const S = PY_SPACE_CLASS; // \s

// The characters re.escape puts a backslash before (Python 3.7 and later); only the length of the result is needed.
const RE_ESCAPED = new Set<string>(Array.from('()[]{}?*+-|^$\\.&~# \t\n\r\v\f'));

function escapedLength(label: string): number {
  return Array.from(label).reduce((n, ch) => n + (RE_ESCAPED.has(ch) ? 2 : 1), 0);
}

/**
 * _label_re (L42): a regular expression that matches, at the start of a text, optional whitespace, one of the labels
 * (longest first, as re.escape would write them; sorted() with reverse=True keeps equal lengths in input order), optional
 * whitespace, then a colon or the end of the text. No g or y flag, so test() has no state.
 */
export function labelRegex(labels: readonly string[]): RegExp {
  const alts = stableSort(labels, (a, b) => escapedLength(b) - escapedLength(a))
    .map(pyIgnoreCase)
    .join('|');
  return new RegExp('^' + S + '*(?:' + alts + ')' + S + '*(?::|' + PY_END + ')', 'iu');
}

/** _RE_IDENTITY (L47): labels that name the patient or another person. */
export const IDENTITY_RE: RegExp = labelRegex(engineConstants.labels.identity);

/** _RE_SIGNATURE (L48): labels that introduce a signature or a person who handled the sample. */
export const SIGNATURE_RE: RegExp = labelRegex(engineConstants.labels.signature);

const LINE_BREAKS = /[\r\n]+/; // L59
const PIECE_BREAKS = new RegExp(S + '{2,}|\\t', 'u'); // L60

/** find_identity_labels (L55): labels found at the start of any line piece of text (the server-side output guard). */
export function findIdentityLabels(text: string): string[] {
  const found: string[] = [];
  for (const line of text.split(LINE_BREAKS)) {
    for (const piece of line.split(PIECE_BREAKS)) {
      if (IDENTITY_RE.test(piece) || SIGNATURE_RE.test(piece)) {
        found.push(pySlice(pyStrip(piece), 40)); // L62
      }
    }
  }
  return found;
}
