// Page classification, routing and label finding (ML-27/ML-28, S9): every case of docs/engine_vectors/classify.json must
// be reproduced exactly (decision D4), and shared.ts must export the whole shared surface. Only counts and case ids are
// ever reported, never case text. Expected values are read from the vector file, not typed here.
import * as shared from '../shared';
import { cleanText, classify, detectSection, isHeaderRow, isResultRow, reportTypeOf } from '../parsing/classify';
import { findIdentityLabels, labelRegex } from '../parsing/identityLabels';
import { isSupported, markSupported, RecordWithResults, ResultRow } from '../parsing/router';
import { Row } from '../parsing/layout';
import { compareWithHeader, describeVectors, Json } from './helpers/vectors';

type Handler = (input: { [key: string]: Json }) => Json;

function str(value: Json | undefined): string {
  if (typeof value !== 'string') {
    throw new Error('expected a string input');
  }
  return value;
}

function strOrNull(value: Json | undefined): string | null {
  return value === null || value === undefined ? null : str(value);
}

/** A Row rebuilt from its stored form {cells: [{text}]}; the functions read only the text of a cell. */
function rowOf(value: Json | undefined): Row {
  const cells = (value as { cells: Array<{ text: string }> }).cells;
  return { cells: cells.map((c) => ({ text: str(c.text), box: [0, 0, 0, 0], conf: null, n_words: 1 })) };
}

function rowsOf(value: Json | undefined): Row[] {
  return (value as Json[]).map((r) => rowOf(r));
}

function strings(value: Json | undefined): string[] {
  return (value as Json[]).map((s) => str(s));
}

const HANDLERS: { [fn: string]: Handler } = {
  'parsing.classify._clean': (input) => cleanText(str(input.text)),
  'parsing.classify.is_header_row': (input) => isHeaderRow(rowOf(input.row)),
  'parsing.classify.is_result_row': (input) => isResultRow(rowOf(input.row), strOrNull(input.section)),
  'parsing.classify.detect_section': (input) => detectSection(str(input.text)),
  'parsing.classify.report_type_of': (input) => reportTypeOf(rowsOf(input.rows)),
  'parsing.classify.classify': (input) => classify(rowsOf(input.rows)),
  'parsing.router.is_supported': (input) => isSupported(input.result as unknown as ResultRow),
  'parsing.router.mark_supported': (input) => {
    const copy = JSON.parse(JSON.stringify(input.record)) as RecordWithResults; // markSupported changes its argument
    return markSupported(copy) as unknown as Json;
  },
  'parsing.identity_filter.find_identity_labels': (input) => findIdentityLabels(str(input.text)),
  'parsing.identity_filter._label_re': (input) => labelRegex(strings(input.labels)).test(str(input.text)),
};

interface VectorCase {
  id: string;
  fn: string;
  input: { [key: string]: Json };
  expected: Json;
}

// The names of the shared surface listed in section 6.10 of the plan (types have no runtime value and are not listed).
const SHARED_NAMES = [
  'elementsFromPage',
  'deskew',
  'groupRows',
  'buildCells',
  'pageRows',
  'classifyCell',
  'resolve',
  'classify',
  'isHeaderRow',
  'isResultRow',
  'detectSection',
  'reportTypeOf',
  'labelRegex',
  'IDENTITY_RE',
  'SIGNATURE_RE',
  'findIdentityLabels',
  'pyRound',
  'pySlice',
  'pySplit',
  'pyStrip',
  'stableSort',
  'validatePayload',
];

describeVectors('classify', (file) => {
  const cases = file.cases as unknown as VectorCase[];

  /** True when the port reproduces the case exactly. */
  function passes(c: VectorCase): boolean {
    const handler = HANDLERS[c.fn];
    if (handler === undefined) {
      return false;
    }
    let actual: Json;
    try {
      actual = handler(c.input);
    } catch (error) {
      return false;
    }
    return compareWithHeader(file, c.expected, actual).length === 0;
  }

  it('has cases, unique ids, and a handler for every fn and none unused', () => {
    expect(cases.length).toBeGreaterThan(0);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    const unknown = Array.from(new Set(cases.map((c) => c.fn))).filter((fn) => HANDLERS[fn] === undefined);
    expect(unknown).toEqual([]);
    expect(Object.keys(HANDLERS).filter((fn) => !cases.some((c) => c.fn === fn))).toEqual([]);
  });

  const fns = Array.from(new Set(cases.map((c) => c.fn)));
  it.each(fns)('reproduces every case of %s', (fn) => {
    const mine = cases.filter((c) => c.fn === fn);
    const failed = mine.filter((c) => !passes(c)).map((c) => c.id);
    expect(failed).toEqual([]);
    expect(mine.length).toBeGreaterThan(0);
  });

  describe('Unicode letters that Python re.I matches against ASCII', () => {
    it.each(['unicode_kelvin', 'unicode_long_s', 'unicode_dotted_i', 'unicode_dotless_i'])(
      'the cases with id prefix %s exist and pass',
      (prefix) => {
        const mine = cases.filter((c) => c.id.startsWith(prefix));
        expect(mine.length).toBeGreaterThan(0);
        expect(mine.filter((c) => !passes(c)).map((c) => c.id)).toEqual([]);
      },
    );
  });
});

describe('shared surface', () => {
  it('exports every name of the shared list', () => {
    const missing = SHARED_NAMES.filter((name) => (shared as { [key: string]: unknown })[name] === undefined);
    expect(missing).toEqual([]);
  });
});
