// buildHistory (MOB-03 step 6): rows H1 to H11 and T1 of the plan's verification table. The expected values of H1 to H11 are
// the plan's; T1 reads its history and its Contract B from docs/engine_vectors/endtoend.json (case row_H3), not from this
// file, and is skipped when the vector files are absent. The unit of every kept row is read from the dictionary.
import { dictionary } from '../../engine/data';
import { compareWithHeader, Json, loadVectorFile, VectorFile } from '../../engine/__tests__/helpers/vectors';
import { buildHistory, HistoryRow } from '../history';
import { readPayload, scoreRows } from '../runEngine';

const CURRENT = '2026-07-08';
const T1_TIME = 1000;
const T2_TIME = 2000;

interface EndCase {
  id: string;
  input: { parse_case: string; history: unknown };
  expected: { contract_b: Json };
}

interface ParseCase {
  id: string;
  input: { payload: string; visit_id: string; sex: string | null };
}

/** A saved row in the standard unit of its code (read from the dictionary), unless the unit is given. */
function row(code: string | null, valueStd: number | null, checkupDay: string, extra: Partial<HistoryRow> = {}): HistoryRow {
  const standard = code === null || !(code in dictionary.analytes) ? null : dictionary.analytes[code].standard_unit;
  return {
    canonicalCode: code,
    resultType: 'numeric',
    valueStd,
    unit: standard,
    checkupDay,
    createdAt: T1_TIME,
    position: 0,
    ...extra,
  };
}

const H1_ROWS: HistoryRow[] = [row('glucose_fasting', null, '2026-01-10'), row('glucose_fasting', 126.0, '2026-04-10')];
const H1_EXPECTED = { glucose_fasting: [null, 126.0] };

describe('buildHistory', () => {
  it('H1: keeps an unreadable row as a null gap, oldest first', () => {
    expect(buildHistory(H1_ROWS, CURRENT)).toEqual(H1_EXPECTED);
  });

  it('H1: gives the same history whatever the order of the input', () => {
    expect(buildHistory([...H1_ROWS].reverse(), CURRENT)).toEqual(H1_EXPECTED);
  });

  it('H2: leaves out a row of the same day as the current visit', () => {
    expect(buildHistory([...H1_ROWS, row('glucose_fasting', 130.0, CURRENT)], CURRENT)).toEqual(H1_EXPECTED);
  });

  it('H3: leaves out a row of a later day', () => {
    expect(buildHistory([...H1_ROWS, row('glucose_fasting', 140.0, '2026-08-01')], CURRENT)).toEqual(H1_EXPECTED);
  });

  it('H4: leaves out a legacy row with no canonical code', () => {
    expect(buildHistory([...H1_ROWS, row(null, 100.0, '2026-02-01')], CURRENT)).toEqual(H1_EXPECTED);
  });

  it('H5: leaves out an unmapped row', () => {
    expect(buildHistory([...H1_ROWS, row('unknown_unmapped', 5.0, '2026-02-01')], CURRENT)).toEqual(H1_EXPECTED);
  });

  it('H5b: leaves out a code that the dictionary does not hold', () => {
    const rows = [row('not_in_dictionary', 5.0, '2026-02-01', { unit: 'x' })];
    expect(buildHistory([...H1_ROWS, ...rows], CURRENT)).toEqual(H1_EXPECTED);
  });

  it('H6: leaves out a qualitative result', () => {
    const rows = [row('urine_protein', null, '2026-02-01', { resultType: 'qualitative' })];
    const out = buildHistory(rows, CURRENT);
    expect(out).toEqual({});
    expect('urine_protein' in out).toBe(false);
  });

  it('H6b: leaves out a descriptive result and a result with no type', () => {
    const rows = [
      row('ldl', 150.0, '2026-02-01', { resultType: 'descriptive' }),
      row('ldl', 151.0, '2026-02-02', { resultType: null }),
    ];
    expect(buildHistory(rows, CURRENT)).toEqual({});
  });

  it('H7: counts a code that repeats within one report once, at its first position', () => {
    const rows = [
      row('ldl', 160.0, '2026-02-01', { position: 3 }),
      row('ldl', 150.0, '2026-02-01', { position: 0 }),
    ];
    expect(buildHistory(rows, CURRENT)).toEqual({ ldl: [150.0] });
  });

  it('H8: counts an indeterminate row, because history holds values and not severities', () => {
    expect(buildHistory([row('alt', 40.0, '2026-02-01')], CURRENT)).toEqual({ alt: [40.0] });
  });

  it('H9: counts a range result', () => {
    const rows = [row('urine_rbc', 2.0, '2026-02-01', { resultType: 'range' })];
    expect(buildHistory(rows, CURRENT)).toEqual({ urine_rbc: [2.0] });
  });

  it('H10: orders two reports of one day by save time, whatever the order of the input', () => {
    const first = row('ldl', 150.0, '2026-02-01', { createdAt: T1_TIME });
    const second = row('ldl', 155.0, '2026-02-01', { createdAt: T2_TIME });
    expect(buildHistory([first, second], CURRENT)).toEqual({ ldl: [150.0, 155.0] });
    expect(buildHistory([second, first], CURRENT)).toEqual({ ldl: [150.0, 155.0] });
  });

  it('H11: leaves out a row saved in a unit that is not the dictionary standard unit (B3)', () => {
    expect(dictionary.analytes.egfr.standard_unit).not.toBe('mL/min');
    expect(buildHistory([row('egfr', 95.0, '2026-02-01', { unit: 'mL/min' })], CURRENT)).toEqual({});
  });

  it('H11: keeps the same row when its unit is the dictionary standard unit (positive control)', () => {
    const unit = dictionary.analytes.egfr.standard_unit;
    expect(buildHistory([row('egfr', 95.0, '2026-02-01', { unit })], CURRENT)).toEqual({ egfr: [95.0] });
  });

  it('leaves out a row with a value and no unit, and keeps a null-valued row whatever its unit', () => {
    expect(buildHistory([row('ldl', 150.0, '2026-02-01', { unit: null })], CURRENT)).toEqual({});
    expect(buildHistory([row('ldl', null, '2026-02-01', { unit: 'other' })], CURRENT)).toEqual({ ldl: [null] });
  });

  it('keeps separate codes in separate lists and does not change its input', () => {
    const rows = [row('ldl', 150.0, '2026-02-01'), row('alt', 40.0, '2026-02-01', { position: 1 })];
    const before = JSON.stringify(rows);
    expect(buildHistory(rows, CURRENT)).toEqual({ ldl: [150.0], alt: [40.0] });
    expect(JSON.stringify(rows)).toBe(before);
  });
});

