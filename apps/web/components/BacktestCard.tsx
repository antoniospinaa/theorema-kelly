"use client";

import { useEffect, useRef, useState } from "react";
import { useKelly } from "./KellyProvider";
import { drawMonteCarlo, type MCSeries } from "@/lib/charts";
import { runBacktest, type BacktestData } from "@/lib/backtest";
import { fmtPct } from "@/lib/format";
import { downloadCSV } from "@/lib/export";

/** Backtest histórico (PRD Fase 4): estrategias de fracción constante sobre precios reales. */
export default function BacktestCard({ rPct }: { rPct: number }) {
  const { L } = useKelly();
  const B = L.backtest;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<BacktestData | null>(null);
  const [ticker, setTicker] = useState("SPY");
  const [days, setDays] = useState(1260);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BacktestData | null>(null);

  const stratLabel: Record<string, string> = {
    full: B.stratFull,
    half: B.stratHalf,
    quarter: B.stratQuarter,
    bh: B.stratBH,
  };

  const paint = (d: BacktestData | null) => {
    const canvas = canvasRef.current;
    if (!canvas || !d) return;
    const series: MCSeries[] = d.strategies.map((s) => ({
      values: s.wealth,
      color: s.color,
      dash: s.dash,
    }));
    drawMonteCarlo(canvas, { steps: d.n, series });
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await runBacktest(ticker, days, rPct);
      dataRef.current = d;
      setData(d);
      requestAnimationFrame(() => paint(d));
    } catch (e) {
      setError(e instanceof Error ? e.message : B.error);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => paint(dataRef.current));
    ro.observe(canvas);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data !== null]);

  const exportCSV = () => {
    const d = dataRef.current;
    if (!d) return;
    const header = ["t", ...d.strategies.map((s) => (stratLabel[s.key] ?? s.label).replaceAll(",", ";"))];
    const rows: Array<Array<string | number>> = [];
    for (let t = 0; t <= d.n; t++) {
      rows.push([t, ...d.strategies.map((s) => (s.wealth[t] ?? 1).toFixed(6))]);
    }
    downloadCSV(`theorema-kelly_backtest_${d.ticker}.csv`, header, rows);
  };

  return (
    <div className="card">
      <div className="card-rule" />
      <div className="card-body">
        <div className="chart-head">
          <div>
            <h3>{B.title}</h3>
            <span className="label">{B.sub(rPct.toFixed(2))}</span>
          </div>
          <div className="controls-row">
            <input
              type="text"
              aria-label={B.tickerAria}
              style={{ width: 110 }}
              value={ticker}
              maxLength={12}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
            />
            <select
              aria-label={B.windowAria}
              className="select"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10))}
            >
              <option value={504}>{B.y2}</option>
              <option value={1260}>{B.y5}</option>
            </select>
            <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>
              {busy ? B.running : B.run}
            </button>
          </div>
        </div>

        {error && (
          <p className="error-msg" role="alert">
            {error}
          </p>
        )}

        {data && (
          <>
            <p className="status-line" style={{ marginBottom: 12 }}>
              {B.status(
                data.ticker,
                data.source,
                data.from,
                data.to,
                data.n,
                data.muPct.toFixed(1),
                data.sigmaPct.toFixed(1),
                fmtPct(Math.max(0, data.fStarRaw)),
              )}
            </p>
            {data.fStarRaw <= 0 && (
              <p className="hint err" style={{ marginBottom: 10 }}>
                {B.noEdge}
              </p>
            )}
            <div className="chart-box">
              <span className="axis-y">log W</span>
              <canvas ref={canvasRef} className="mc-canvas" role="img" aria-label={B.chartAria} />
            </div>
            <p className="axis-x">{B.tAxis}</p>
            <div className="legend" style={{ marginTop: 10 }}>
              <span>
                <span className="sw line" style={{ background: "var(--sage)" }} />
                {B.legFull}
              </span>
              <span>
                <span
                  className="sw line"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, var(--blue) 0 4px, transparent 4px 8px)",
                  }}
                />
                {B.legHalf}
              </span>
              <span>
                <span
                  className="sw line"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, var(--ink-70) 0 2px, transparent 2px 5px)",
                  }}
                />
                {B.legQuarter}
              </span>
              <span>
                <span className="sw line" style={{ background: "var(--ochre)" }} />
                {B.legBH}
              </span>
              <button type="button" className="btn" onClick={exportCSV}>
                {L.common.csv}
              </button>
            </div>
          </>
        )}
      </div>

      {data && (
        <>
          <div className="cmp-wrap">
            <table className="cmp-table" aria-label={B.metricsAria}>
              <thead>
                <tr>
                  <th scope="col">{L.common.strategy}</th>
                  <th scope="col">f</th>
                  <th scope="col">{B.colCagr}</th>
                  <th scope="col">{B.colVol}</th>
                  <th scope="col">{B.colDD}</th>
                  <th scope="col">{B.colUw}</th>
                  <th scope="col">{B.colSharpe}</th>
                </tr>
              </thead>
              <tbody>
                {data.strategies.map((s) => (
                  <tr key={s.key}>
                    <th scope="row">
                      {stratLabel[s.key] ?? s.label}
                      {s.metrics.ruined ? " ☠" : ""}
                    </th>
                    <td className="num">{fmtPct(s.fraction, 1)}</td>
                    <td className={"num " + (s.metrics.cagr >= 0 ? "pos" : "neg")}>
                      {(s.metrics.cagr * 100).toFixed(1)} %
                    </td>
                    <td className="num">{(s.metrics.vol * 100).toFixed(1)} %</td>
                    <td className="num neg">−{(s.metrics.maxDrawdown * 100).toFixed(1)} %</td>
                    <td className="num">{(s.metrics.timeUnderwater * 100).toFixed(0)} %</td>
                    <td className="num">{s.metrics.sharpe.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-body" style={{ borderTop: "1px solid var(--hairline)" }}>
            <span className="label" style={{ color: "var(--blue-deep)", display: "block", marginBottom: 8 }}>
              {B.sensTitle}
            </span>
            <table className="cmp-table" aria-label={B.sensAria}>
              <thead>
                <tr>
                  <th scope="col">{L.analisis.colScenario}</th>
                  <th scope="col">μ</th>
                  <th scope="col">f*</th>
                </tr>
              </thead>
              <tbody>
                {data.sensitivity.map((row) => {
                  const label =
                    row.label === "μ̂ estimada" ? B.muEst : row.label === "μ̂ + 2 pp" ? B.muPlus : B.muMinus;
                  return (
                    <tr key={row.label} className={row.label === "μ̂ estimada" ? "hl" : undefined}>
                      <th scope="row">{label}</th>
                      <td className="num">{row.muPct.toFixed(1)} %</td>
                      <td className={"num" + (row.fStar < 0 ? " neg" : "")}>
                        {(row.fStar * 100).toFixed(1)} %
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="hint" style={{ marginTop: 8 }}>
              {B.sensNote}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
