import TextRecognition from '@react-native-ml-kit/text-recognition';
import type {MlKitResultLike} from '../scan/mlkitPages';

export interface ParsedEntry {
  fieldName: string;
  value: string;
  unit?: string;
}

/**
 * Runs ML Kit OCR on the given image URI and returns raw recognized text.
 */
export async function recognizeText(imageUri: string): Promise<string> {
  const result = await TextRecognition.recognize(imageUri);

  // Flatten all lines across all blocks, each with their Y and X position
  const lines: {text: string; top: number; left: number}[] = [];

  for (const block of result.blocks) {
    for (const line of block.lines) {
      const frame = line.frame;
      if (frame) {
        lines.push({
          text: line.text,
          top: frame.top,
          left: frame.left,
        });
      }
    }
  }

  // Sort: group lines into horizontal bands (within 20px of each other),
  // then sort left-to-right within each band
  const ROW_TOLERANCE = 20;
  lines.sort((a, b) => {
    const rowDiff = a.top - b.top;
    if (Math.abs(rowDiff) <= ROW_TOLERANCE) {
      // Same row — sort left to right
      return a.left - b.left;
    }
    // Different rows — sort top to bottom
    return rowDiff;
  });

  return lines.map(l => l.text).join('\n');
}

/**
 * Runs ML Kit OCR on the given image URI and returns the full wrapper result (blocks, lines, words and frames).
 * The caller keeps it in a local variable only; nothing is logged or stored here.
 */
export async function recognizeResult(imageUri: string): Promise<MlKitResultLike> {
  return TextRecognition.recognize(imageUri);
}

/**
 * Known aliases for field names — maps normalized variants to the canonical field name.
 * Keys are lowercase, stripped of non-alphanumeric characters.
 */
