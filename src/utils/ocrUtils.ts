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
 * Parses raw OCR text against a list of known fields.
 * For each field, scans lines for a match then grabs the first numeric
 * value on the same line or the next line.
 */
export function parseOCRText(
  rawText: string,
  fields: {name: string; unit?: string}[],
): ParsedEntry[] {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const numericRegex = /\d+(\.\d+)?/;

  return fields.map(field => {
    const fieldLower = field.name.toLowerCase().replace(/[^a-z0-9]/g, '');

    let matchLineIndex = -1;
    let bestScore = 0;

    lines.forEach((line, i) => {
      const lineLower = line.toLowerCase().replace(/[^a-z0-9]/g, '');
      const score = fieldLower.split('').filter(c => lineLower.includes(c)).length;
      const ratio = score / fieldLower.length;
      if (ratio > 0.75 && score > bestScore) {
        bestScore = score;
        matchLineIndex = i;
      }
    });

    if (matchLineIndex === -1) return {fieldName: field.name, value: '', unit: field.unit};

    // Try same line first
    const inlineMatch = lines[matchLineIndex].match(numericRegex);
    if (inlineMatch) return {fieldName: field.name, value: inlineMatch[0], unit: field.unit};

    // Then next line
    const nextMatch = (lines[matchLineIndex + 1] ?? '').match(numericRegex);
    if (nextMatch) return {fieldName: field.name, value: nextMatch[0], unit: field.unit};

    return {fieldName: field.name, value: '', unit: field.unit};
  });
}
