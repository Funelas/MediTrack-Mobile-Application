// Display helpers (MOB-03 step 7): rows M1 to M10, F1 to F9 and R1 to R4 of the plan's verification table. The expected
// values are the plan's. Units in the F rows are made-up strings: only whether a unit is shown or hidden is checked.
import { buildContractB, ContractBParameter, REVIEW_REASON_CODES, ResultRow } from '../../engine';
import { unitConversions } from '../../engine/data';
import {
  asPrinted,
  basisLabel,
  flagLabel,
  formatRange,
  NO_VALUE,
  notRatedLabel,
  NotRatedInput,
  PrintedRow,
  rangeWithBasis,
  reasonText,
  safeStatus,
  sourceNote,
  statusFor,
} from '../display';

const UNIT = 'unit-x';
const FORBIDDEN = /diagnosis|mild|significant/i;
const EGFR_UNIT = 'mL/min/1.73m2';
const UNIT_TEXT = 'Not rated: the unit is not mL/min/1.73m2, the unit the cut-off uses.';
const BELOW_ZERO = 'Not rated: the value is below zero.';
const NO_RANGE_USER = 'You answered that no range is printed. The result itself is as read from your report.';
const TYPED_RANGE = 'You typed this range from your report. The result itself is as read from your report.';

/** A saved result with no range found: indeterminate on a lab range, from the scan, unless a field is given. */
function notRated(extra: Partial<NotRatedInput> = {}): string {
  return notRatedLabel({
    severity: 'indeterminate',
    rangeBasis: 'lab_range',
    valueStd: 38,
    refLow: null,
    refHigh: null,
    valueSource: 'ocr',
    canonicalCode: 'alt',
    ...extra,
  });
}

/** The one Contract B parameter the engine gives for a single supported row (empty history, no weights). */
function engineParameter(code: string, value: number, unit: string, extra: Partial<ResultRow> = {}): ContractBParameter {
  const row: ResultRow = { test_name: code, canonical_code: code, value, unit, supported: true, ...extra };
  const contractB = buildContractB('2026-07-08', [row], {});
  expect(contractB.parameters).toHaveLength(1);
  return contractB.parameters[0];
}

/** The not-rated text for an engine parameter, as the screen would build it (no range on the row). */
function labelOf(p: ContractBParameter, valueStd: number | null): string {
  return notRatedLabel({
    severity: p.severity,
    rangeBasis: p.range_basis,
    valueStd,
    refLow: null,
    refHigh: null,
    valueSource: 'ocr',
    canonicalCode: p.canonical_code,
  });
}

function printed(code: string, value: number | null, extra: Partial<PrintedRow> = {}): PrintedRow {
  return { canonical_code: code, value, unit: UNIT, reported_value: null, reported_unit: null, ...extra };
}

