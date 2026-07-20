import type { Lang } from "./i18n";

export type Mode = "bin" | "cont";

/** Progressive disclosure: "simple" hides the technical layer, "lab" shows everything. */
export type ViewLevel = "simple" | "lab";

/**
 * UI-facing state. Percentages are stored in UI units (55 = 55 %) and
 * converted to decimals only at the engine boundary (see derive.ts) —
 * DESIGN.md unit rule.
 */
export interface KellyState {
  mode: Mode;
  /** UI detail level. */
  view: ViewLevel;
  /** UI language (browser-detected on mount; user override persisted). */
  lang: Lang;
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
  /**
   * Where the current assumptions came from (ticker estimate, profile,
   * example, portfolio bridge). null = manually entered. Shown in Análisis
   * so the user always knows what the simulation refers to.
   */
  sourceLabel: string | null;
}

export const DEFAULT_STATE: KellyState = {
  mode: "bin",
  view: "simple",
  lang: "es",
  capital: 10000,
  pPct: 55,
  b: 1,
  muPct: 12,
  rPct: 3,
  sigmaPct: 25,
  // Default to ½ Kelly: full Kelly assumes perfectly estimated parameters,
  // which never holds in practice (UX critique: protect users from defaults).
  mult: 0.5,
  sourceLabel: "Ejemplo: moneda sesgada 55/45",
};
