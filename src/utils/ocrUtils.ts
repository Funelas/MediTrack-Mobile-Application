import TextRecognition from '@react-native-ml-kit/text-recognition';

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
  return result.text;
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

  const numericRegex = /\d+(\.\d+)?/;

  return fields.map(field => {
    const aliases = getAliases(field.name, field.aliases);

    let matchLineIndex = -1;
    let bestScore = 0;

    lines.forEach((line, i) => {
      const lineLower = normalize(line);

      for (const alias of aliases) {
        // exact substring match — highest priority
        if (lineLower.includes(alias)) {
          const score = alias.length * 2;
          if (score > bestScore) {
            bestScore = score;
            matchLineIndex = i;
          }
          break;
        }
        // fuzzy fallback
        const score = alias.split('').filter(c => lineLower.includes(c)).length;
        const ratio = score / alias.length;
        if (ratio > 0.75 && score > bestScore) {
          bestScore = score;
          matchLineIndex = i;
        }
      }
    });

    if (matchLineIndex === -1) return {fieldName: field.name, value: '', unit: field.unit};

    const inlineMatch = lines[matchLineIndex].match(numericRegex);
    if (inlineMatch) return {fieldName: field.name, value: inlineMatch[0], unit: field.unit};

    const nextMatch = (lines[matchLineIndex + 1] ?? '').match(numericRegex);
    if (nextMatch) return {fieldName: field.name, value: nextMatch[0], unit: field.unit};

    return {fieldName: field.name, value: '', unit: field.unit};
  });
}
