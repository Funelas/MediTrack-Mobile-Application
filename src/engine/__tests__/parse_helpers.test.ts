// Parser helpers (ML-27/ML-28, S11a): every case of docs/engine_vectors/parse_helpers.json must be reproduced exactly
// (decision D4), including the named rows row_F*, row_N* and row_B*. Only counts and case ids are ever reported, never
// case text. Expected values are read from the vector file, not typed here. Inputs are rebuilt from the stored JSON
// form described in the file's note: a typed cell is the pair [Cell, Typed], tuples are arrays.
import { Cell, Row } from '../parsing/layout';
import { entry as dictionaryEntry } from '../parsing/dictionary';
import { Typed } from '../parsing/extract';
import {
  blocks,
  convert,
  defaultInterval,
  DefaultIntervalEntry,
  firstValueGroup,
  inferUnit,
  PlausibleEntry,
  sexedRanges,
  splitStreams,
  typed,
  TypedCell,
  unitScore,
  within,
} from '../parsing/parserHelpers';
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

function numOrNull(value: Json | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'number') {
    throw new Error('expected a number or null');
  }
  return value;
}

/** A Cell rebuilt from its stored form {text, box, conf, n_words}. */
function cellOf(value: Json): Cell {
  const c = value as { [key: string]: Json };
  return {
    text: str(c.text),
    box: c.box as unknown as Cell['box'],
    conf: numOrNull(c.conf),
    n_words: c.n_words as number,
  };
}

function cellsOf(value: Json | undefined): Cell[] {
  return (value as Json[]).map((c) => cellOf(c));
}

/** A typed cell rebuilt from its stored pair [Cell, Typed]. */
function pairOf(value: Json): TypedCell {
  const p = value as Json[];
  return [cellOf(p[0]), { ...(p[1] as unknown as Typed) }];
}

function pairsOf(value: Json | undefined): TypedCell[] {
  return (value as Json[]).map((p) => pairOf(p));
}

function rowsOfPairs(value: Json | undefined): TypedCell[][] {
  return (value as Json[]).map((r) => pairsOf(r));
}

const HANDLERS: { [fn: string]: Handler } = {
  'parsing.parser._typed': (input) => typed(cellsOf(input.cells)) as unknown as Json,
  'parsing.parser._split_streams': (input) =>
    splitStreams(
      (input.rows as Json[]).map((r): Row => ({ cells: cellsOf((r as { [key: string]: Json }).cells) })),
      strOrNull(input.section),
    ) as unknown as Json,
  'parsing.parser._first_value_group': (input) => firstValueGroup(pairsOf(input.cells)) as unknown as Json,
  'parsing.parser._unit_score': (input) => unitScore(strOrNull(input.code), strOrNull(input.unit), numOrNull(input.value)),
  'parsing.parser._infer_unit': (input) =>
    inferUnit(
      str(input.code),
      dictionaryEntry(str(input.code)),
      numOrNull(input.value),
      numOrNull(input.ref_low),
      numOrNull(input.ref_high),
    ) as unknown as Json,
  'parsing.parser._convert': (input) =>
    convert(
      str(input.code),
      numOrNull(input.value),
      strOrNull(input.unit),
      numOrNull(input.ref_low),
      numOrNull(input.ref_high),
    ) as unknown as Json,
  'parsing.parser._within': (input) => within(input.entry as unknown as PlausibleEntry, numOrNull(input.value)),
  'parsing.parser._default_interval': (input) =>
    defaultInterval(input.entry as unknown as DefaultIntervalEntry, strOrNull(input.sex)) as unknown as Json,
  'parsing.parser._sexed_ranges': (input) => sexedRanges(rowsOfPairs(input.rows)) as unknown as Json,
  'parsing.parser._blocks': (input) =>
    blocks((input.stream as Json[]).map((row) => cellsOf(row)), strOrNull(input.section), []) as unknown as Json,
};

interface VectorCase {
  id: string;
  fn: string;
  input: { [key: string]: Json };
  expected: Json;
}

describeVectors('parse_helpers', (file) => {
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

  describe('the named rows of the vector completion plan', () => {
    it.each(['row_F', 'row_N', 'row_B'])('the cases with id prefix %s exist and pass', (prefix) => {
      const mine = cases.filter((c) => c.id.startsWith(prefix));
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.filter((c) => !passes(c)).map((c) => c.id)).toEqual([]);
    });
  });
});
