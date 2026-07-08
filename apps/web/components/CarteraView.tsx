"use client";

import { useState } from "react";
import {
  covMatrix,
  estimateMuSigma,
  fStarPortfolio,
  logReturns,
} from "kelly-engine";
import { useKelly } from "./KellyProvider";
import { alignSeries, fetchPrices, fetchRiskFree } from "@/lib/market";
import { downloadCSV } from "@/lib/export";
import { fmtMoney, fmtPct } from "@/lib/format";

interface PortfolioRow {
  ticker: string;
  muPct: number;
  sigmaPct: number;
  weight: number; // full-Kelly weight
}

interface PortfolioResult {
  rows: PortfolioRow[];
  rPct: number;
  rSource: string;
  from: string;
  to: string;
  n: number;
}

/** Fase 3 adelantada (crítica #9): F* = Σ⁻¹(μ − r·1) con datos reales. */
export default function CarteraView() {
  const { state } = useKelly();
  const [tickersText, setTickersText] = useState("AAPL, MSFT, SPY");
  const [windowDays, setWindowDays] = useState(252);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PortfolioResult | null>(null);

  const compute = async () => {
    setBusy(true);
    setError(null);
    try {
      const tickers = tickersText
        .split(/[,\s]+/)
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);
      const unique = [...new Set(tickers)];
      if (unique.length < 2 || unique.length > 6) {
        throw new Error("Introduzca entre 2 y 6 tickers separados por comas.");
      }
      const [prices, rf] = await Promise.all([
        Promise.all(unique.map((t) => fetchPrices(t, windowDays + 80))),
        fetchRiskFree(),
      ]);
      const aligned = alignSeries(prices, windowDays);
      const returns = aligned.closes.map((c) => logReturns(c));
      const estimates = returns.map((r) => estimateMuSigma(r));
      const cov = covMatrix(returns);
      const r = rf.ratePct / 100;
      const weights = fStarPortfolio({ mu: estimates.map((e) => e.muAnnual), r, cov });
      setResult({
        rows: aligned.tickers.map((ticker, i) => ({
          ticker,
          muPct: (estimates[i]?.muAnnual ?? 0) * 100,
          sigmaPct: (estimates[i]?.sigmaAnnual ?? 0) * 100,
          weight: weights[i] ?? 0,
        })),
        rPct: rf.ratePct,
        rSource: rf.source === "treasury" ? `T-Bills al ${rf.asOf}` : "valor por defecto",
        from: aligned.dates[0] ?? "",
        to: aligned.dates[aligned.dates.length - 1] ?? "",
        n: (aligned.dates.length || 1) - 1,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al calcular la cartera.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const totalFull = result?.rows.reduce((s, r) => s + r.weight, 0) ?? 0;
  const mult = state.mult;

  const exportCSV = () => {
    if (!result) return;
    downloadCSV(
      "theorema-kelly_cartera.csv",
      ["ticker", "mu_anual_%", "sigma_anual_%", "peso_full_kelly", `peso_aplicado_${mult.toFixed(2)}x`],
      result.rows.map((r) => [r.ticker, r.muPct.toFixed(2), r.sigmaPct.toFixed(2), r.weight.toFixed(4), (r.weight * mult).toFixed(4)]),
    );
  };

  return (
    <section aria-labelledby="h-cartera">
      <div className="page-head">
        <h1 id="h-cartera">Cartera multiactivo</h1>
        <p>
          Pesos óptimos de Kelly <span className="mono">F* = Σ⁻¹(μ − r·1)</span> estimados desde
          precios históricos reales.
        </p>
      </div>

      <div className="layout">
        <div className="stack">
          <div className="card">
            <div className="card-rule" />
            <div className="card-body">
              <span className="label" style={{ color: "var(--blue-deep)" }}>
                Universo de activos
              </span>
              <div className="field" style={{ marginTop: 12 }}>
                <label className="label" htmlFor="tickers">
                  Tickers (2–6, separados por comas)
                </label>
                <input
                  type="text"
                  id="tickers"
                  value={tickersText}
                  onChange={(e) => setTickersText(e.target.value.toUpperCase())}
                  placeholder="AAPL, MSFT, SPY"
                />
                <p className="hint">Acciones y ETF de EE. UU. (fuente: Stooq/Yahoo, diario).</p>
              </div>
              <div className="field">
                <label className="label" htmlFor="cartera-window">
                  Ventana de estimación
                </label>
                <select
                  id="cartera-window"
                  className="select"
                  value={windowDays}
                  onChange={(e) => setWindowDays(parseInt(e.target.value, 10))}
                >
                  <option value={126}>126 días (6 m)</option>
                  <option value={252}>252 días (1 a)</option>
                  <option value={504}>504 días (2 a)</option>
                </select>
              </div>
              <button type="button" className="btn btn-primary" onClick={compute} disabled={busy}>
                {busy ? "Calculando…" : "Calcular F*"}
              </button>
              {error && <p className="error-msg" role="alert" style={{ marginTop: 12 }}>{error}</p>}
            </div>
          </div>

          <div className="warn ochre">
            <h4>Sensibilidad extrema a μ̂</h4>
            <p>
              Los pesos de Kelly heredan todo el ruido de la estimación de retornos: un error en μ
              pesa ~20× más que un error en covarianza (hallazgo central del capstone). Trate F*
              como un mapa de dirección, no como una orden de ejecución; en la práctica use ½
              Kelly o menos y revise la estabilidad cambiando la ventana.
            </p>
          </div>
        </div>

        <div className="stack">
          {result ? (
            <div className="card">
              <div className="card-rule" />
              <div className="card-body">
                <div className="chart-head">
                  <div>
                    <h3>Pesos óptimos</h3>
                    <span className="label">
                      {result.from} → {result.to} · n={result.n} retornos · r={result.rPct.toFixed(2)} % ({result.rSource})
                    </span>
                  </div>
                  <button type="button" className="btn" onClick={exportCSV}>
                    ↓ CSV
                  </button>
                </div>
                <table className="cmp-table" aria-label="Pesos de la cartera">
                  <thead>
                    <tr>
                      <th scope="col">Activo</th>
                      <th scope="col">μ̂ anual</th>
                      <th scope="col">σ̂ anual</th>
                      <th scope="col">Full Kelly</th>
                      <th scope="col">Aplicado ({mult.toFixed(2)}×)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r) => (
                      <tr key={r.ticker}>
                        <th scope="row">{r.ticker}</th>
                        <td className="num">{r.muPct.toFixed(1)} %</td>
                        <td className="num">{r.sigmaPct.toFixed(1)} %</td>
                        <td className={"num" + (r.weight < 0 ? " neg" : "")}>{fmtPct(r.weight, 1)}</td>
                        <td className={"num" + (r.weight * mult < 0 ? " neg" : "")}>
                          {fmtPct(r.weight * mult, 1)}
                        </td>
                      </tr>
                    ))}
                    <tr className="hl">
                      <th scope="row">Total invertido</th>
                      <td className="num" colSpan={2}></td>
                      <td className="num">{fmtPct(totalFull, 1)}</td>
                      <td className="num">{fmtPct(totalFull * mult, 1)}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop: 16 }}>
                  {result.rows.map((r) => {
                    const applied = r.weight * mult;
                    const width = Math.min(100, Math.abs(applied) * 100);
                    return (
                      <div className="alloc" key={r.ticker}>
                        <div className="row">
                          <span>
                            {r.ticker}
                            {applied < 0 ? " (corto)" : ""}
                          </span>
                          <span>{fmtPct(applied, 1)}</span>
                        </div>
                        <div className="bar">
                          <div
                            className="fill"
                            style={{
                              width: `${width}%`,
                              background: applied < 0 ? "var(--ruin)" : "var(--blue)",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {totalFull * mult > 1 && (
                  <div className="warn ochre" style={{ marginTop: 16 }}>
                    <h4>Cartera apalancada ({fmtPct(totalFull * mult, 0)} invertido)</h4>
                    <p>
                      La suma de pesos aplicados supera el 100 % del capital: implica margen y
                      riesgo de liquidación forzosa. Considere un multiplicador menor (pestaña
                      Criterio) o restringir el universo.
                    </p>
                  </div>
                )}
                {result.rows.some((r) => r.weight < 0) && (
                  <p className="hint" style={{ marginTop: 10 }}>
                    Los pesos negativos indican posición corta óptima según el modelo; esta
                    herramienta no la recomienda para inversores minoristas.
                  </p>
                )}
                <p className="hint" style={{ marginTop: 6 }}>
                  Capital de referencia: {fmtMoney(state.capital)} → asignación aplicada{" "}
                  {fmtMoney(Math.max(0, totalFull * mult) * state.capital)}.
                </p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body">
                <div className="placeholder-box">
                  <p className="formula">F* = Σ⁻¹(μ − r·1)</p>
                  <p className="hint" style={{ marginTop: 8 }}>
                    Introduzca 2–6 tickers y pulse «Calcular F*». Los retornos, la covarianza y la
                    tasa libre de riesgo se obtienen automáticamente.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
