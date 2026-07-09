/**
 * Plain-language layer: translate rates and Greek letters into dollar
 * outcomes over a relatable horizon. Analytic (no simulation) so it updates
 * instantly with every keystroke.
 *
 * Continuous: log-wealth after 1 year is Normal(g, (f·σ)²) → lognormal
 * quantiles are exact. Binary: CLT approximation over 100 bets.
 */

import type { Derived } from "./derive";
import type { KellyState } from "./state";

const Z90 = 1.2815515655; // 90th percentile of the standard normal

export interface PlainSummary {
  horizon: string;
  invest: number;
  base: number;
  typical: number;
  bad: number;  // 1-in-10 bad scenario
  good: number; // 1-in-10 good scenario
  doubling: string | null;
  noEdge: boolean;
  overbetting: boolean;
  approximate: boolean;
}

export function plainSummary(s: KellyState, d: Derived): PlainSummary {
  const cap = s.capital;
  let mean = 0;
  let sd = 0;
  let horizon: string;
  let approximate = false;

  if (s.mode === "cont") {
    horizon = "1 año";
    mean = d.g; // whole-portfolio annual log growth at fChosen
    sd = d.fChosen * (s.sigmaPct / 100);
  } else {
    horizon = "100 apuestas";
    approximate = true;
    const n = 100;
    const p = s.pPct / 100;
    const q = 1 - p;
    const f = d.fChosen;
    if (f > 0 && f < 1) {
      const a = Math.log(1 + f * s.b);
      const c = Math.log(1 - f);
      const m1 = p * a + q * c;
      const v = Math.max(0, p * a * a + q * c * c - m1 * m1);
      mean = n * m1;
      sd = Math.sqrt(v * n);
    }
  }

  const dt = d.doubling;
  const doubling =
    d.noEdge || !Number.isFinite(dt) || d.g <= 0
      ? null
      : s.mode === "cont"
        ? `${dt.toFixed(1)} años`
        : `${Math.round(dt)} apuestas`;

  return {
    horizon,
    invest: d.fChosen * cap,
    base: cap,
    typical: cap * Math.exp(mean),
    bad: cap * Math.exp(mean - Z90 * sd),
    good: cap * Math.exp(mean + Z90 * sd),
    doubling,
    noEdge: d.noEdge,
    overbetting: !d.noEdge && s.mult > 1.0001,
    approximate,
  };
}

export const money = (x: number): string => "$" + Math.round(x).toLocaleString("en-US");
