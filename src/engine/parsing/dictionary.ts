// Test-name resolver (ML-27/ML-28, S7): a port of parsing/dictionary.py, line by line in Python's operation order. Every
// result must equal the Python one (docs/engine_vectors/names.json, exact comparison of code, method, score and of the
// pool tables, order included). Matching constants come from engine_constants.json (decision D8). Python dicts keep
// insertion order and a repeated key keeps its first position; Map does both, so the pools are Maps. Plain TypeScript,
// no logging, no React Native, fs or path import.
import { DictionaryAnalyte, dictionary, engineConstants } from '../data';
import { matchAlias, normalizeName, SECTION_INDEX } from '../contracts/units';
import { extract as fuzzyExtract, levenshteinDistance, tokenSortRatio } from '../py/fuzz';
import { pyRound } from '../py/round';
import { pyStrip } from '../py/text';

const MATCHING = engineConstants.matching;
export const FUZZY_THRESHOLD: number = MATCHING.fuzzy_threshold;
export const AMBIGUITY_MARGIN: number = MATCHING.ambiguity_margin;
export const MIN_FUZZY_LEN: number = MATCHING.min_fuzzy_len;
export const SINGLE_EDIT_MIN_LEN: number = MATCHING.single_edit_min_len;
export const SINGLE_EDIT_SCORE: number = MATCHING.single_edit_score;

/** The Match dataclass: method is "exact", "section" or "fuzzy"; score is 1.0, ratio/100 or the single-edit score. */
export interface Match {
  code: string;
  method: string;
  score: number;
}

/**
 * _candidates: spelling variants of a printed label worth trying: the whole label, without a trailing parenthetical,
 * and each part of 'A / B' labels. Variants that normalize to a name already seen (or to nothing) are dropped.
 */
export function candidates(name: string): string[] {
  const out: string[] = [name];
  const stripped = pyStrip(name.replace(/\([^)]*\)/g, ' '));
  if (stripped !== '' && stripped !== name) {
    out.push(stripped);
  }
  for (const base of out.slice()) {
    if (base.includes('/')) {
      for (const part of base.split('/')) {
        const piece = pyStrip(part);
        if (piece !== '') {
          out.push(piece);
        }
      }
    }
  }
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const c of out) {
    const k = normalizeName(c);
    if (k !== '' && !seen.has(k)) {
      seen.add(k);
      uniq.push(c);
    }
  }
  return uniq;
}

/** _fuzzy_pool: normalized alias (at least MIN_FUZZY_LEN characters) to code, over the whole dictionary. */
function buildFuzzyPool(): Map<string, string> {
  const pool = new Map<string, string>();
  for (const code of Object.keys(dictionary.analytes)) {
    for (const alias of dictionary.analytes[code].aliases) {
      const key = normalizeName(alias);
      if (key.length >= MIN_FUZZY_LEN) {
        pool.set(key, code);
      }
    }
  }
  return pool;
}

/** _POOL: the global fuzzy pool, in dictionary order. */
export const POOL: ReadonlyMap<string, string> = buildFuzzyPool();

/** _SECTION_POOLS: the pools built so far, one per report section (filled on first use, as in Python). */
const SECTION_POOLS = new Map<string, ReadonlyMap<string, string>>();

/**
 * _pool_for: global aliases plus the report section's own aliases (so 'Biood' finds 'Blood' in a urinalysis). A null,
 * empty or unknown section uses the global pool.
 */
export function poolFor(section: string | null = null): ReadonlyMap<string, string> {
  if (section === null || section === '' || !SECTION_INDEX.has(section)) {
    return POOL;
  }
  const cached = SECTION_POOLS.get(section);
  if (cached !== undefined) {
    return cached;
  }
  const merged = new Map<string, string>(POOL);
  (SECTION_INDEX.get(section) as ReadonlyMap<string, string>).forEach((code, key) => {
    if (key.length >= MIN_FUZZY_LEN) {
      merged.set(key, code);
    }
  });
  SECTION_POOLS.set(section, merged);
  return merged;
}

/** A pool as ordered [key, code] pairs, the shape of tables.fuzzy_pool in names.json. */
export function poolPairs(pool: ReadonlyMap<string, string>): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  pool.forEach((code, key) => {
    pairs.push([key, code]);
  });
  return pairs;
}

/** resolve: a printed test name to a canonical code, or null when there is no safe match. */
export function resolve(name: string, section: string | null = null): Match | null {
  if (!name || pyStrip(name) === '') {
    return null;
  }
  const variants = candidates(name);
  const sectionIndex = section !== null && section !== '' ? SECTION_INDEX.get(section) : undefined;
  for (const v of variants) {
    const code = matchAlias(v, section);
    if (code !== null) {
      return { code, method: sectionIndex !== undefined && sectionIndex.has(normalizeName(v)) ? 'section' : 'exact', score: 1.0 };
    }
  }
  for (const v of variants) {
    const key = normalizeName(v);
    if (key.length < MIN_FUZZY_LEN) {
      continue;
    }
    const pool = poolFor(section);
    const keys = Array.from(pool.keys());
    const hits = fuzzyExtract(key, keys, tokenSortRatio, { limit: 5 });
    if (hits.length > 0 && hits[0].score >= FUZZY_THRESHOLD) {
      const bestCode = pool.get(hits[0].choice) as string;
      const rival = hits
        .slice(1)
        .filter((h) => pool.get(h.choice) !== bestCode && hits[0].score - h.score <= AMBIGUITY_MARGIN);
      if (rival.length === 0) {
        return { code: bestCode, method: 'fuzzy', score: pyRound(hits[0].score / 100.0, 4) };
      }
      continue;
    }
    if (key.length >= SINGLE_EDIT_MIN_LEN) {
      // one wrong character in a 5+ letter name ('Biood')
      const near = new Set<string>();
      for (const k of keys) {
        if (Math.abs(k.length - key.length) <= 1 && levenshteinDistance(key, k) <= 1) {
          near.add(pool.get(k) as string);
        }
      }
      if (near.size === 1) {
        return { code: Array.from(near)[0], method: 'fuzzy', score: SINGLE_EDIT_SCORE };
      }
    }
  }
  return null;
}

/** entry: the dictionary row of a canonical code; an unknown code throws (Python's KeyError). */
export function entry(code: string): DictionaryAnalyte {
  if (!Object.prototype.hasOwnProperty.call(dictionary.analytes, code)) {
    throw new Error("unknown canonical code '" + code + "'");
  }
  return dictionary.analytes[code];
}
