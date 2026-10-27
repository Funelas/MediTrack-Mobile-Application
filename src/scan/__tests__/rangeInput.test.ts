// parseBound and checkRangeInput (MOB-03 step 8, rows PB1-PB2 and RC1-RC4). The expected values are the plan's.
import { checkRangeInput, parseBound, RANGE_MESSAGES } from '../rangeInput';

describe('parseBound', () => {
  it('PB1: blank is empty, and plain numbers are read with surrounding spaces trimmed', () => {
    expect(parseBound('')).toEqual({ kind: 'empty' });
    expect(parseBound('4.5')).toEqual({ kind: 'number', value: 4.5 });
    expect(parseBound(' 4.5 ')).toEqual({ kind: 'number', value: 4.5 });
    expect(parseBound('0')).toEqual({ kind: 'number', value: 0 });
  });

  it('PB2: a comma, a sign, a leading dot or letters are invalid', () => {
    ['4,5', '-1', '.5', 'abc'].forEach((text) => {
      expect(parseBound(text)).toEqual({ kind: 'invalid' });
    });
  });
});

describe('checkRangeInput', () => {
  it('RC1: no bound and no "No range is printed" answer needs a bound', () => {
    expect(checkRangeInput(null, null, false)).toEqual({ ok: false, reason: 'need_a_bound' });
  });

  it('RC2: "No range is printed" is accepted with no bounds', () => {
    expect(checkRangeInput(null, null, true)).toEqual({ ok: true, low: null, high: null });
  });

  it('RC3: a low that is equal to or above the high is refused', () => {
    expect(checkRangeInput(5, 5, false)).toEqual({ ok: false, reason: 'low_not_below_high' });
    expect(checkRangeInput(5, 4, false)).toEqual({ ok: false, reason: 'low_not_below_high' });
  });

  it('RC4: a low below the high, and a single bound, are accepted', () => {
    expect(checkRangeInput(4.9, 5, false)).toEqual({ ok: true, low: 4.9, high: 5 });
    expect(checkRangeInput(5, null, false)).toEqual({ ok: true, low: 5, high: null });
  });
});

describe('RANGE_MESSAGES', () => {
  it('holds the three fixed texts', () => {
    expect(RANGE_MESSAGES.need_a_bound).toBe("Type at least one limit, or choose 'No range is printed'.");
    expect(RANGE_MESSAGES.low_not_below_high).toBe('The lowest value must be below the highest.');
    expect(RANGE_MESSAGES.engine_rejected).toBe('Check the number and unit, as printed on the report.');
  });
});
