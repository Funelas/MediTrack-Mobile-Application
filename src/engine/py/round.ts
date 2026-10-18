// Python's round(x, n) for a float, and the exact split of a double that pyMean also uses (ML-27/ML-28, S3).
// Plain TypeScript, no logging, no React Native, fs or path import. BigInt is written as BigInt(...) calls.

const TWO_POW_52 = 4503599627370496;
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TEN = BigInt(10);

const view = new DataView(new ArrayBuffer(8));

/** x = (negative ? -1 : 1) * mantissa * 2^exponent, exactly (mantissa is a non-negative integer). */
export interface DoubleParts {
  negative: boolean;
  mantissa: bigint;
  exponent: number;
}

/** Splits a finite double into sign, integer mantissa and binary exponent. Subnormals use exponent -1074. */
export function decomposeDouble(x: number): DoubleParts {
  view.setFloat64(0, x);
  const high = view.getUint32(0);
  const low = view.getUint32(4);
  const negative = high >>> 31 === 1;
  const biased = (high >>> 20) & 0x7ff;
  const fraction = (BigInt(high & 0xfffff) << BigInt(32)) | BigInt(low);
  if (biased === 0) {
    return { negative, mantissa: fraction, exponent: -1074 };
  }
  return { negative, mantissa: fraction | (ONE << BigInt(52)), exponent: biased - 1075 };
}

/** 10^n as a BigInt (a loop, so no BigInt exponentiation operator is needed). */
export function pow10(n: number): bigint {
  let result = ONE;
  for (let i = 0; i < n; i += 1) {
    result *= TEN;
  }
  return result;
}

/**
 * Python's round(x, n): half to even on the exact binary value of x. N = round-half-even(x * 10^n) is computed
 * exactly in BigInt, then Number(N + "e-" + n) converts it with correct rounding, as CPython's strtod does.
 * x comes back unchanged when it is not finite or when |x| >= 2^52 (already an integer). n is an integer >= 0.
 * A zero result keeps the sign of x (Number("-0e-2") is -0); callers must not depend on the sign of zero.
 */
export function pyRound(x: number, n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError('pyRound needs an integer n >= 0');
  }
  if (!Number.isFinite(x) || Math.abs(x) >= TWO_POW_52) {
    return x;
  }
  const { negative, mantissa, exponent } = decomposeDouble(x);
  if (exponent >= 0) {
    return x;
  }
  const shift = BigInt(-exponent);
  const scaled = mantissa * pow10(n);
  let quotient = scaled >> shift;
  const remainder = scaled - (quotient << shift);
  const half = ONE << (shift - ONE);
  if (remainder > half || (remainder === half && (quotient & ONE) === ONE)) {
    quotient += ONE;
  }
  return Number((negative ? '-' : '') + quotient.toString() + 'e-' + String(n));
}
