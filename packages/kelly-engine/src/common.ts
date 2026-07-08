/** Shared utilities for the Kelly engine. */

/** Time (in periods) to double wealth at growth rate `g`; `Infinity` if g ≤ 0. */
export function doublingTime(g: number): number {
  return g > 0 ? Math.LN2 / g : Infinity;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Uniform RNG in [0,1). Injectable for deterministic tests. */
export type Rng = () => number;

/** Deterministic 32-bit RNG (mulberry32). Good enough for simulation & tests. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box–Muller, driven by an injectable uniform RNG. */
export function gaussian(rng: Rng): number {
  const u1 = rng() || Number.MIN_VALUE;
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Unit-variance Student-t shock with `df` degrees of freedom (integer ≥ 3).
 * Fat tails: with df=4, extreme moves are far more frequent than Gaussian —
 * a standard way to stress-test Kelly sizing against crash-like returns.
 */
export function studentT(rng: Rng, df: number): number {
  if (!Number.isInteger(df) || df < 3) throw new RangeError(`df must be an integer ≥ 3; got ${df}`);
  const z = gaussian(rng);
  let chi2 = 0;
  for (let i = 0; i < df; i++) {
    const g = gaussian(rng);
    chi2 += g * g;
  }
  const t = z / Math.sqrt(chi2 / df);
  return t / Math.sqrt(df / (df - 2)); // normalize to unit variance
}

export function median(values: ArrayLike<number>): number {
  const a = Array.from(values).sort((x, y) => x - y);
  if (a.length === 0) return NaN;
  const m = a.length >> 1;
  return a.length % 2 ? (a[m] as number) : ((a[m - 1] as number) + (a[m] as number)) / 2;
}
