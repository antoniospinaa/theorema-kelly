/**
 * Binary (repeated bet) Kelly formulation.
 *
 * A bet wins with probability `p`, paying `b` to 1 (net gain of b per unit
 * staked), and loses the stake with probability q = 1 − p.
 *
 *   f* = (p·b − q) / b
 *   G(f) = p·ln(1 + f·b) + q·ln(1 − f)
 *
 * Reference: Kelly (1956); capstone §3–4.
 */

export interface BinaryParams {
  /** Probability of winning, in (0, 1). */
  p: number;
  /** Net payout per unit staked (b to 1), > 0. */
  b: number;
}

function validate({ p, b }: BinaryParams): void {
  if (!(p > 0 && p < 1)) throw new RangeError(`p must be in (0,1); got ${p}`);
  if (!(b > 0)) throw new RangeError(`b must be > 0; got ${b}`);
}

/**
 * Optimal Kelly fraction. May be ≤ 0 when the bet is unfavorable
 * (p·b − q ≤ 0); callers should then bet nothing (see `isFavorable`).
 */
export function fStarBinary(params: BinaryParams): number {
  validate(params);
  const { p, b } = params;
  return (p * b - (1 - p)) / b;
}

/** A bet is favorable iff its edge p·b − q is strictly positive. */
export function isFavorable(params: BinaryParams): boolean {
  return fStarBinary(params) > 0;
}

/**
 * Expected logarithmic growth rate per trial at fraction `f`.
 * Domain: 0 ≤ f < 1 (betting the whole bankroll risks log(0)).
 * Returns NaN outside the domain.
 */
export function growthBinary(f: number, params: BinaryParams): number {
  validate(params);
  if (!(f >= 0 && f < 1)) return NaN;
  const { p, b } = params;
  return p * Math.log(1 + f * b) + (1 - p) * Math.log(1 - f);
}

/** One multiplicative wealth step. `u` is a uniform draw in [0,1). */
export function wealthStepBinary(
  w: number,
  f: number,
  { p, b }: BinaryParams,
  u: number,
): number {
  return u < p ? w * (1 + f * b) : w * (1 - f);
}
