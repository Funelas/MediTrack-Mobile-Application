// Qualitative grade lookup (ML-27/ML-28, S6): port of normalize_qualitative in ml/scoring/extensions.py (L53).
// The table _QUALITATIVE (L42) is read from engine_constants.json (decision D8), never typed here.
// Plain TypeScript, no logging, no React Native, fs or path import.
import { engineConstants } from '../data';
import { pyLower, pySplit } from '../py/text';

// A Map, not a plain object: a printed word such as "constructor" must not find an inherited property.
const QUALITATIVE = new Map<string, string>(Object.entries(engineConstants.scoring.qualitative));

/** Canonical grade for a printed qualitative result, or null when it is not a known grade (None in Python). */
export function normalizeQualitative(text: string | null): string | null {
  if (text === null) {
    return null;
  }
  // " ".join(text.lower().replace("–", "-").split()); the en dash is U+2013
  const key = pySplit(pyLower(text).split('–').join('-')).join(' ');
  const grade = QUALITATIVE.get(key);
  return grade === undefined ? null : grade;
}