describe('T1: row_H3 through buildHistory, readPayload and scoreRows', () => {
  const endtoend = loadVectorFile('endtoend');
  const parseFile = loadVectorFile('parse');
  const present = endtoend !== null && parseFile !== null;
  const it_ = present ? it : it.skip;

  it_('scores to the vector Contract B, with the glucose trend of the plan', () => {
    const file = endtoend as VectorFile;
    const parse = parseFile as VectorFile;
    const c = (file.cases as unknown as EndCase[]).find((x) => x.id.startsWith('row_H3')) as EndCase;
    expect(c).toBeDefined();
    const source = (parse.cases as unknown as ParseCase[]).find((p) => p.id === c.input.parse_case) as ParseCase;
    expect(source).toBeDefined();
    const payloads = (parse as unknown as { payloads: { [key: string]: Json } }).payloads;
    const read = readPayload(payloads[source.input.payload], {
      visitId: source.input.visit_id,
      visitDate: CURRENT,
      sex: source.input.sex,
    });
    expect(read.kind).toBe('read');
    if (read.kind !== 'read') {
      return;
    }
    const history = buildHistory(H1_ROWS, CURRENT);
    expect(history).toEqual(c.input.history);
    const out = scoreRows(read.record.results, CURRENT, history);
    expect(out.kind).toBe('scored');
    if (out.kind !== 'scored') {
      return;
    }
    expect(compareWithHeader(file, c.expected.contract_b, out.contractB as unknown as Json)).toEqual([]);
    const glucose = out.contractB.parameters.find((p) => p.canonical_code === 'glucose_fasting');
    expect(glucose).toBeDefined();
    const trend = (glucose as { trend: { pct_change: number; direction: string; clinical_trajectory: string } }).trend;
    expect(trend.pct_change).toBe(-14.29);
    expect(trend.direction).toBe('declining');
    expect(trend.clinical_trajectory).toBe('improving');
  });
});
