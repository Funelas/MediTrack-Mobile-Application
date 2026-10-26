// toRawPage (MOB-03 step 3). The synthetic cases use made-up neutral words. The round trip converts each ML Kit capture
// dump back to the wrapper's shape, runs it through toRawPage and counts the differences. The dumps hold OCR text, so
// this test reports counts only and never puts dump text, boxes or names in an assertion. It is skipped when the capture
// folder is absent.
import * as fs from 'fs';
import * as path from 'path';
import { ElementLike, MlKitResultLike, RawPage, toRawPage } from '../mlkitPages';

const CAPTURE_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'ml', 'tests', 'fixtures', 'mlkit', 'capture');
const SIZE = { width: 1000, height: 2000 };

function wrap(...lines: ElementLike[][]): MlKitResultLike {
  return { blocks: [{ lines: lines.map((elements) => ({ elements })) }] };
}

function word(text: string, left: number, top: number, width: number, height: number): ElementLike {
  return { text, frame: { left, top, width, height } };
}

function pageOf(result: MlKitResultLike, size = SIZE, pageIndex = 0): { page: RawPage; droppedNoFrame: number } {
  const out = toRawPage(result, size, pageIndex);
  if (out.kind !== 'page') {
    throw new Error('expected a page');
  }
  return out;
}

describe('toRawPage', () => {
  it('turns a frame into a box [left, top, left + width, top + height]', () => {
    const { page } = pageOf(wrap([word('alpha', 10, 20, 30, 40)]));
    expect(page.elements).toEqual([{ text: 'alpha', box: [10, 20, 40, 60], confidence: null }]);
  });

  it('takes the page size and index from the arguments', () => {
    const { page } = pageOf(wrap([word('alpha', 1, 2, 3, 4)]), { width: 640, height: 480 }, 3);
    expect([page.page_index, page.width, page.height]).toEqual([3, 640, 480]);
  });

  it('drops a word with no frame and counts it', () => {
    const { page, droppedNoFrame } = pageOf(wrap([word('alpha', 0, 0, 5, 5), { text: 'beta' }, word('gamma', 6, 0, 5, 5)]));
    expect(page.elements.map((e) => e.text)).toEqual(['alpha', 'gamma']);
    expect(droppedNoFrame).toBe(1);
  });

  it('keeps block, line and word order', () => {
    const result: MlKitResultLike = {
      blocks: [
        { lines: [{ elements: [word('a1', 0, 0, 1, 1), word('a2', 1, 0, 1, 1)] }, { elements: [word('a3', 0, 1, 1, 1)] }] },
        { lines: [{ elements: [word('b1', 0, 5, 1, 1)] }] },
      ],
    };
    const { page, droppedNoFrame } = pageOf(result);
    expect(page.elements.map((e) => e.text)).toEqual(['a1', 'a2', 'a3', 'b1']);
    expect(droppedNoFrame).toBe(0);
  });

  it('gives null confidence on every element', () => {
    const { page } = pageOf(wrap([word('alpha', 0, 0, 1, 1), word('beta', 1, 0, 1, 1)]));
    expect(page.elements.every((e) => e.confidence === null)).toBe(true);
  });

  it('keeps a word with empty text', () => {
    const { page } = pageOf(wrap([word('', 2, 2, 3, 3)]));
    expect(page.elements).toEqual([{ text: '', box: [2, 2, 5, 5], confidence: null }]);
  });

  it('gives an empty page for a result with no blocks', () => {
    const { page, droppedNoFrame } = pageOf({ blocks: [] });
    expect(page.elements).toEqual([]);
    expect(droppedNoFrame).toBe(0);
  });

  it.each([
    ['no size', {}],
    ['width missing', { height: 100 }],
    ['height missing', { width: 100 }],
    ['width 0', { width: 0, height: 100 }],
    ['height 0', { width: 100, height: 0 }],
    ['negative width', { width: -1, height: 100 }],
    ['NaN width', { width: NaN, height: 100 }],
    ['NaN height', { width: 100, height: NaN }],
    ['infinite width', { width: Infinity, height: 100 }],
  ])('gives no_image_size for %s', (_label, size) => {
    expect(toRawPage(wrap([word('alpha', 0, 0, 1, 1)]), size, 0)).toEqual({ kind: 'no_image_size' });
  });
});

interface DumpElement {
  text: string;
  box: [number, number, number, number];
  confidence: number | null;
}

interface DumpPage {
  page_index: number;
  width: number;
  height: number;
  elements: DumpElement[];
}

function dumpFiles(): string[] {
  return fs.existsSync(CAPTURE_DIR) ? fs.readdirSync(CAPTURE_DIR).filter((name) => name.endsWith('.json')).sort() : [];
}

/** The wrapper's shape for one dump page: one block, one line, one element per word. */
function asWrapperResult(page: DumpPage): MlKitResultLike {
  const elements = page.elements.map(({ text, box }) => word(text, box[0], box[1], box[2] - box[0], box[3] - box[1]));
  return { blocks: [{ lines: [{ elements }] }] };
}

/** Number of differences between one dump page and its round trip; texts and boxes are compared, never reported. */
function countDifferences(page: DumpPage): number {
  const out = toRawPage(asWrapperResult(page), { width: page.width, height: page.height }, page.page_index);
  if (out.kind !== 'page') {
    return 1;
  }
  let differences = out.droppedNoFrame;
  const back = out.page;
  if (back.page_index !== page.page_index || back.width !== page.width || back.height !== page.height) {
    differences += 1;
  }
  if (back.elements.length !== page.elements.length) {
    return differences + 1;
  }
  back.elements.forEach((element, i) => {
    const original = page.elements[i];
    const sameBox = element.box.length === 4 && element.box.every((value, k) => value === original.box[k]);
    if (element.text !== original.text || !sameBox || element.confidence !== null) {
      differences += 1;
    }
  });
  return differences;
}

const describeDumps = fs.existsSync(CAPTURE_DIR) ? describe : describe.skip;

describeDumps('capture dump round trip', () => {
  it('reproduces every page of the 7 dumps with 0 differences', () => {
    let dumps = 0;
    let pages = 0;
    let differences = 0;
    for (const name of dumpFiles()) {
      const dump = JSON.parse(fs.readFileSync(path.join(CAPTURE_DIR, name), 'utf8')) as { pages: DumpPage[] };
      dumps += 1;
      for (const page of dump.pages) {
        pages += 1;
        differences += countDifferences(page);
      }
    }
    expect(pages).toBeGreaterThanOrEqual(dumps);
    expect({ dumps, differences }).toEqual({ dumps: 7, differences: 0 });
  });
});
