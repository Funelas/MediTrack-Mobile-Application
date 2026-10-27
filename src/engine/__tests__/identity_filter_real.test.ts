// Identity filter on the real ML Kit dumps (MOB-03 takeover, step 5; rows RD1-RD3; decision D23). sanitize() of each dump in
// ml/tests/fixtures/mlkit/capture/ must give exactly the payload stored in real_pages.json (RD1 native confidence, RD2 every
// confidence null), and the dumps with no payload must give payload null and the stored reason (RD3). The comparison is
// exact (no tolerance; key order ignored). Dumps and expected values hold sanitized real report text, so this test reports
// only counts: no text, box, name or value is printed, logged or put in an assertion message, and the file holds no fixture
// text. The suite is skipped when the dumps folder or real_pages.json is absent. Which dump and which payload id are read
// from payload_sources and no_payload of the file, not typed here.
import * as fs from 'fs';
import * as path from 'path';
import { sanitize } from '../parsing/identityFilter';
import { compare, Json, readJsonNormalized, VECTORS_DIR } from './helpers/vectors';

interface PayloadSource {
  dump: string;
  confidence: string;
}

interface RealPagesFile {
  payloads: { [key: string]: Json };
  payload_sources: { [key: string]: PayloadSource };
  no_payload: { [key: string]: string };
}

interface DumpElement {
  confidence: number | null;
}

interface DumpPage {
  elements: DumpElement[];
}

const FIXTURE = path.resolve(VECTORS_DIR, '..', '..', 'ml', 'tests', 'fixtures', 'mlkit', 'engine_vectors', 'real_pages.json');
const CAPTURE_DIR = path.resolve(path.dirname(FIXTURE), '..', 'capture');

/** The pages of one dump, parsed fresh on each call so a test never shares or changes another test's input. */
function readPages(name: string): DumpPage[] {
  return (readJsonNormalized(path.join(CAPTURE_DIR, name)) as unknown as { pages: DumpPage[] }).pages;
}

/** The pages with every element confidence set to null (the "null" variant of a payload). */
function withNullConfidence(pages: DumpPage[]): DumpPage[] {
  for (const page of pages) {
    for (const element of page.elements) {
      element.confidence = null;
    }
  }
  return pages;
}

const present = fs.existsSync(CAPTURE_DIR) && fs.existsSync(FIXTURE);
const describeReal = present ? describe : describe.skip;

describeReal('identity filter on the real dumps', () => {
  const file = (present ? readJsonNormalized(FIXTURE) : { payloads: {}, payload_sources: {}, no_payload: {} }) as unknown as RealPagesFile;

  /** Ids of the stored payloads whose confidence kind is the given one. */
  function idsOf(kind: string): string[] {
    return Object.keys(file.payload_sources).filter((id) => file.payload_sources[id].confidence === kind).sort();
  }

  /** Ids whose sanitize() payload differs from the stored one in at least one place, or is missing. */
  function differingIds(ids: string[]): string[] {
    return ids.filter((id) => {
      const source = file.payload_sources[id];
      const pages = source.confidence === 'null' ? withNullConfidence(readPages(source.dump)) : readPages(source.dump);
      const result = sanitize(pages);
      if (result.payload === null) {
        return true;
      }
      return compare(file.payloads[id], result.payload as unknown as Json).length > 0;
    });
  }

  it('RD1: the native-confidence payloads equal the stored ones (5 of 5)', () => {
    const ids = idsOf('native');
    const differing = differingIds(ids);
    expect({ payloads: ids.length, differing: differing.length }).toEqual({ payloads: 5, differing: 0 });
  });

  it('RD2: the null-confidence payloads equal the stored ones (5 of 5)', () => {
    const ids = idsOf('null');
    const differing = differingIds(ids);
    expect({ payloads: ids.length, differing: differing.length }).toEqual({ payloads: 5, differing: 0 });
  });

  it('RD3: the dumps with no payload give payload null and the stored reason (2 of 2)', () => {
    const names = Object.keys(file.no_payload).sort();
    const wrong = names.filter((name) => {
      const result = sanitize(readPages(name));
      return result.payload !== null || result.reason !== file.no_payload[name] || result.doc_types.length === 0;
    });
    expect({ dumps: names.length, wrong: wrong.length }).toEqual({ dumps: 2, wrong: 0 });
  });

  it('reports 10 of 10 payloads equal and 2 of 2 reasons equal', () => {
    const ids = Object.keys(file.payload_sources);
    const equal = ids.length - differingIds(ids).length;
    const names = Object.keys(file.no_payload);
    const reasonsEqual = names.filter((name) => {
      const result = sanitize(readPages(name));
      return result.payload === null && result.reason === file.no_payload[name];
    }).length;
    expect({ payloads: ids.length, payloadsEqual: equal, reasons: names.length, reasonsEqual }).toEqual({
      payloads: 10,
      payloadsEqual: 10,
      reasons: 2,
      reasonsEqual: 2,
    });
  });
});
