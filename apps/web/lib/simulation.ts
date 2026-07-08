import {
  medianPath,
  pathStats,
  simulateBinary,
  simulateContinuous,
  type PathStats,
  type Paths,
} from "kelly-engine";
import type { Derived } from "./derive";
import type { KellyState } from "./state";

export interface MonteCarloResult {
  /** Median wealth paths for [full Kelly, chosen fraction, 2× Kelly]. */
  medians: Float64Array[];
  /** Statistics for the *chosen* fraction. */
  stats: PathStats;
  steps: number;
  trials: number;
}

const TRIALS = 400;
const STEPS = 250;

export function runMonteCarlo(s: KellyState, d: Derived): MonteCarloResult | null {
  if (d.fStar <= 0) return null;

  const fDouble = s.mode === "bin" ? Math.min(2 * d.fStar, 0.99) : 2 * d.fStar;
  const fractions = [d.fStar, d.fChosen, fDouble];

  const simulate = (f: number): Paths =>
    s.mode === "bin"
      ? simulateBinary(f, { p: s.pPct / 100, b: s.b }, { trials: TRIALS, steps: STEPS })
      : simulateContinuous(
          f,
          { mu: s.muPct / 100, r: s.rPct / 100, sigma: s.sigmaPct / 100 },
          { trials: TRIALS, steps: STEPS, dt: 1 / 250 },
        );

  const sims = fractions.map(simulate);
  const chosen = sims[1];
  if (!chosen) return null;

  return {
    medians: sims.map(medianPath),
    stats: pathStats(chosen),
    steps: STEPS,
    trials: TRIALS,
  };
}
