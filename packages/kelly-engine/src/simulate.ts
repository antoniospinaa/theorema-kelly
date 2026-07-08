/**
 * Monte Carlo utilities (PRD §5.5).
 * Pure functions; RNG is injectable for deterministic tests.
 */

import { type BinaryParams, wealthStepBinary } from "./binary";
import { type ContinuousParams, wealthStepContinuous } from "./continuous";
import { gaussian, median, type Rng } from "./common";

export interface SimOptions {
  /** Number of independent paths. Default 400. */
  trials?: number;
  /** Steps per path. Default 250. */
  steps?: number;
  /** Uniform RNG in [0,1). Default Math.random. */
  rng?: Rng;
  /** Years per step (continuous model only). Default 1/250. */
  dt?: number;
}

export type Paths = Float64Array[];

export function simulateBinary(f: number, params: BinaryParams, opts: SimOptions = {}): Paths {
  const { trials = 400, steps = 250, rng = Math.random } = opts;
  const paths: Paths = [];
  for (let n = 0; n < trials; n++) {
    const row = new Float64Array(steps + 1);
    row[0] = 1;
    let w = 1;
    for (let t = 1; t <= steps; t++) {
      w = wealthStepBinary(w, f, params, rng());
      row[t] = w;
    }
    paths.push(row);
  }
  return paths;
}

export function simulateContinuous(f: number, params: ContinuousParams, opts: SimOptions = {}): Paths {
  const { trials = 400, steps = 250, rng = Math.random, dt = 1 / 250 } = opts;
  const paths: Paths = [];
  for (let n = 0; n < trials; n++) {
    const row = new Float64Array(steps + 1);
    row[0] = 1;
    let w = 1;
    for (let t = 1; t <= steps; t++) {
      w = wealthStepContinuous(w, f, params, gaussian(rng), dt);
      row[t] = w;
    }
    paths.push(row);
  }
  return paths;
}

/** Pointwise median across paths, per time step. */
export function medianPath(paths: Paths): Float64Array {
  const first = paths[0];
  if (!first) return new Float64Array(0);
  const T = first.length;
  const out = new Float64Array(T);
  const col = new Float64Array(paths.length);
  for (let t = 0; t < T; t++) {
    for (let n = 0; n < paths.length; n++) col[n] = (paths[n] as Float64Array)[t] as number;
    out[t] = median(col);
  }
  return out;
}

export interface PathStats {
  /** Median terminal growth (0.5 = +50%). */
  growth: number;
  /** Median maximum peak-to-trough drawdown (positive number, 0.3 = −30%). */
  maxDrawdown: number;
  /** Fraction of paths that ever lost more than 90% of initial wealth. */
  ruinProbability: number;
  /** Pooled per-step log-return Sharpe, scaled by √steps (per-horizon). */
  sharpe: number;
}

export function pathStats(paths: Paths): PathStats {
  const finals: number[] = [];
  const drawdowns: number[] = [];
  let ruined = 0;
  let sum = 0;
  let sum2 = 0;
  let count = 0;
  const T = (paths[0]?.length ?? 1) - 1;

  for (const row of paths) {
    finals.push(row[T] as number);
    let peak = row[0] as number;
    let dd = 0;
    let minW = row[0] as number;
    for (let t = 1; t <= T; t++) {
      const w = row[t] as number;
      if (w > peak) peak = w;
      const d = 1 - w / peak;
      if (d > dd) dd = d;
      if (w < minW) minW = w;
      const lr = Math.log(w / (row[t - 1] as number));
      sum += lr;
      sum2 += lr * lr;
      count++;
    }
    drawdowns.push(dd);
    if (minW < 0.1) ruined++;
  }

  const mean = sum / count;
  const variance = sum2 / count - mean * mean;
  const sharpe = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(T) : 0;

  return {
    growth: median(finals) - 1,
    maxDrawdown: median(drawdowns),
    ruinProbability: ruined / paths.length,
    sharpe,
  };
}
