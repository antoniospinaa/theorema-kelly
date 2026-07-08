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

export function median(values: ArrayLike<number>): number {
  const a = Array.from(values).sort((x, y) => x - y);
  if (a.length === 0) return NaN;
  const m = a.length >> 1;
  return a.length % 2 ? (a[m] as number) : ((a[m - 1] as number) + (a[m] as number)) / 2;
}