const FIELD_ALIASES: Record<string, string[]> = {
  // CBC
  'wbc':  ['white blood cell', 'white blood cells', 'leukocytes', 'leukocyte count'],
  'rbc':  ['red blood cell', 'red blood cells', 'erythrocytes', 'erythrocyte count'],
  'hgb':  ['hemoglobin', 'haemoglobin', 'hb'],
  'hct':  ['hematocrit', 'haematocrit', 'packed cell volume', 'pcv'],
  'mcv':  ['mean corpuscular volume', 'mean cell volume'],
  'mch':  ['mean corpuscular hemoglobin', 'mean cell hemoglobin'],
  'mchc': ['mean corpuscular hemoglobin concentration', 'mean cell hemoglobin concentration'],
  'plt':  ['platelet', 'platelets', 'platelet count', 'thrombocytes'],
  // Clinical Chemistry
  'hba1c':           ['glycated hemoglobin', 'glycosylated hemoglobin', 'a1c', 'hemoglobin a1c'],
  'fbs':             ['fasting blood sugar', 'fasting glucose', 'fasting blood glucose', 'fbg'],
  'totalcholesterol':['cholesterol', 'total chol', 'chol'],
  'hdl':             ['high density lipoprotein', 'hdl cholesterol', 'good cholesterol'],
  'ldl':             ['low density lipoprotein', 'ldl cholesterol', 'bad cholesterol'],
  'vldl':            ['very low density lipoprotein', 'vldl cholesterol'],
  'triglycerides':   ['triglyceride', 'trig', 'trigs', 'tg'],
  'bun':             ['blood urea nitrogen', 'urea nitrogen', 'urea'],
  'bua':             ['blood uric acid', 'uric acid'],
  'creatinine':      ['creat', 'serum creatinine'],
  'sgptalt':         ['alanine aminotransferase', 'alanine transaminase', 'alt', 'sgpt'],
  'sgotast':         ['aspartate aminotransferase', 'aspartate transaminase', 'ast', 'sgot'],
  'sodium':          ['na', 'serum sodium'],
  'potassium':       ['k', 'serum potassium'],
  'ionizedcalcium':  ['ca', 'calcium', 'serum calcium', 'ionised calcium'],
  'magnesium':       ['mg', 'serum magnesium'],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getAliases(fieldName: string, fieldAliases?: string[]): string[] {
  const key = normalize(fieldName);
  const builtIn = FIELD_ALIASES[key] ?? [];
  const indirect = Object.entries(FIELD_ALIASES)
    .filter(([, aliases]) => aliases.some(a => normalize(a) === key))
    .map(([k]) => k);
  const userAliases = (fieldAliases ?? []).map(normalize);
  return [key, ...builtIn.map(normalize), ...indirect, ...userAliases];
}

/**
 * Parses raw OCR text against a list of known fields.
 * For each field, scans lines for a match using the field name and all known aliases.
 * Grabs the first numeric value on the same line or the next line.
 */
export function parseOCRText(
  rawText: string,
  fields: {name: string; unit?: string; aliases?: string[]}[],
): ParsedEntry[] {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const numericRegex = /\b\d+(\.\d+)?\b/;
  const numericRegexG = /\b\d+(\.\d+)?\b/g;

  // ── Step 1: find which line index each field name appears on ──
  const matchLineIndexes: number[] = fields.map(field => {
    const aliases = getAliases(field.name, field.aliases);
    let best = -1;
    let bestScore = 0;
    lines.forEach((line, i) => {
      const lineLower = normalize(line);
      for (const alias of aliases) {
        if (lineLower.includes(alias)) {
          const score = alias.length * 2;
          if (score > bestScore) { bestScore = score; best = i; }
          break;
        }
        const score = alias.split('').filter(c => lineLower.includes(c)).length;
        const ratio = score / alias.length;
        if (ratio > 0.75 && score > bestScore) { bestScore = score; best = i; }
      }
    });
    return best;
  });

  // ── Step 2: check if this looks like a columnar report ──
  // Columnar = field names are found, but those lines have NO numeric value
  const matchedFields = matchLineIndexes.filter(i => i !== -1);
  const isColumnar = matchedFields.length >= 2 && matchedFields.every(i => {
    const line = lines[i];
    return !numericRegex.test(line);
  });

  if (isColumnar) {
    // ── Columnar strategy ──
    // Find the last line where any field name appears
    const lastNameLine = Math.max(...matchedFields);

    // Collect all numbers that appear AFTER the last field name line
    // Prefer the "Conventional Unit" block if the word appears
    const conventionalIdx = lines.findIndex(
      (l, i) => i > lastNameLine && /conventional/i.test(l)
    );
    const siIdx = lines.findIndex(
      (l, i) => i > lastNameLine && /\bsi\b|si unit/i.test(l)
    );

    // Start collecting numbers from after the last name line,
    // but if we can find a "Conventional" section header, prefer those numbers
    const startIdx = conventionalIdx !== -1 ? conventionalIdx + 1
                   : siIdx !== -1           ? siIdx + 1
                   : lastNameLine + 1;

    const valueLines = lines.slice(startIdx);
    const allValues: string[] = [];
    for (const line of valueLines) {
      // skip header-like lines (Flag, Result, Normal Range, etc.)
      if (/flag|result|normal|range|unit|conventional|si\b/i.test(line)) continue;
      const nums = line.match(numericRegexG);
      if (nums) allValues.push(...nums);
    }

    // Map each matched field (in order of appearance) to a value by index
    let valueIdx = 0;
    const ordered = [...matchLineIndexes]
      .map((lineIdx, fieldIdx) => ({ lineIdx, fieldIdx }))
      .filter(x => x.lineIdx !== -1)
      .sort((a, b) => a.lineIdx - b.lineIdx);

    const fieldValues: Record<number, string> = {};
    for (const { fieldIdx } of ordered) {
      fieldValues[fieldIdx] = allValues[valueIdx] ?? '';
      valueIdx++;
    }

    return fields.map((field, i) => ({
      fieldName: field.name,
      value: fieldValues[i] ?? '',
      unit: field.unit,
    }));
  }

  // ── Inline strategy (original logic) ──
  return fields.map((field, i) => {
    const matchLineIndex = matchLineIndexes[i];
    if (matchLineIndex === -1) return { fieldName: field.name, value: '', unit: field.unit };

    const inlineMatch = lines[matchLineIndex].match(numericRegex);
    if (inlineMatch) return { fieldName: field.name, value: inlineMatch[0], unit: field.unit };

    const nextMatch = (lines[matchLineIndex + 1] ?? '').match(numericRegex);
    if (nextMatch) return { fieldName: field.name, value: nextMatch[0], unit: field.unit };

    return { fieldName: field.name, value: '', unit: field.unit };
  });
}