// Display helpers (MOB-03 step 7): rows M1 to M10, F1 to F9 and R1 to R4 of the plan's verification table. The expected
// values are the plan's. Units in the F rows are made-up strings: only whether a unit is shown or hidden is checked.
import { REVIEW_REASON_CODES } from '../../engine';
import { unitConversions } from '../../engine/data';
import {
  asPrinted,
  formatRange,
  NO_VALUE,
  PrintedRow,
  reasonText,
  statusFor,
  unknownLabel,
} from '../display';

const UNIT = 'unit-x';
const FORBIDDEN = /diagnosis|mild|significant/i;

function printed(code: string, value: number | null, extra: Partial<PrintedRow> = {}): PrintedRow {
  return { canonical_code: code, value, unit: UNIT, reported_value: null, reported_unit: null, ...extra };
}

describe('statusFor and unknownLabel', () => {
  it('M1: normal with no direction is normal', () => {
    expect(statusFor('normal', null)).toBe('normal');
  });

  it('M2: normal with direction high is normal', () => {
    expect(statusFor('normal', 'high')).toBe('normal');
  });

  it('normal with direction low is normal', () => {
    expect(statusFor('normal', 'low')).toBe('normal');
  });

  it('M3: mild high is high', () => {
    expect(statusFor('mild', 'high')).toBe('high');
  });

  it('M4: significant high is high', () => {
    expect(statusFor('significant', 'high')).toBe('high');
  });

  it('M5: mild low is low', () => {
    expect(statusFor('mild', 'low')).toBe('low');
  });

  it('M6: significant low is low', () => {
    expect(statusFor('significant', 'low')).toBe('low');
  });

  it('M7: mild with no direction throws', () => {
    expect(() => statusFor('mild', null)).toThrow('invariant: abnormal severity without direction');
  });

  it('M8: significant with no direction throws', () => {
    expect(() => statusFor('significant', null)).toThrow('invariant: abnormal severity without direction');
  });

  it('M9: indeterminate is unknown, labelled "No range to compare"', () => {
    expect(statusFor('indeterminate', null)).toBe('unknown');
    expect(unknownLabel('indeterminate')).toBe('No range to compare');
  });

  it('M10: unreadable is unknown, labelled "Could not read"', () => {
    expect(statusFor('unreadable', null)).toBe('unknown');
    expect(unknownLabel('unreadable')).toBe('Could not read');
  });

  it('throws on a severity it does not know, never returning normal', () => {
    expect(() => statusFor('severe', 'high')).toThrow('invariant: unknown severity');
    expect(() => statusFor('', null)).toThrow('invariant: unknown severity');
  });

  it('gives no label for a severity that has a status', () => {
    expect(unknownLabel('normal')).toBe('');
    expect(unknownLabel('mild')).toBe('');
    expect(unknownLabel('significant')).toBe('');
  });
});

describe('reasonText', () => {
  it('has the plan wording for the three review reason codes', () => {
    expect(reasonText('low_confidence')).toBe(
      'Check this result against your report. If it is wrong, discard the scan and enter it manually.',
    );
    expect(reasonText('missing_value')).toBe('We could not read this result. It will be saved as not read.');
    expect(reasonText('missing_range')).toBe(
      'Your report shows no normal range for this test. If a range is printed next to this result, type it exactly as printed.',
    );
  });

  it('has non-empty text for every code the engine can return', () => {
    expect(REVIEW_REASON_CODES.length).toBeGreaterThan(0);
    REVIEW_REASON_CODES.forEach((code) => {
      expect(reasonText(code)).not.toBe('');
    });
  });

  it('returns an empty string for any other code', () => {
    expect(reasonText('something_else')).toBe('');
    expect(reasonText('')).toBe('');
  });

  it('never shows the words diagnosis, mild or significant', () => {
    const texts = [
      ...REVIEW_REASON_CODES.map((code) => reasonText(code)),
      ...['normal', 'mild', 'significant', 'indeterminate', 'unreadable'].map((s) => unknownLabel(s)),
    ];
    texts.forEach((text) => {
      expect(FORBIDDEN.test(text)).toBe(false);
    });
  });
});

