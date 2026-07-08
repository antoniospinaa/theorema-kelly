/** Client-side helpers for the market-data endpoints + parameter estimation. */

import { estimateMuSigma, logReturns, type MuSigmaEstimate } from "kelly-engine";

export interface PricesData {
  ticker: string;
  source: "stooq" | "yahoo";
  dates: string[];
  closes: number[];
}

export interface RiskFreeData {
  ratePct: number;
  asOf: string;
  source: "treasury" | "default";
}

/**
 * Common crypto symbols people type bare ("BTC") resolve to the -USD pair;
 * without this, Yahoo returns an unrelated equity that happens to use the
 * same ticker (e.g. "BTC" ≠ Bitcoin).
 */
const CRYPTO_BARE = new Set(["BTC", "ETH", "SOL", "ADA", "XRP", "DOGE", "LTC", "BNB", "AVAX", "DOT"]);

export function resolveTicker(input: string): string {
  const t = input.trim().toUpperCase();
  return CRYPTO_BARE.has(t) ? `${t}-USD` : t;
}

export async function fetchPrices(ticker: string, days = 730): Promise<PricesData> {
  const resolved = resolveTicker(ticker);
  const res = await fetch(`/api/prices?ticker=${encodeURIComponent(resolved)}&days=${days}`);
  let json: (PricesData & { error?: string }) | null = null;
  try {
    json = (await res.json()) as PricesData & { error?: string };
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok || !json || !Array.isArray(json.closes)) {
    throw new Error(json?.error ?? `Error al consultar precios de «${resolved}» (HTTP ${res.status}).`);
  }
  return json;
}

export async function fetchRiskFree(): Promise<RiskFreeData> {
  const res = await fetch("/api/riskfree");
  if (!res.ok) throw new Error("Error al consultar la tasa libre de riesgo.");
  return (await res.json()) as RiskFreeData;
}

export interface WindowEstimate extends MuSigmaEstimate {
  ticker: string;
  source: string;
  lastClose: number;
  from: string;
  to: string;
}

/** Estimate μ̂, σ̂ from the last `windowDays` daily closes. */
export function estimateWindow(data: PricesData, windowDays: number): WindowEstimate {
  const closes = data.closes.slice(-(windowDays + 1));
  const dates = data.dates.slice(-(windowDays + 1));
  if (closes.length < 30) throw new Error("Serie insuficiente para estimar (mínimo 30 días).");
  const est = estimateMuSigma(logReturns(closes));
  return {
    ...est,
    ticker: data.ticker,
    source: data.source,
    lastClose: closes[closes.length - 1] as number,
    from: dates[0] as string,
    to: dates[dates.length - 1] as string,
  };
}

export interface AlignedSeries {
  tickers: string[];
  dates: string[];
  /** closes[i] is the aligned close series of tickers[i]. */
  closes: number[][];
}

/** Intersect trading dates across tickers and keep the last `windowDays`+1 closes. */
export function alignSeries(list: PricesData[], windowDays: number): AlignedSeries {
  const first = list[0];
  if (!first) throw new Error("Sin series para alinear.");
  const sets = list.map((d) => new Set(d.dates));
  const common = first.dates.filter((dt) => sets.every((s) => s.has(dt)));
  const take = common.slice(-(windowDays + 1));
  if (take.length < 30) throw new Error("Muy pocas fechas comunes entre los tickers.");
  const closes = list.map((d) => {
    const byDate = new Map(d.dates.map((dt, i) => [dt, d.closes[i] as number]));
    return take.map((dt) => byDate.get(dt) as number);
  });
  return { tickers: list.map((d) => d.ticker), dates: take, closes };
}
