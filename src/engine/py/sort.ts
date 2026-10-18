// Stable sort, first-extreme search and median with Python's behaviour (ML-27/ML-28, S3, decision D15).
// Plain TypeScript, no logging, no React Native, fs or path import. Array.prototype.sort is not used.

/** Python's sorted(items, key=...): a stable merge sort that returns a new array. cmp must be a numeric comparator. */
export function stableSort<T>(items: readonly T[], cmp: (a: T, b: T) => number): T[] {
  if (items.length <= 1) {
    return items.slice();
  }
  const middle = Math.floor(items.length / 2);
  const left = stableSort(items.slice(0, middle), cmp);
  const right = stableSort(items.slice(middle), cmp);
  const merged: T[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    // take from the right only when it is strictly smaller, so equal items keep their input order
    if (cmp(right[j], left[i]) < 0) {
      merged.push(right[j]);
      j += 1;
    } else {
      merged.push(left[i]);
      i += 1;
    }
  }
  while (i < left.length) {
    merged.push(left[i]);
    i += 1;
  }
  while (j < right.length) {
    merged.push(right[j]);
    j += 1;
  }
  return merged;
}

/** Python's max(items, key=key): the first item with the largest key; undefined for an empty array. */
export function firstMax<T>(items: readonly T[], key: (t: T) => number): T | undefined {
  let best: T | undefined;
  let bestKey = 0;
  for (let i = 0; i < items.length; i += 1) {
    const k = key(items[i]);
    if (i === 0 || k > bestKey) {
      best = items[i];
      bestKey = k;
    }
  }
  return best;
}

/** Python's min(items, key=key): the first item with the smallest key; undefined for an empty array. */
export function firstMin<T>(items: readonly T[], key: (t: T) => number): T | undefined {
  let best: T | undefined;
  let bestKey = 0;
  for (let i = 0; i < items.length; i += 1) {
    const k = key(items[i]);
    if (i === 0 || k < bestKey) {
      best = items[i];
      bestKey = k;
    }
  }
  return best;
}

/** Python's statistics.median: the middle value, or (a + b) / 2 of the two middle values. Throws on an empty array. */
export function pyMedian(xs: number[]): number {
  if (xs.length === 0) {
    throw new Error('no median for empty data');
  }
  const sorted = stableSort(xs, (a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
}
