"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { expectedMaxLosingStreak, fStarBinary } from "kelly-engine";
import { useKelly } from "./KellyProvider";
import MultSlider from "./MultSlider";
import BacktestCard from "./BacktestCard";
import { drawDrawdown, drawMonteCarlo, type MCSeries, type SeriesColor } from "@/lib/charts";
import { runMonteCarlo, type MonteCarloResult, type SimSettings } from "@/lib/simulation";
import { downloadCSV, downloadJSON } from "@/lib/export";
import { fmtMoney, fmtPct } from "@/lib/format";
import { money } from "@/lib/plain";

const SERIES_STYLE: Record<string, { color: SeriesColor; dash?: number[] }> = {
  full: { color: "sage" },
  chosen: { color: "blue", dash: [5, 4] },
  double: { color: "ruin" },
  buyhold: { color: "ink", dash: [2, 3] },
};

export default function AnalisisView() {
  const { state, derived, L } = useKelly();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ddCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastResult = useRef<MonteCarloResult | null>(null);
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [settings, setSettings] = useState<SimSettings>({ steps: 250, trials: 400, fatTails: false });

  const A = L.analisis;
  const isLab = state.view === "lab";

  const stepOptions =
    state.mode === "bin"
      ? [100, 250, 500, 1000].map((v) => ({ v, label: A.stepsBets(v) }))
      : [
          { v: 125, label: A.stepsDays(125, A.y6m) },
          { v: 250, label: A.stepsDays(250, A.y1) },
          { v: 500, label: A.stepsDays(500, A.y2) },
          { v: 1250, label: A.stepsDays(1250, A.y5) },
        ];

  const paint = useCallback((res: MonteCarloResult | null) => {
    const canvas = canvasRef.current;
    if (canvas) {
      if (!res) {
        canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        const series: MCSeries[] = res.strategies.map((st) => ({
          values: st.median,
          color: SERIES_STYLE[st.key]?.color ?? "ink",
          dash: SERIES_STYLE[st.key]?.dash,
        }));
        drawMonteCarlo(canvas, { steps: res.steps, series, band: res.band });
      }
    }
    const ddCanvas = ddCanvasRef.current;
    if (ddCanvas) {
      if (!res) {
        ddCanvas.getContext("2d")?.clearRect(0, 0, ddCanvas.width, ddCanvas.height);
      } else {
        drawDrawdown(ddCanvas, { steps: res.steps, median: res.dd.median, p90: res.dd.p90 });
      }
    }
  }, []);

  const run = useCallback(() => {
    const res = runMonteCarlo(state, derived, settings);
    lastResult.current = res;
    setResult(res);
    paint(res);
  }, [state, derived, settings, paint]);

  useEffect(() => {
    const t = setTimeout(run, 150);
    return () => clearTimeout(t);
  }, [run]);

  useEffect(() => {
    const ro = new ResizeObserver(() => paint(lastResult.current));
    if (canvasRef.current) ro.observe(canvasRef.current);
    if (ddCanvasRef.current) ro.observe(ddCanvasRef.current);
    return () => ro.disconnect();
  }, [paint, result !== null, isLab]);

  const exportData = (kind: "csv" | "json") => {
    const res = lastResult.current;
    if (!res) return;
    if (kind === "csv") {
      const header = ["t", ...res.strategies.map((s) => s.label.replaceAll(",", ";")), "P10", "P90"];
      const rows: Array<Array<string | number>> = [];
      for (let t = 0; t <= res.steps; t++) {
        rows.push([
          t,
          ...res.strategies.map((s) => (s.median[t] ?? 1).toFixed(6)),
          (res.band.lo[t] ?? 1).toFixed(6),
          (res.band.hi[t] ?? 1).toFixed(6),
        ]);
      }
      downloadCSV("theorema-kelly_montecarlo.csv", header, rows);
    } else {
      downloadJSON("theorema-kelly_montecarlo.json", {
        parameters: state,
        fStar: derived.fStar,
        settings: { steps: res.steps, trials: res.trials },
        strategies: res.strategies.map((s) => ({
          label: s.label,
          fraction: s.fraction,
          stats: s.stats,
          median: Array.from(s.median),
        })),
        band: { p10: Array.from(res.band.lo), p90: Array.from(res.band.hi) },
      });
    }
  };

  const p = state.pPct / 100;
  const sensitivity =
    state.mode === "bin"
      ? [-5, 0, 5].map((dpp) => {
          const pAdj = Math.min(0.999, Math.max(0.001, (state.pPct + dpp) / 100));
          const fs = Math.max(0, fStarBinary({ p: pAdj, b: state.b }));
          return { dpp, pPct: state.pPct + dpp, fs, bet: fs * state.capital };
        })
      : [];

  const chosen = result?.strategies.find((s) => s.key === "chosen");

  return (
    <section aria-labelledby="h-analisis">
      <div className="page-head">
        <h1 id="h-analisis">{A.title}</h1>
        <p>{A.subtitle}</p>
        <p className="status-line" style={{ marginTop: 8 }}>
          {A.simulating} {state.sourceLabel ?? A.manual} ·{" "}
          {state.mode === "cont"
            ? `μ=${state.muPct.toFixed(1)} % · σ=${state.sigmaPct.toFixed(1)} % · r=${state.rPct.toFixed(2)} %`
            : `p=${state.pPct.toFixed(1)} % · b=${state.b}`}{" "}
          {A.changeIn}
        </p>
      </div>

      <div className="layout-analisis">
        <div className="stack">
          {chosen && !derived.noEdge && result && (
            <div className="card">
              <div className="card-rule sage" />
              <div className="card-body plain-card" aria-live="polite">
                <span className="label" style={{ color: "var(--sage-text)" }}>
                  {L.common.plainLabel}
                </span>
                <p>
                  {A.plainIntro(
                    result.trials,
                    result.steps,
                    state.mode === "bin" ? A.unitBets : A.unitDays,
                    state.mult.toFixed(2),
                  )}
                </p>
                <p>
                  {A.plainHalf} <span className="n">{money(state.capital)}</span> {A.plainEndIn}{" "}
                  <strong className={"n " + (chosen.stats.growth >= 0 ? "pos" : "neg")}>
                    {money(state.capital * (1 + chosen.stats.growth))}
                  </strong>{" "}
                  {A.plainOrMore}{" "}
                  <strong className="n neg">
                    {money(state.capital * (1 - chosen.stats.maxDrawdown))}
                  </strong>{" "}
                  {A.plainBeforeRecover}
                </p>
                <p>
                  {Math.round(chosen.stats.ruinProbability * 10000) === 0
                    ? A.plainRuinNone
                    : A.plainRuinSome(
                        Math.round(chosen.stats.ruinProbability * 10000).toLocaleString("en-US"),
                      )}{" "}
                  {A.plainCompare}
                </p>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-rule" />
            <div className="card-body">
              <div className="chart-head">
                <div>
                  <h3>{A.mcTitle}</h3>
                  <span className="label">
                    {derived.noEdge ? A.mcNoEdge : A.mcMeta(result?.trials ?? settings.trials)}
                  </span>
                </div>
                <div className="controls-row">
                  {state.mode === "cont" && (
                    <div className="seg mini" role="group" aria-label={A.shocksAria}>
                      <button
                        type="button"
                        aria-pressed={!settings.fatTails}
                        onClick={() => setSettings((s) => ({ ...s, fatTails: false }))}
                      >
                        {A.normal}
                      </button>
                      <button
                        type="button"
                        aria-pressed={settings.fatTails}
                        title={A.fatTitle}
                        onClick={() => setSettings((s) => ({ ...s, fatTails: true }))}
                      >
                        {A.fat}
                      </button>
                    </div>
                  )}
                  <select
                    aria-label={A.horizonAria}
                    className="select"
                    value={settings.steps}
                    onChange={(e) => setSettings((s) => ({ ...s, steps: parseInt(e.target.value, 10) }))}
                  >
                    {stepOptions.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={A.trialsAria}
                    className="select"
                    value={settings.trials}
                    onChange={(e) => setSettings((s) => ({ ...s, trials: parseInt(e.target.value, 10) }))}
                  >
                    {[200, 400, 1000].map((n) => (
                      <option key={n} value={n}>
                        {A.trialsOpt(n)}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-primary" onClick={run}>
                    {A.resim}
                  </button>
                </div>
              </div>
              <div className="chart-box">
                <span className="axis-y">log W</span>
                <canvas ref={canvasRef} className="mc-canvas" role="img" aria-label={A.mcAria} />
              </div>
              <p className="axis-x">{state.mode === "bin" ? A.tAxisBin : A.tAxisCont}</p>
              <div className="legend" style={{ marginTop: 10 }}>
                <span>
                  <span className="sw line" style={{ background: "var(--sage)" }} />
                  {A.legFull}
                </span>
                <span>
                  <span
                    className="sw line"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg, var(--blue) 0 4px, transparent 4px 8px)",
                    }}
                  />
                  {A.legChosen(state.mult.toFixed(2))}
                </span>
                <span>
                  <span className="sw line" style={{ background: "var(--ruin)" }} />
                  {A.legOver}
                </span>
                {state.mode === "cont" && (
                  <span>
                    <span
                      className="sw line"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(90deg, var(--ink-70) 0 2px, transparent 2px 5px)",
                      }}
                    />
                    {A.legBH}
                  </span>
                )}
                <button type="button" className="btn" onClick={() => exportData("csv")}>
                  {L.common.csv}
                </button>
                <button type="button" className="btn" onClick={() => exportData("json")}>
                  {L.common.json}
                </button>
              </div>
            </div>

            {result && (
              <div className="cmp-wrap">
                <table className="cmp-table" aria-label={A.cmpAria}>
                  <thead>
                    <tr>
                      <th scope="col">{L.common.strategy}</th>
                      <th scope="col">{A.colF}</th>
                      <th scope="col">{A.colGrowth}</th>
                      <th scope="col">{A.colDD}</th>
                      <th scope="col">{A.colRuin}</th>
                      <th scope="col">{A.colSharpe}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.strategies.map((st) => (
                      <tr key={st.key} className={st.key === "chosen" ? "hl" : undefined}>
                        <th scope="row">{st.label}</th>
                        <td className="num">{fmtPct(st.fraction)}</td>
                        <td className={"num " + (st.stats.growth >= 0 ? "pos" : "neg")}>
                          {(st.stats.growth >= 0 ? "+" : "") + (st.stats.growth * 100).toFixed(1)} %
                        </td>
                        <td className="num neg">−{(st.stats.maxDrawdown * 100).toFixed(1)} %</td>
                        <td className={"num" + (st.stats.ruinProbability > 0.01 ? " att" : "")}>
                          {(st.stats.ruinProbability * 100).toFixed(2)} %
                        </td>
                        <td className="num">{st.stats.sharpe.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {isLab && result && !derived.noEdge && (
            <div className="card">
              <div className="card-body">
                <div className="chart-head">
                  <div>
                    <h3>{A.ddTitle}</h3>
                    <span className="label">
                      {A.ddSub(state.mult.toFixed(2))}
                      {settings.fatTails && state.mode === "cont" ? A.ddFat : ""}
                    </span>
                  </div>
                  <div className="legend">
                    <span>
                      <span className="sw line" style={{ background: "var(--blue)" }} />
                      {A.ddMedian}
                    </span>
                    <span>
                      <span
                        className="sw line"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(90deg, var(--ruin) 0 4px, transparent 4px 8px)",
                        }}
                      />
                      {A.ddP90}
                    </span>
                  </div>
                </div>
                <div className="chart-box">
                  <span className="axis-y">DD</span>
                  <canvas ref={ddCanvasRef} className="dd-canvas" role="img" aria-label={A.ddAria} />
                </div>
                <p className="axis-x">{state.mode === "bin" ? A.ddTBin : A.ddTCont}</p>
                <p className="hint" style={{ marginTop: 8 }}>
                  {A.ddHint}
                </p>
              </div>
            </div>
          )}

          {isLab && state.mode === "cont" && <BacktestCard rPct={state.rPct} />}

          {state.mode === "bin" && !derived.noEdge && (
            <div className="card">
              <div className="card-body">
                <span className="label" style={{ color: "var(--blue-deep)", display: "block", marginBottom: 10 }}>
                  {A.binTitle}
                </span>
                <p style={{ marginBottom: 12 }}>
                  {A.streak(settings.steps, state.pPct, expectedMaxLosingStreak(p, settings.steps).toFixed(1))}
                </p>
                {isLab && (
                  <table className="cmp-table" aria-label={A.sensAria}>
                    <thead>
                      <tr>
                        <th scope="col">{A.colScenario}</th>
                        <th scope="col">p</th>
                        <th scope="col">f*</th>
                        <th scope="col">{A.colBet}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sensitivity.map((row) => (
                        <tr key={row.dpp} className={row.dpp === 0 ? "hl" : undefined}>
                          <th scope="row">
                            {row.dpp === 0 ? A.yourEstimate : row.dpp > 0 ? `p +${row.dpp} pp` : `p −${-row.dpp} pp`}
                          </th>
                          <td className="num">{row.pPct.toFixed(1)} %</td>
                          <td className="num">{fmtPct(row.fs)}</td>
                          <td className="num">{fmtMoney(row.bet)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="hint" style={{ marginTop: 8 }}>
                  {A.sensHint}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="stack">
          <div className="panel" style={{ padding: 20 }}>
            <h3 style={{ marginBottom: 14 }}>{A.riskTitle}</h3>
            <MultSlider flat idSuffix="-analisis" />
            <p className="hint" style={{ marginTop: 8 }}>
              {A.currentF} <span className="mono">{fmtPct(derived.fChosen)}</span> (f* ={" "}
              <span className="mono">{fmtPct(derived.fStar)}</span>)
            </p>
            <div className="warn" style={{ marginTop: 16 }}>
              <h4>{A.excessTitle}</h4>
              <p>{A.excessBody}</p>
            </div>
          </div>

          {isLab && (
            <div className="card">
              <div className="card-body">
                <span className="label" style={{ color: "var(--blue-deep)", display: "block", marginBottom: 6 }}>
                  {A.glossTitle}
                </span>
                <ul className="glossary">
                  <li>
                    <span className="sym">f*</span>
                    <p>{A.glossF}</p>
                  </li>
                  <li>
                    <span className="sym">P10/P90</span>
                    <p>{A.glossP}</p>
                  </li>
                  <li>
                    <span className="sym">Σ⁻¹</span>
                    <p>{A.glossSigma}</p>
                  </li>
                  <li>
                    <span className="sym">μ−r</span>
                    <p>{A.glossMu}</p>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
