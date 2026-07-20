"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  covMatrix,
  estimateMuSigma,
  fStarPortfolio,
  logReturns,
  portfolioStats,
} from "kelly-engine";
import { useKelly } from "./KellyProvider";
import { alignSeries, fetchPrices, fetchRiskFree } from "@/lib/market";
import { downloadCSV } from "@/lib/export";
import { fmtMoney, fmtPct } from "@/lib/format";
import { money } from "@/lib/plain";

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
  /** Raw inputs kept for the Cartera → Análisis bridge. */
  muVec: number[];
  covMx: number[][];
}

/** Fase 3 adelantada (crítica #9): F* = Σ⁻¹(μ − r·1) con datos reales. */
export default function CarteraView() {
  const { state, update } = useKelly();
  const router = useRouter();
  const [tickersText, setTickersText] = useState("AAPL, MSFT, SPY");
  const [windowDays, setWindowDays] = useState(252);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PortfolioResult | null>(null);
  const autoRan = useRef(false);

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
        muVec: estimates.map((e) => e.muAnnual),
        covMx: cov,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al calcular la cartera.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  // Outputs por defecto (crítica F4-#2): calcula la cartera de ejemplo al entrar.
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    void compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalFull = result?.rows.reduce((s, r) => s + r.weight, 0) ?? 0;
  const mult = state.mult;

  /** Cartera → Análisis (crítica F4-#4): la cartera full-Kelly como activo sintético. */
  const sendToAnalysis = () => {
    if (!result) return;
    const stats = portfolioStats(
      result.rows.map((r) => r.weight),
      { mu: result.muVec, r: result.rPct / 100, cov: result.covMx },
    );
    update({
      mode: "cont",
      muPct: Math.round(stats.muAnnual * 10000) / 100,
      sigmaPct: Math.round(stats.sigmaAnnual * 10000) / 100,
      rPct: Math.round(result.rPct * 100) / 100,
      sourceLabel: `Cartera: ${result.rows.map((r) => r.ticker).join(" + ")}`,
    });
    router.push("/analisis");
  };

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

          <div className="note">
            <span className="i" aria-hidden="true">
              i
            </span>
            <p>
              <strong>Kelly ≡ Markowitz:</strong> aplicar un multiplicador m a F* equivale a
              resolver el MVO con aversión al riesgo λ = 1/m. Con m = 1 (full Kelly), λ = 1: el
              punto de máximo crecimiento sobre la frontera eficiente. El multiplicador se ajusta
              en la pestaña «Criterio» (actual: {state.mult.toFixed(2)}×, λ ={" "}
              {state.mult > 0 ? (1 / state.mult).toFixed(2) : "∞"}).
            </p>
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
          {result && (
            <div className="card">
              <div className="card-rule sage" />
              <div className="card-body plain-card" aria-live="polite">
                <span className="label" style={{ color: "var(--sage-text)" }}>
                  En palabras simples
                </span>
                <p>
                  El modelo miró el historial de {result.rows.map((r) => r.ticker).join(", ")} y
                  calculó cómo repartiría tu dinero para crecer lo más rápido posible sin
                  quebrar. Con tus {money(state.capital)} y tu multiplicador ({mult.toFixed(2)}×),
                  hoy pondría:
                </p>
                <ul className="plain-list">
                  {result.rows.map((r) => {
                    const applied = r.weight * mult;
                    return (
                      <li key={r.ticker}>
                        <strong className="n" style={{ color: applied < 0 ? "var(--ruin)" : "var(--blue-deep)" }}>
                          {money(Math.abs(applied) * state.capital)}
                        </strong>{" "}
                        {applied < 0 ? "en corto contra" : "en"} {r.ticker} (
                        {fmtPct(Math.abs(applied), 1)})
                      </li>
                    );
                  })}
                  {totalFull * mult < 1 ? (
                    <li>
                      <strong className="n">{money((1 - totalFull * mult) * state.capital)}</strong>{" "}
                      quedan en efectivo / T-Bills
                    </li>
                  ) : totalFull * mult > 1 ? (
                    <li className="neg">
                      pedirías prestado{" "}
                      <strong className="n">{money((totalFull * mult - 1) * state.capital)}</strong>{" "}
                      (apalancamiento — no recomendado)
                    </li>
                  ) : null}
                </ul>
                <p className="hint">
                  «Full Kelly» = lo que el modelo pondría sin frenos; «Aplicado» = con tu
                  multiplicador. μ̂ (retorno) y σ̂ (volatilidad) salen del historial elegido, así
                  que cambian si cambias la ventana — trátalos como estimaciones, no verdades.
                </p>
              </div>
            </div>
          )}

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
                  <div className="controls-row">
                    <button type="button" className="btn" onClick={exportCSV}>
                      ↓ CSV
                    </button>
                    <button type="button" className="btn btn-primary" onClick={sendToAnalysis}>
                      Simular en Análisis →
                    </button>
                  </div>
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
                {(() => {
                  const gross = result.rows.reduce((s, r) => s + Math.abs(r.weight * mult), 0);
                  if (gross <= 0) return null;
                  const top = result.rows.reduce((a, b) =>
                    Math.abs(a.weight) >= Math.abs(b.weight) ? a : b,
                  );
                  const share = (Math.abs(top.weight * mult) / gross) * 100;
                  return (
                    <p className="hint" style={{ marginTop: 10 }}>
                      Condensación de cartera: {top.ticker} concentra el {share.toFixed(0)} % de la
                      exposición bruta — Kelly multivariado tiende a concentrar en los activos con
                      mejor μ̂/σ̂, otra razón para tratar los pesos con escepticismo.
                    </p>
                  );
                })()}
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
                <p className="hint" style={{ marginTop: 6 }}>
                  «Simular en Análisis» trata la cartera full-Kelly como un activo sintético
                  (μ_p, σ_p): su f* es exactamente 1, así que el multiplicador escala la cartera
                  completa — Monte Carlo multiactivo con banda de percentiles, drawdown y colas
                  pesadas incluidos.
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
