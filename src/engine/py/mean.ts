// Python's statistics.mean for floats: the exact rational sum, rounded once to the nearest double (ML-27/ML-28, S3).
// Plain TypeScript, no logging, no React Native, fs or path import. BigInt is written as BigInt(...) calls.
import { decomposeDouble } from './round';

const ZERO = BigInt(0);
const ONE = BigInt(1);

/** Number of bits of a positive BigInt. */
function bitLength(value: bigint): number {
  const hex = value.toString(16);
  const lead = parseInt(hex.charAt(0), 16);
  return (hex.length - 1) * 4 + (lead >= 8 ? 4 : lead >= 4 ? 3 : lead >= 2 ? 2 : 1);
}

/** 2^k as a double, built from its bits, for -1074 <= k <= 1023. */
function pow2(k: number): number {
  const view = new DataView(new ArrayBuffer(8));
  if (k >= -1022) {
    view.setUint32(0, (k + 1023) * 1048576);
  } else {
    const bit = k + 1074;
    if (bit >= 32) {
      view.setUint32(0, 1 << (bit - 32));
    } else {
      view.setUint32(4, (1 << bit) >>> 0);
    }
  }
  return view.getFloat64(0);
}

/**
 * numerator / denominator (denominator > 0) as the nearest double, ties to even, subnormals and overflow included.
 * The quotient is first computed with 55 or 56 bits plus a sticky bit, then rounded once to 53 bits (fewer for
 * subnormals).
 */
function ratioToDouble(numerator: bigint, denominator: bigint): number {
  if (numerator === ZERO) {
    return 0;
  }
  const negative = numerator < ZERO;
  const magnitude = negative ? -numerator : numerator;
  const k = 55 - (bitLength(magnitude) - bitLength(denominator));
  const scaledNumerator = k >= 0 ? magnitude << BigInt(k) : magnitude;
  const scaledDenominator = k >= 0 ? denominator : denominator << BigInt(-k);
  const quotient = scaledNumerator / scaledDenominator;
  const sticky = scaledNumerator % scaledDenominator !== ZERO;
  // value = (quotient + fraction) * 2^-k; the lowest kept bit has weight 2^lowExp
  const lowExp = Math.max(bitLength(quotient) - 1 - k - 52, -1074);
  if (lowExp > 1023) {
    return negative ? -Infinity : Infinity;
  }
  const drop = BigInt(lowExp + k);
  let kept = quotient >> drop;
  const remainder = quotient - (kept << drop);
  const half = ONE << (drop - ONE);
  if (remainder > half || (remainder === half && (sticky || (kept & ONE) === ONE))) {
    kept += ONE;
  }
  const result = Number(kept) * pow2(lowExp);
  return negative ? -result : result;
}

/**
 * Python's statistics.mean for floats and integers: every value is exact (mantissa * 2^exponent), the sum is an exact
 * BigInt over 2^1074, and the quotient by the count is rounded once, half to even. Throws an Error for an empty
 * array (Python raises StatisticsError) and a RangeError for a value that is not finite.
 */
export function pyMean(xs: number[]): number {
  if (xs.length === 0) {
    throw new Error('mean requires at least one data point');
  }
  let total = ZERO;
  for (const x of xs) {
    if (!Number.isFinite(x)) {
      throw new RangeError('pyMean needs finite numbers');
    }
    const { negative, mantissa, exponent } = decomposeDouble(x);
    const scaled = mantissa << BigInt(exponent + 1074);
    total += negative ? -scaled : scaled;
  }
  return ratioToDouble(total, BigInt(xs.length) << BigInt(1074));
}
