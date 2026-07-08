/** Client-side historical backtest orchestration (PRD Fase 4). */

import {
  backtestConstantFraction,
  estimateMuSigma,
  fStarContinuous,
  logReturns,
  type BacktestMetrics,
} from "kelly-engine";
import type { SeriesColor } from "./charts";
import { fetchPrices } from "./market";

export interface BacktestStrategy {
  key: string;
  label: string;
  fraction: number;
  wealth: Float64Array;
  metrics: BacktestMetrics;
  color: SeriesColor;
  dash?: number[];
}

export interface BacktestData {
  ticker: string;
  source: string;
  from: string;
  to: string;
  n: number;
  fStarRaw: number;
  muPct: number;
  sigmaPct: number;
  strategies: BacktestStrategy[];
  /** μ-perturbation sensitivity (the capstone's 20:1 finding, PRD §4-F4). */
  sensitivity: Array<{ label: string; muPct: number; fStar: number }>;
}

export async function runBacktest(ticker: string, days: number, rPct: number): Promise<BacktestData> {
  const data = await fetchPrices(ticker, days + 40);
  const closes = data.closes.slice(-(days + 1));
  const dates = data.dates.slice(-(days + 1));
  if (closes.length < 60) throw new Error("Serie insuficiente para el backtest (mínimo 60 días).");

  const r = rPct / 100;
  const est = estimateMuSigma(logReturns(closes));
  const fStarRaw = fStarContinuous({ mu: est.muAnnual, r, sigma: est.sigmaAnnual });
  const fs = Math.max(0, fStarRaw);

  const defs: Array<Omit<BacktestStrategy, "wealth" | "metrics">> = [
    { key: "full", label: "Full Kelly (f*)", fraction: fs, color: "sage" },
    { key: "half", label: "½ Kelly", fraction: fs / 2, color: "blue", dash: [5, 4] },
    { key: "quarter", label: "¼ Kelly", fraction: fs / 4, color: "ink", dash: [2, 3] },
    { key: "bh", label: "Buy & Hold (f=1)", fraction: 1, color: "ochre" },
  ];

  const strategies: BacktestStrategy[] = defs.map((d) => {
    const bt = backtestConstantFraction(closes, d.fraction, r);
    return { ...d, wealth: bt.wealth, metrics: bt.metrics };
  });

  const sensitivity = [-2, 0, 2].map((dpp) => {
    const mu = est.muAnnual + dpp / 100;
    return {
      label: dpp === 0 ? "μ̂ estimada" : dpp > 0 ? "μ̂ + 2 pp" : "μ̂ − 2 pp",
      muPct: mu * 100,
      fStar: fStarContinuous({ mu, r, sigma: est.sigmaAnnual }),
    };
  });

  return {
    ticker: data.ticker,
    source: data.source,
    from: dates[0] ?? "",
    to: dates[dates.length - 1] ?? "",
    n: closes.length - 1,
    fStarRaw,
    muPct: est.muAnnual * 100,
    sigmaPct: est.sigmaAnnual * 100,
    strategies,
    sensitivity,
  };
}
