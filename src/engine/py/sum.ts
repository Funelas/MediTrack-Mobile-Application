// Python's builtin sum() for a list of floats (ML-27/ML-28, S3): CPython 3.14.0 builtin_sum_impl in Python/bltinmodule.c,
// the compensated sum used from Python 3.12 (gh-100425): cs_add is Neumaier's 1974 improvement of Kahan's sum, and
// cs_to_double adds the compensation back at the end. Float path only: the vectors hold floats only, and all-int or mixed
// int/float lists are outside the parity claim (JavaScript cannot tell 2 from 2.0).
// Plain TypeScript, no logging, no React Native, fs or path import. The parentheses are load-bearing: JavaScript
// engines do not reassociate floating-point operations.

/**
 * Python's sum() of floats. An empty array gives 0 (Python's int 0). The first term is added to the start value 0 (so
 * -0 becomes +0), then every later term goes through the compensated step. The result is hi + lo when the compensation
 * lo is nonzero and finite (NaN counts as nonzero but not finite), otherwise hi.
 */
export function pySum(xs: readonly number[]): number {
  if (xs.length === 0) {
    return 0;
  }
  let hi = 0 + xs[0];
  let lo = 0;
  for (let i = 1; i < xs.length; i++) {
    const x = xs[i];
    const t = hi + x;
    if (Math.abs(hi) >= Math.abs(x)) {
      lo += (hi - t) + x;
    } else {
      lo += (x - t) + hi;
    }
    hi = t;
  }
  return lo !== 0 && Number.isFinite(lo) ? hi + lo : hi;
}