describe('statusFor and notRatedLabel', () => {
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
    expect(notRated({ severity: 'indeterminate' })).toBe('No range to compare');
  });

  it('M10: unreadable is unknown, labelled "Could not read"', () => {
    expect(statusFor('unreadable', null)).toBe('unknown');
    expect(notRated({ severity: 'unreadable' })).toBe('Could not read');
  });

  it('throws on a severity it does not know, never returning normal', () => {
    expect(() => statusFor('severe', 'high')).toThrow('invariant: unknown severity');
    expect(() => statusFor('', null)).toThrow('invariant: unknown severity');
  });

  it('gives no label for a severity that has a status', () => {
    expect(notRated({ severity: 'normal' })).toBe('');
    expect(notRated({ severity: 'mild' })).toBe('');
    expect(notRated({ severity: 'significant' })).toBe('');
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
    const severities = ['normal', 'mild', 'significant', 'indeterminate', 'unreadable'];
    const bases = ['guideline', 'project_defined', 'lab_range', 'dictionary_default', 'expected_value', 'other', null];
    const notRatedTexts = severities.flatMap((severity) =>
      bases.flatMap((rangeBasis) =>
        [38, -1, null].flatMap((valueStd) =>
          [null, 'alt', 'egfr'].flatMap((canonicalCode) =>
            [
              [null, null],
              [0, null],
              [5, 5],
            ].flatMap(([refLow, refHigh]) =>
              ['ocr', 'user'].map((valueSource) =>
                notRatedLabel({ severity, rangeBasis, valueStd, refLow, refHigh, valueSource, canonicalCode }),
              ),
            ),
          ),
        ),
      ),
    );
    const texts = [
      ...REVIEW_REASON_CODES.map((code) => reasonText(code)),
      ...notRatedTexts,
      ...bases.map((b) => basisLabel(b)),
      ...['H', 'L', 'HH', 'LL', 'X', null].map((f) => flagLabel(f)),
      ...bases.flatMap((b) =>
        [null, 'mmol/L'].flatMap((c) => [rangeWithBasis(1, 2, b, c), rangeWithBasis(null, null, b, c)]),
      ),
      ...['user', 'ocr', null].flatMap((v) => [null, 'printed', 'default'].map((r) => sourceNote(v, r))),
    ];
    expect(texts.length).toBeGreaterThan(100);
    texts.forEach((text) => {
      expect(FORBIDDEN.test(text)).toBe(false);
    });
  });
});

describe('safeStatus', () => {
  it('SS1: gives the status for a record that can be shown', () => {
    expect(safeStatus('mild', 'high')).toEqual({ ok: true, status: 'high' });
    expect(safeStatus('normal', null)).toEqual({ ok: true, status: 'normal' });
  });

  it('SS2: gives ok false for a broken record, never throwing', () => {
    expect(safeStatus('mild', null)).toEqual({ ok: false });
    expect(safeStatus('bogus', null)).toEqual({ ok: false });
  });
});

describe('basisLabel and flagLabel', () => {
  it('L1: words for the five bases, empty for any other', () => {
    expect(basisLabel('guideline')).toBe('guideline cut-off');
    expect(basisLabel('project_defined')).toBe("the app's own cut-off");
    expect(basisLabel('lab_range')).toBe('printed range');
    expect(basisLabel('dictionary_default')).toBe('general reference range');
    expect(basisLabel('expected_value')).toBe('expected result');
    expect(basisLabel('other')).toBe('');
    expect(basisLabel(null)).toBe('');
  });

  it('FL1: the lab flag as a sentence, empty for no flag', () => {
    expect(flagLabel('H')).toBe('marked H on your report');
    expect(flagLabel('LL')).toBe('marked LL on your report');
    expect(flagLabel(null)).toBe('');
  });

  it('gives no sentence for a flag that is not H, L, HH or LL', () => {
    expect(flagLabel('')).toBe('');
    expect(flagLabel('N')).toBe('');
    expect(flagLabel('h')).toBe('');
  });
});