describe('formatRange', () => {
  it('R1: both limits', () => {
    expect(formatRange(3.5, 5.0)).toBe('3.5 - 5');
  });

  it('R2: low limit only', () => {
    expect(formatRange(3.5, null)).toBe('low limit 3.5');
  });

  it('R3: high limit only', () => {
    expect(formatRange(null, 5.0)).toBe('high limit 5');
  });

  it('R4: no limit', () => {
    expect(formatRange(null, null)).toBe('');
  });
});

describe('asPrinted', () => {
  const fractionCodes = unitConversions.fraction_to_percent.canonical_codes;

  it('reads the fraction list from the unit conversion data', () => {
    expect(fractionCodes).toHaveLength(7);
    ['basophils', 'hematocrit', 'neutrophils'].forEach((code) => {
      expect(fractionCodes).toContain(code);
    });
    expect(fractionCodes).not.toContain('hemoglobin');
  });

  it('F1: a fraction code with value 0.5 hides the unit and asks for the printed range', () => {
    expect(asPrinted(printed('basophils', 0.5))).toEqual({ value: '0.5', unit: null, hint: true });
  });

  it('F2: a fraction code with value 1.0 hides the unit', () => {
    expect(asPrinted(printed('basophils', 1.0))).toEqual({ value: '1', unit: null, hint: true });
  });

  it('F3: a fraction code with value 1.01 shows the unit, no hint', () => {
    expect(asPrinted(printed('basophils', 1.01))).toEqual({ value: '1.01', unit: UNIT, hint: false });
  });

  it('F4: the next double above 1 shows the unit', () => {
    const above = 1.0000000000000002;
    expect(above).toBeGreaterThan(1);
    expect(asPrinted(printed('basophils', above))).toEqual({ value: String(above), unit: UNIT, hint: false });
  });

  it('F5: a code that is not a fraction code shows the unit', () => {
    expect(asPrinted(printed('hemoglobin', 0.5))).toEqual({ value: '0.5', unit: UNIT, hint: false });
  });

  it('F6: hematocrit with value 0.42 hides the unit', () => {
    expect(asPrinted(printed('hematocrit', 0.42))).toEqual({ value: '0.42', unit: null, hint: true });
  });

  it('F7: a reported value is shown as printed, even for a fraction code', () => {
    expect(asPrinted(printed('basophils', 50, { reported_value: 0.5, reported_unit: null }))).toEqual({
      value: '0.5',
      unit: null,
      hint: false,
    });
    expect(asPrinted(printed('basophils', 50, { reported_value: 0.5, reported_unit: 'rep-unit' }))).toEqual({
      value: '0.5',
      unit: 'rep-unit',
      hint: false,
    });
  });

  it('F8: no value at all shows the placeholder and the unit', () => {
    expect(NO_VALUE).toBe('—');
    expect(asPrinted(printed('neutrophils', null))).toEqual({ value: NO_VALUE, unit: UNIT, hint: false });
  });

  it('F9: a negative value on a fraction code shows the unit', () => {
    expect(asPrinted(printed('basophils', -0.1))).toEqual({ value: '-0.1', unit: UNIT, hint: false });
  });

  it('shows no unit for a test that has none (null or empty)', () => {
    expect(asPrinted(printed('glucose_fasting', 90, { unit: null }))).toEqual({ value: '90', unit: null, hint: false });
    expect(asPrinted(printed('glucose_fasting', 90, { unit: '' }))).toEqual({ value: '90', unit: null, hint: false });
  });

  it('does not change the row', () => {
    const row = printed('basophils', 0.5);
    const copy = JSON.parse(JSON.stringify(row));
    asPrinted(row);
    expect(row).toEqual(copy);
  });
});
