import {
  classifyFStar,
  doublingTime,
  fStarBinary,
  fStarContinuous,
  growthBinary,
  growthContinuous,
  type ContinuousRegime,
} from "kelly-engine";
import type { KellyState } from "./state";

export interface Derived {
  /** Raw f* (may be < 0 or > 1). */
  fStarRaw: number;
  /** f* clamped at 0 for presentation. */
  fStar: number;
  /** User's fraction: mult × f*, clamped < 0.99 in binary mode (log domain). */
  fChosen: number;
  /**
   * No-leverage alternative: min(fChosen, 1). When f* > 1, G(f) is increasing
   * on [0, f*], so f = 1 (invest exactly the available capital) is the
   * constrained optimum without margin.
   */
  fNoLeverage: number;
  /** Growth at fChosen (0 when there is no edge). */
  g: number;
  /** Growth at fNoLeverage (0 when there is no edge). */
  gNoLeverage: number;
  doubling: number;
  regime: ContinuousRegime;
  noEdge: boolean;
  growthFn: (f: number) => number;
}

export function deriveKelly(s: KellyState): Derived {
  const growthFn =
    s.mode === "bin"
      ? (f: number) => growthBinary(f, { p: s.pPct / 100, b: s.b })
      : (f: number) =>
          growthContinuous(f, { mu: s.muPct / 100, r: s.rPct / 100, sigma: s.sigmaPct / 100 });

  const fStarRaw =
    s.mode === "bin"
      ? fStarBinary({ p: s.pPct / 100, b: s.b })
      : fStarContinuous({ mu: s.muPct / 100, r: s.rPct / 100, sigma: s.sigmaPct / 100 });

  const fStar = Math.max(0, fStarRaw);
  let fChosen = s.mult * fStar;
  if (s.mode === "bin") fChosen = Math.min(fChosen, 0.99);
  const fNoLeverage = Math.min(fChosen, 1);

  const g = fStar > 0 ? growthFn(fChosen) : 0;
  const gNoLeverage = fStar > 0 ? growthFn(fNoLeverage) : 0;

  return {
    fStarRaw,
    fStar,
    fChosen,
    fNoLeverage,
    g,
    gNoLeverage,
    doubling: doublingTime(g),
    regime: classifyFStar(fStarRaw),
    noEdge: fStarRaw <= 0,
    growthFn,
  };
}