describe('rangeWithBasis', () => {
  it('RB1: guideline with a low limit', () => {
    expect(rangeWithBasis(50, null, 'guideline', null)).toBe('low limit 50 (printed range); status by guideline cut-off');
  });

  it('RB2: lab range', () => {
    expect(rangeWithBasis(7, 56, 'lab_range', null)).toBe('7 - 56 (printed range)');
  });

  it('RB3: lab range with no limit is empty', () => {
    expect(rangeWithBasis(null, null, 'lab_range', null)).toBe('');
  });

  it('RB4: project-defined cut-off', () => {
    expect(rangeWithBasis(0.6, 1.3, 'project_defined', null)).toBe(
      "0.6 - 1.3 (printed range); status by the app's own cut-off",
    );
  });

  it('RB5: guideline with no limit', () => {
    expect(rangeWithBasis(null, null, 'guideline', null)).toBe('status by guideline cut-off');
  });

  it('RB6: expected value with no limit is empty', () => {
    expect(rangeWithBasis(null, null, 'expected_value', null)).toBe('');
  });

  it('RB7: general reference range, a printed 5.0 shows as 5', () => {
    expect(rangeWithBasis(3.5, 5.0, 'dictionary_default', null)).toBe('3.5 - 5 (general reference range)');
  });

  it('RB8: a limit of 0 is a limit', () => {
    expect(formatRange(null, 0)).toBe('high limit 0');
    expect(rangeWithBasis(0, null, 'lab_range', null)).toBe('low limit 0 (printed range)');
  });

  it('RB9: guideline with converted limits', () => {
    expect(rangeWithBasis(3.9, 5.5, 'guideline', 'mmol/L')).toBe(
      '3.9 - 5.5 (printed range, converted to mmol/L); status by guideline cut-off',
    );
  });

  it('RB10: lab range with converted limits', () => {
    expect(rangeWithBasis(7, 56, 'lab_range', 'U/L')).toBe('7 - 56 (printed range, converted to U/L)');
  });

  it('shows only the range for any other basis', () => {
    expect(rangeWithBasis(1, 2, 'expected_value', null)).toBe('1 - 2');
    expect(rangeWithBasis(1, 2, null, 'U/L')).toBe('1 - 2');
  });
});

describe('notRatedLabel', () => {
  it('N1: unreadable', () => {
    expect(notRated({ severity: 'unreadable' })).toBe('Could not read');
  });

  it('N2: normal gives no text', () => {
    expect(notRated({ severity: 'normal' })).toBe('');
  });

  it('N3: a unit mismatch on a guideline row names the unit the cut-off uses', () => {
    expect(
      notRated({
        rangeBasis: 'guideline',
        canonicalCode: 'egfr',
        valueStd: 95,
        refLow: 60,
        refHigh: null,
        valueSource: 'ocr',
      }),
    ).toBe(UNIT_TEXT);
  });

  it('N4: a negative value', () => {
    expect(
      notRated({ rangeBasis: 'guideline', canonicalCode: 'glucose_fasting', valueStd: -1, refLow: 70, refHigh: 100 }),
    ).toBe(BELOW_ZERO);
  });

  it('N5: a qualitative result word the app does not know', () => {
    expect(notRated({ rangeBasis: 'expected_value', canonicalCode: 'urine_protein', valueStd: null })).toBe(
      'Not rated: the app does not know this result word.',
    );
  });

  it('N6: the user answered that no range is printed', () => {
    expect(notRated({ valueSource: 'user' })).toBe('Not rated: your report printed no normal range.');
  });

  it('N7: no range found on the scan', () => {
    expect(notRated({ valueSource: 'ocr' })).toBe('No range to compare');
  });

  it('N8: a printed range that could not be used', () => {
    expect(notRated({ refLow: 5, refHigh: 5 })).toBe('Not rated: the printed range could not be used.');
  });

  it('N8b: a high limit of 0 is a limit', () => {
    expect(notRated({ refLow: null, refHigh: 0 })).toBe('Not rated: the printed range could not be used.');
  });

  it('N9: a negative value comes before a range that is there', () => {
    expect(notRated({ valueStd: -0.5, refLow: 1, refHigh: 2 })).toBe(BELOW_ZERO);
  });

  it('N10: a general reference range gives the plain text', () => {
    expect(notRated({ rangeBasis: 'dictionary_default' })).toBe('Not rated.');
  });

  it('N11: a negative value comes before the unit text', () => {
    expect(notRated({ rangeBasis: 'guideline', canonicalCode: 'egfr', valueStd: -1 })).toBe(BELOW_ZERO);
  });

  it('N12: a low limit of 0 is a limit, not "No range to compare"', () => {
    expect(notRated({ refLow: 0, refHigh: null })).toBe('Not rated: the printed range could not be used.');
  });

  it('gives the plain text when the code or its standard unit is missing, and for an unknown basis', () => {
    expect(notRated({ rangeBasis: 'guideline', canonicalCode: null })).toBe('Not rated.');
    expect(notRated({ rangeBasis: 'project_defined', canonicalCode: 'no_such_code' })).toBe('Not rated.');
    expect(notRated({ rangeBasis: null })).toBe('Not rated.');
  });

  it('names the standard unit of a project-defined row from the dictionary', () => {
    expect(notRated({ rangeBasis: 'project_defined', canonicalCode: 'creatinine', valueStd: 1.2 })).toBe(
      'Not rated: the unit is not mg/dL, the unit the cut-off uses.',
    );
  });
});

