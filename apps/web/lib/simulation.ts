import {
  medianPath,
  pathStats,
  quantilePath,
  simulateBinary,
  simulateContinuous,
  type PathStats,
  type Paths,
} from "kelly-engine";
import type { Derived } from "./derive";
import type { KellyState } from "./state";

export interface SimSettings {
  /** Periods per path (binary: bets; continuous: trading days, 250 ≈ 1 year). */
  steps: number;
  /** Independent paths per strategy. */
  trials: number;
}

export const DEFAULT_SIM: SimSettings = { steps: 250, trials: 400 };

export interface StrategyResult {
  key: "full" | "chosen" | "double" | "buyhold";
  label: string;
  fraction: number;
  median: Float64Array;
  stats: PathStats;
}

export interface MonteCarloResult {
  strategies: StrategyResult[];
  /** P10–P90 band for the *chosen* strategy (critique #5). */
  band: { lo: Float64Array; hi: Float64Array };
  steps: number;
  trials: number;
}

export function runMonteCarlo(
  s: KellyState,
  d: Derived,
  settings: SimSettings = DEFAULT_SIM,
): MonteCarloResult | null {
  if (d.fStar <= 0) return null;
  const { steps, trials } = settings;

  const simulate = (f: number): Paths =>
    s.mode === "bin"
      ? simulateBinary(f, { p: s.pPct / 100, b: s.b }, { trials, steps })
      : simulateContinuous(
          f,
          { mu: s.muPct / 100, r: s.rPct / 100, sigma: s.sigmaPct / 100 },
          { trials, steps, dt: 1 / 250 },
        );

  const clampBin = (f: number) => (s.mode === "bin" ? Math.min(f, 0.99) : f);

  const defs: Array<{ key: StrategyResult["key"]; label: string; fraction: number }> = [
    { key: "full", label: "Full Kelly (f*)", fraction: d.fStar },
    { key: "chosen", label: `Elegida (${s.mult.toFixed(2)}×)`, fraction: d.fChosen },
    { key: "double", label: "Sobreapuesta (2f*)", fraction: clampBin(2 * d.fStar) },
  ];
  // Benchmark (critique #6): buy & hold = 100% invested, continuous mode only.
  if (s.mode === "cont") {
    defs.push({ key: "buyhold", label: "Buy & Hold (f=1)", fraction: 1 });
  }

  let band: MonteCarloResult["band"] | null = null;
  const strategies: StrategyResult[] = defs.map((def) => {
    const paths = simulate(def.fraction);
    if (def.key === "chosen") {
      band = { lo: quantilePath(paths, 0.1), hi: quantilePath(paths, 0.9) };
    }
    return { ...def, median: medianPath(paths), stats: pathStats(paths) };
  });

  if (!band) return null;
  return { strategies, band, steps, trials };
}
