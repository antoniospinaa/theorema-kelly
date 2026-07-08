import { NextResponse } from "next/server";

/**
 * GET /api/prices?ticker=AAPL&days=730
 *
 * Server-side price fetcher (avoids CORS; no API keys).
 * Primary source: Stooq daily CSV. Fallback: Yahoo Finance chart JSON.
 * Responses are cached for 1 hour (daily data — PRD §9: no intraday).
 */

export interface PricesResponse {
  ticker: string;
  source: "stooq" | "yahoo";
  dates: string[]; // ISO yyyy-mm-dd
  closes: number[];
}

const MAX_DAYS = 365 * 5;

function normalizeStooq(ticker: string): string {
  const t = ticker.trim().toLowerCase();
  if (t.endsWith("-usd")) return t.replace("-", ""); // BTC-USD → btcusd (crypto pairs)
  return t.includes(".") ? t : `${t}.us`; // bare symbols default to US market
}

async function fromStooq(ticker: string, days: number): Promise<PricesResponse | null> {
  const symbol = normalizeStooq(ticker);
  const res = await fetch(`https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`, {
    next: { revalidate: 3600 },
    headers: { "User-Agent": "theorema-kelly/0.2 (educational)" },
  });
  if (!res.ok) return null;
  const text = await res.text();
  const lines = text.trim().split("\n");
  // Expected header: Date,Open,High,Low,Close,Volume
  if (lines.length < 3 || !lines[0]?.toLowerCase().startsWith("date")) return null;
  const dates: string[] = [];
  const closes: number[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const date = cols[0];
    const close = parseFloat(cols[4] ?? "");
    if (date && Number.isFinite(close) && close > 0) {
      dates.push(date);
      closes.push(close);
    }
  }
  if (closes.length < 30) return null;
  const from = Math.max(0, dates.length - days);
  return { ticker: ticker.toUpperCase(), source: "stooq", dates: dates.slice(from), closes: closes.slice(from) };
}

async function fromYahoo(ticker: string, days: number): Promise<PricesResponse | null> {
  const range = days > 730 ? "5y" : days > 365 ? "2y" : "1y";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker.trim().toUpperCase(),
  )}?range=${range}&interval=1d`;
  const res = await fetch(url, {
    next: { revalidate: 3600 },
    headers: { "User-Agent": "Mozilla/5.0 (compatible; theorema-kelly/0.2)" },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
    };
  };
  const result = json.chart?.result?.[0];
  const ts = result?.timestamp;
  const raw = result?.indicators?.quote?.[0]?.close;
  if (!ts || !raw) return null;
  const dates: string[] = [];
  const closes: number[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = raw[i];
    const t = ts[i];
    if (t !== undefined && c !== null && c !== undefined && Number.isFinite(c) && c > 0) {
      dates.push(new Date(t * 1000).toISOString().slice(0, 10));
      closes.push(c);
    }
  }
  if (closes.length < 30) return null;
  const from = Math.max(0, dates.length - days);
  return { ticker: ticker.toUpperCase(), source: "yahoo", dates: dates.slice(from), closes: closes.slice(from) };
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");
  const days = Math.min(MAX_DAYS, Math.max(60, parseInt(searchParams.get("days") ?? "730", 10) || 730));

  if (!ticker || !/^[A-Za-z0-9.^-]{1,12}$/.test(ticker.trim())) {
    return NextResponse.json({ error: "Parámetro 'ticker' inválido." }, { status: 400 });
  }

  try {
    const data = (await fromStooq(ticker, days)) ?? (await fromYahoo(ticker, days));
    if (!data) {
      return NextResponse.json(
        { error: `No se encontraron datos para «${ticker.toUpperCase()}». Verifique el símbolo.` },
        { status: 404 },
      );
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json(
      { error: "Error al consultar las fuentes de datos. Intente de nuevo." },
      { status: 502 },
    );
  }
}
