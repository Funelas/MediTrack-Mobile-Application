// ML Kit result to raw page (MOB-03). Pure TypeScript: no React Native, Expo or wrapper import, so the types below are a
// local structural copy of the parts of the wrapper's result that are read here. One element per word; the box is the
// word's frame as [left, top, right, bottom], the same box the capture tool wrote, and confidence is null (ML Kit gives
// none for a word).

export interface FrameLike {
  width: number;
  height: number;
  top: number;
  left: number;
}

export interface ElementLike {
  text: string;
  frame?: FrameLike;
}

export interface LineLike {
  elements: ElementLike[];
}

export interface BlockLike {
  lines: LineLike[];
}

export interface MlKitResultLike {
  blocks: BlockLike[];
}

export interface PageSize {
  width?: number;
  height?: number;
}

export interface RawElement {
  text: string;
  box: [number, number, number, number];
  confidence: null;
}

export interface RawPage {
  page_index: number;
  width: number;
  height: number;
  elements: RawElement[];
}

export type RawPageResult =
  | { kind: 'page'; page: RawPage; droppedNoFrame: number }
  | { kind: 'no_image_size' };

function isPositiveSize(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * The raw page for one ML Kit result. Blocks, lines and elements are walked in that order. A word with no frame is
 * dropped and counted; a word with empty text is kept (the identity filter drops it later). A missing, non-finite or
 * non-positive image size gives `no_image_size`.
 */
export function toRawPage(result: MlKitResultLike, size: PageSize, pageIndex: number): RawPageResult {
  const width = size.width;
  const height = size.height;
  if (!isPositiveSize(width) || !isPositiveSize(height)) {
    return { kind: 'no_image_size' };
  }
  const elements: RawElement[] = [];
  let droppedNoFrame = 0;
  for (const block of result.blocks) {
    for (const line of block.lines) {
      for (const element of line.elements) {
        const frame = element.frame;
        if (!frame) {
          droppedNoFrame += 1;
          continue;
        }
        elements.push({
          text: element.text,
          box: [frame.left, frame.top, frame.left + frame.width, frame.top + frame.height],
          confidence: null,
        });
      }
    }
  }
  return { kind: 'page', page: { page_index: pageIndex, width, height, elements }, droppedNoFrame };
}