describe('sourceNote', () => {
  it('SN1: says where a range came from when the user gave it', () => {
    expect(sourceNote('user', null)).toBe(NO_RANGE_USER);
    expect(sourceNote('user', 'printed')).toBe(TYPED_RANGE);
    expect(sourceNote('ocr', 'printed')).toBe('');
  });

  it('gives nothing for any other pair', () => {
    expect(sourceNote(null, null)).toBe('');
    expect(sourceNote('ocr', null)).toBe('');
    expect(sourceNote('user', 'default')).toBe('');
  });
});

describe('rows through buildContractB', () => {
  it('U2: egfr 95 in mL/min/1.73M2 is rated normal', () => {
    const p = engineParameter('egfr', 95, 'mL/min/1.73M2');
    expect(p.severity).toBe('normal');
    expect(labelOf(p, 95)).toBe('');
  });

  it('U3: egfr 95 with spaces and capitals around the unit is rated normal', () => {
    expect(engineParameter('egfr', 95, ' ML/MIN/1.73M2 ').severity).toBe('normal');
  });

  it('U4: egfr 95 with a unit the engine does not match is indeterminate, and the label says so', () => {
    ['mL/min/1.73 m2', 'mL/min/1.73m²'].forEach((unit) => {
      const p = engineParameter('egfr', 95, unit);
      expect(p.severity).toBe('indeterminate');
      expect(p.range_basis).toBe('guideline');
      expect(labelOf(p, 95)).toBe(UNIT_TEXT);
    });
  });

  it.each([
    [59.99, 'significant', 'low'],
    [60, 'mild', 'low'],
    [89.99, 'mild', 'low'],
    [90, 'normal', null],
  ])('ST1: egfr %p in mL/min/1.73m2 is %s %s', (value, severity, direction) => {
    const p = engineParameter('egfr', value, EGFR_UNIT);
    expect(p.severity).toBe(severity);
    expect(p.direction).toBe(direction);
  });

  it.each([
    [39.99, 'significant', 'low'],
    [40, 'normal', null],
  ])('ST2: hdl %p in mg/dL is %s %s', (value, severity, direction) => {
    const p = engineParameter('hdl', value, 'mg/dL');
    expect(p.severity).toBe(severity);
    expect(p.direction).toBe(direction);
  });

  it.each([
    [1.29, 'normal', null],
    [1.3, 'mild', 'high'],
    [2.0, 'significant', 'high'],
  ])('ST3: creatinine %p in mg/dL is %s %s, project-defined', (value, severity, direction) => {
    const p = engineParameter('creatinine', value, 'mg/dL');
    expect(p.severity).toBe(severity);
    expect(p.direction).toBe(direction);
    expect(p.range_basis).toBe('project_defined');
  });

  it('G1: hdl 45 with a printed low limit of 50 and the flag L is normal by the guideline cut-off', () => {
    const p = engineParameter('hdl', 45, 'mg/dL', { ref_low: 50, ref_high: null, ref_source: 'printed' });
    expect(p.severity).toBe('normal');
    expect(p.direction).toBeNull();
    expect(p.range_basis).toBe('guideline');
    expect(safeStatus(p.severity, p.direction)).toEqual({ ok: true, status: 'normal' });
    expect(rangeWithBasis(50, null, p.range_basis, null)).toBe(
      'low limit 50 (printed range); status by guideline cut-off',
    );
    expect(flagLabel('L')).toBe('marked L on your report');
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
