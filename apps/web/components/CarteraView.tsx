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
  weight: number;
}

interface PortfolioResult {
  rows: PortfolioRow[];
  rPct: number;
  rSourceTreasuryAsOf: string | null;
  from: string;
  to: string;
  n: number;
  muVec: number[];
  covMx: number[][];
}

/** F* = Σ⁻¹(μ − r·1) con datos reales (Fase 3). */
export default function CarteraView() {
  const { state, L, update } = useKelly();
  const P = L.cartera;
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
        throw new Error(P.errTickers);
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
        rSourceTreasuryAsOf: rf.source === "treasury" ? rf.asOf : null,
        from: aligned.dates[0] ?? "",
        to: aligned.dates[aligned.dates.length - 1] ?? "",
        n: (aligned.dates.length || 1) - 1,
        muVec: estimates.map((e) => e.muAnnual),
        covMx: cov,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : P.errGeneric);
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  // Outputs por defecto: calcula la cartera de ejemplo al entrar.
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    void compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalFull = result?.rows.reduce((s, r) => s + r.weight, 0) ?? 0;
  const mult = state.mult;

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
      sourceLabel: P.srcPortfolio(result.rows.map((r) => r.ticker).join(" + ")),
    });
    router.push("/analisis");
  };

  const exportCSV = () => {
    if (!result) return;
    downloadCSV(
      "theorema-kelly_cartera.csv",
      ["ticker", "mu_annual_%", "sigma_annual_%", "full_kelly_weight", `applied_${mult.toFixed(2)}x`],
      result.rows.map((r) => [
        r.ticker,
        r.muPct.toFixed(2),
        r.sigmaPct.toFixed(2),
        r.weight.toFixed(4),
        (r.weight * mult).toFixed(4),
      ]),
    );
  };

  return (
    <section aria-labelledby="h-cartera">
      <div className="page-head">
        <h1 id="h-cartera">{P.title}</h1>
        <p>{P.subtitle}</p>
      </div>

      <div className="layout">
        <div className="stack">
          <div className="card">
            <div className="card-rule" />
            <div className="card-body">
              <span className="label" style={{ color: "var(--blue-deep)" }}>
                {P.universe}
              </span>
              <div className="field" style={{ marginTop: 12 }}>
                <label className="label" htmlFor="tickers">
                  {P.tickersLabel}
                </label>
                <input
                  type="text"
                  id="tickers"
                  value={tickersText}
                  onChange={(e) => setTickersText(e.target.value.toUpperCase())}
                  placeholder="AAPL, MSFT, SPY"
                />
                <p className="hint">{P.tickersHint}</p>
              </div>
              <div className="field">
                <label className="label" htmlFor="cartera-window">
                  {P.windowLabel}
                </label>
                <select
                  id="cartera-window"
                  className="select"
                  value={windowDays}
                  onChange={(e) => setWindowDays(parseInt(e.target.value, 10))}
                >
                  <option value={126}>{P.w126}</option>
                  <option value={252}>{P.w252}</option>
                  <option value={504}>{P.w504}</option>
                </select>
              </div>
              <button type="button" className="btn btn-primary" onClick={compute} disabled={busy}>
                {busy ? P.calcBusy : P.calc}
              </button>
              {error && (
                <p className="error-msg" role="alert" style={{ marginTop: 12 }}>
                  {error}
                </p>
              )}
            </div>
          </div>

          <div className="note">
            <span className="i" aria-hidden="true">
              i
            </span>
            <p>{P.mvo(mult.toFixed(2), mult > 0 ? (1 / mult).toFixed(2) : "∞")}</p>
          </div>

          <div className="warn ochre">
            <h4>{P.sensTitle}</h4>
            <p>{P.sensBody}</p>
          </div>
        </div>

        <div className="stack">
          {result && (
            <div className="card">
              <div className="card-rule sage" />
              <div className="card-body plain-card" aria-live="polite">
                <span className="label" style={{ color: "var(--sage-text)" }}>
                  {L.common.plainLabel}
                </span>
                <p>
                  {P.plainIntro(
                    result.rows.map((r) => r.ticker).join(", "),
                    money(state.capital),
                    mult.toFixed(2),
                  )}
                </p>
                <ul className="plain-list">
                  {result.rows.map((r) => {
                    const applied = r.weight * mult;
                    return (
                      <li key={r.ticker}>
                        <strong
                          className="n"
                          style={{ color: applied < 0 ? "var(--ruin)" : "var(--blue-deep)" }}
                        >
                          {money(Math.abs(applied) * state.capital)}
                        </strong>{" "}
                        {applied < 0 ? P.inShort : P.inAsset} {r.ticker} ({fmtPct(Math.abs(applied), 1)})
                      </li>
                    );
                  })}
                  {totalFull * mult < 1 ? (
                    <li>
                      <strong className="n">{money((1 - totalFull * mult) * state.capital)}</strong>{" "}
                      {P.cashLine}
                    </li>
                  ) : totalFull * mult > 1 ? (
                    <li className="neg">
                      {P.borrowLine}{" "}
                      <strong className="n">{money((totalFull * mult - 1) * state.capital)}</strong>{" "}
                      {P.borrowTag}
                    </li>
                  ) : null}
                </ul>
                <p className="hint">{P.plainHint}</p>
              </div>
            </div>
          )}

          {result ? (
            <div className="card">
              <div className="card-rule" />
              <div className="card-body">
                <div className="chart-head">
                  <div>
                    <h3>{P.weightsTitle}</h3>
                    <span className="label">
                      {P.weightsMeta(
                        result.from,
                        result.to,
                        result.n,
                        result.rPct.toFixed(2),
                        result.rSourceTreasuryAsOf
                          ? P.srcTreasury(result.rSourceTreasuryAsOf)
                          : P.srcDefault,
                      )}
                    </span>
                  </div>
                  <div className="controls-row">
                    <button type="button" className="btn" onClick={exportCSV}>
                      {L.common.csv}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={sendToAnalysis}>
                      {P.sendBtn}
                    </button>
                  </div>
                </div>
                <table className="cmp-table" aria-label={P.tableAria}>
                  <thead>
                    <tr>
                      <th scope="col">{P.colAsset}</th>
                      <th scope="col">{P.colMu}</th>
                      <th scope="col">{P.colSigma}</th>
                      <th scope="col">{P.colFull}</th>
                      <th scope="col">{P.colApplied(mult.toFixed(2))}</th>
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
                      <th scope="row">{P.totalRow}</th>
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
                            {applied < 0 ? P.shortSuffix : ""}
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
                      {P.condensation(top.ticker, share.toFixed(0))}
                    </p>
                  );
                })()}
                {totalFull * mult > 1 && (
                  <div className="warn ochre" style={{ marginTop: 16 }}>
                    <h4>{P.levTitle(fmtPct(totalFull * mult, 0))}</h4>
                    <p>{P.levBody}</p>
                  </div>
                )}
                {result.rows.some((r) => r.weight < 0) && (
                  <p className="hint" style={{ marginTop: 10 }}>
                    {P.shortNote}
                  </p>
                )}
                <p className="hint" style={{ marginTop: 6 }}>
                  {P.capitalRef(
                    fmtMoney(state.capital),
                    fmtMoney(Math.max(0, totalFull * mult) * state.capital),
                  )}
                </p>
                <p className="hint" style={{ marginTop: 6 }}>
                  {P.bridgeNote}
                </p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body">
                <div className="placeholder-box">
                  <p className="formula">F* = Σ⁻¹(μ − r·1)</p>
                  <p className="hint" style={{ marginTop: 8 }}>
                    {P.placeholderHint}
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
