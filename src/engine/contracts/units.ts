// Name matching and unit conversion (ML-27/ML-28, S5): a port of contracts/contract_checks.py (normalize_name,
// normalize_unit, _build_alias_index and the tables it fills, match_alias, to_standard_unit, is_unitless_fraction,
// convert_to_standard). Every result must equal the Python one (docs/engine_vectors/units.json, exact comparison).
// Plain TypeScript, no logging, no React Native, fs or path import.
import { dictionary, DictionaryAnalyte, unitConversions } from '../data';
import { pyLower, pyStrip } from '../py/text';

export interface ConvertedValue {
  value: number;
  unit: string | null;
}

function has(table: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(table, key);
}

/** normalize_name: lower-case, every run of characters outside a-z and 0-9 becomes one space, then strip. */
export function normalizeName(text: string): string {
  return pyStrip(pyLower(text).replace(/[^a-z0-9]+/g, ' '));
}

/** normalize_unit: strip, lower-case, micro signs to u, superscript two to 2, then remove spaces (U+0020 only). */
export function normalizeUnit(unit: string): string {
  return pyLower(pyStrip(unit))
    .replace(/µ/g, 'u')
    .replace(/μ/g, 'u')
    .replace(/²/g, '2')
    .replace(/ /g, '');
}

/**
 * _build_alias_index over the given analytes (the dictionary's by default): normalized alias to code. An alias that
 * belongs to two codes throws, with the message the Python ValueError has. The same code repeating an alias is fine.
 */
export function buildAliasIndex(
  analytes: Record<string, { aliases: string[] }> = dictionary.analytes,
): Map<string, string> {
  const index = new Map<string, string>();
  for (const code of Object.keys(analytes)) {
    for (const alias of analytes[code].aliases) {
      const key = normalizeName(alias);
      const existing = index.get(key);
      if (existing !== undefined && existing !== code) {
        throw new Error("alias '" + alias + "' maps to both " + existing + ' and ' + code);
      }
      index.set(key, code);
    }
  }
  return index;
}

function buildSectionIndex(): Map<string, Map<string, string>> {
  const sections = new Map<string, Map<string, string>>();
  for (const section of Object.keys(dictionary.section_aliases)) {
    const aliases = dictionary.section_aliases[section];
    const table = new Map<string, string>();
    for (const alias of Object.keys(aliases)) {
      table.set(normalizeName(alias), aliases[alias]);
    }
    sections.set(section, table);
  }
  return sections;
}

/** _ALIAS_INDEX: normalized alias to canonical code, over the whole dictionary. */
export const ALIAS_INDEX: ReadonlyMap<string, string> = buildAliasIndex();

/** _SECTION_INDEX: report section to {normalized alias: canonical code}. */
export const SECTION_INDEX: ReadonlyMap<string, ReadonlyMap<string, string>> = buildSectionIndex();

/**
 * match_alias: exact whole-name match after normalization. The section's own aliases are tried first, then the
 * global ones. Returns the canonical code or null.
 */
export function matchAlias(name: string, section: string | null = null): string | null {
  const key = normalizeName(name);
  if (section !== null) {
    const own = SECTION_INDEX.get(section);
    if (own !== undefined) {
      const code = own.get(key);
      if (code !== undefined) {
        return code;
      }
    }
  }
  const code = ALIAS_INDEX.get(key);
  return code === undefined ? null : code;
}

function analyteOf(code: string): DictionaryAnalyte | null {
  return has(dictionary.analytes, code) ? dictionary.analytes[code] : null;
}

/**
 * to_standard_unit: the dictionary standard unit when rawUnit is the standard or a listed numerically identical
 * alias, otherwise null. A dimensionless analyte (standard unit null) takes a missing or blank unit and gives "".
 */
export function toStandardUnit(code: string, rawUnit: string | null): string | null {
  const entry = analyteOf(code);
  if (entry === null) {
    return null;
  }
  if (entry.standard_unit === null) {
    return rawUnit === null || pyStrip(rawUnit) === '' ? '' : null;
  }
  if (rawUnit === null) {
    return null;
  }
  const allowed = new Set<string>([normalizeUnit(entry.standard_unit), ...entry.unit_aliases.map(normalizeUnit)]);
  return allowed.has(normalizeUnit(rawUnit)) ? entry.standard_unit : null;
}

/** is_unitless_fraction: a fraction-rule code with no unit read (a blank unit counts as none). */
export function isUnitlessFraction(code: string, rawUnit: string | null): boolean {
  return (
    unitConversions.fraction_to_percent.canonical_codes.includes(code) &&
    normalizeUnit(rawUnit === null || rawUnit === '' ? '' : rawUnit) === ''
  );
}

/**
 * convert_to_standard: converts one number to the dictionary standard unit with unit_conversions.json. Returns
 * {value, unit} or null when no listed conversion applies. A missing value, a boolean (Python's isinstance bool) and
 * an unknown code give null. The ML-29 bound gate for the fraction rule belongs to the parser, not here.
 */
export function convertToStandard(
  code: string,
  value: number | boolean | null,
  rawUnit: string | null,
): ConvertedValue | null {
  if (value === null || typeof value === 'boolean') {
    return null;
  }
  const entry = analyteOf(code);
  if (entry === null) {
    return null;
  }
  const unit = rawUnit !== null && rawUnit !== '' ? normalizeUnit(rawUnit) : '';
  for (const rule of unitConversions.linear) {
    if (rule.canonical_code === code && normalizeUnit(rule.from_unit) === unit) {
      const out = rule.operation === 'multiply' ? value * (rule.factor as number) : value / (rule.divisor as number);
      return { value: out, unit: rule.to_unit };
    }
  }
  for (const rule of unitConversions.affine) {
    if (rule.canonical_code === code && normalizeUnit(rule.from_unit) === unit) {
      return { value: rule.a * value + rule.b, unit: rule.to_unit };
    }
  }
  const frac = unitConversions.fraction_to_percent;
  if (frac.canonical_codes.includes(code) && (unit === '' || unit === 'fraction' || unit === 'l/l') && value >= 0 && value <= 1.0) {
    return { value: value * frac.factor, unit: entry.standard_unit };
  }
  return null;
}
