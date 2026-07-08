/**
 * Continuous single-asset Kelly formulation (Merton fraction).
 *
 * For an asset following geometric Brownian motion with expected (arithmetic)
 * annual return μ, annual volatility σ, and risk-free rate r:
 *
 *   f* = (μ − r) / σ²
 *   g(f) = r + f(μ − r) − ½ f² σ²
 *
 * Reference: capstone §5.
 */

export interface ContinuousParams {
  /** Expected annual return, as a decimal (0.12 = 12%). */
  mu: number;
  /** Annual risk-free rate, as a decimal. */
  r: number;
  /** Annual volatility, as a decimal, > 0. */
  sigma: number;
}

function validate({ mu, r, sigma }: ContinuousParams): void {
  if (!Number.isFinite(mu)) throw new RangeError(`mu must be finite; got ${mu}`);
  if (!Number.isFinite(r)) throw new RangeError(`r must be finite; got ${r}`);
  if (!(sigma > 0)) throw new RangeError(`sigma must be > 0; got ${sigma}`);
}

/** Optimal Kelly (Merton) fraction. May be < 0 (implied short) or > 1 (implied leverage). */
export function fStarContinuous(params: ContinuousParams): number {
  validate(params);
  const { mu, r, sigma } = params;
  return (mu - r) / (sigma * sigma);
}

/** Expected logarithmic growth rate per year at fraction `f`. */
export function growthContinuous(f: number, params: ContinuousParams): number {
  validate(params);
  const { mu, r, sigma } = params;
  return r + f * (mu - r) - 0.5 * f * f * sigma * sigma;
}

/** PRD §5.2: the UI must warn on implied leverage (f* > 1) or implied short (f* < 0). */
export type ContinuousRegime = "short" | "leveraged" | "standard";

export function classifyFStar(fStar: number): ContinuousRegime {
  if (fStar < 0) return "short";
  if (fStar > 1) return "leveraged";
  return "standard";
}

/**
 * One multiplicative wealth step over `dt` years, using an exact GBM step for
 * the log-wealth SDE. `z` is a standard normal draw.
 */
export function wealthStepContinuous(
  w: number,
  f: number,
  { mu, r, sigma }: ContinuousParams,
  z: number,
  dt: number,
): number {
  const drift = (r + f * (mu - r) - 0.5 * f * f * sigma * sigma) * dt;
  return w * Math.exp(drift + f * sigma * Math.sqrt(dt) * z);
}
