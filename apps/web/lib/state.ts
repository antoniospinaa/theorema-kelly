export type Mode = "bin" | "cont";

/**
 * UI-facing state. Percentages are stored in UI units (55 = 55 %) and
 * converted to decimals only at the engine boundary (see derive.ts) —
 * DESIGN.md unit rule.
 */
export interface KellyState {
  mode: Mode;
  /** Bankroll, USD. */
  capital: number;
  /** Win probability, percent (binary mode). */
  pPct: number;
  /** Net payout b to 1 (binary mode). */
  b: number;
  /** Expected annual return, percent (continuous mode). */
  muPct: number;
  /** Risk-free annual rate, percent (continuous mode). */
  rPct: number;
  /** Annual volatility, percent (continuous mode). */
  sigmaPct: number;
  /** Kelly multiplier applied by the user (1 = full Kelly). */
  mult: number;
}

export const DEFAULT_STATE: KellyState = {
  mode: "bin",
  capital: 10000,
  pPct: 55,
  b: 1,
  muPct: 12,
  rPct: 3,
  sigmaPct: 25,
  mult: 1,
};
