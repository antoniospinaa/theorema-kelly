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

const SERIES_STYLE: Record<string, { color: SeriesColor; dash?: number[] }> = {
  full: { color: "sage" },
  chosen: { color: "blue", dash: [5, 4] },
  double: { color: "ruin" },
  buyhold: { color: "ink", dash: [2, 3] },
};

export default function AnalisisView() {
  const { state, derived } = useKelly();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ddCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastResult = useRef<MonteCarloResult | null>(null);
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [settings, setSettings] = useState<SimSettings>({ steps: 250, trials: 400, fatTails: false });

  const stepOptions =
    state.mode === "bin"
      ? [
          { v: 100, label: "100 apuestas" },
          { v: 250, label: "250 apuestas" },
          { v: 500, label: "500 apuestas" },
          { v: 1000, label: "1000 apuestas" },
        ]
      : [
          { v: 125, label: "125 días (~6 m)" },
          { v: 250, label: "250 días (~1 año)" },
          { v: 500, label: "500 días (~2 años)" },
          { v: 1250, label: "1250 días (~5 años)" },
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

  // Re-simulate (debounced) whenever parameters or settings change (objetivo 3: interactividad).
  useEffect(() => {
    const t = setTimeout(run, 150);
    return () => clearTimeout(t);
  }, [run]);

  // Redraw on resize without re-simulating.
  useEffect(() => {
    const ro = new ResizeObserver(() => paint(lastResult.current));
    if (canvasRef.current) ro.observe(canvasRef.current);
    if (ddCanvasRef.current) ro.observe(ddCanvasRef.current);
    return () => ro.disconnect();
  }, [paint]);

  const exportData = (kind: "csv" | "json") => {
    const res = lastResult.current;
    if (!res) return;
    if (kind === "csv") {
      const header = ["t", ...res.strategies.map((s) => s.label.replaceAll(",", ";")), "P10 elegida", "P90 elegida"];
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

  /* Extras de trading para modo binario (crítica #8) */
  const p = state.pPct / 100;
  const sensitivity =
    state.mode === "bin"
      ? [-5, 0, 5].map((dpp) => {
          const pAdj = Math.min(0.999, Math.max(0.001, (state.pPct + dpp) / 100));
          const fs = Math.max(0, fStarBinary({ p: pAdj, b: state.b }));
          return { dpp, pPct: state.pPct + dpp, fs, bet: fs * state.capital };
        })
      : [];

  return (
    <section aria-labelledby="h-analisis">
      <div className="page-head">
        <h1 id="h-analisis">Análisis de trayectorias</h1>
        <p>Simulación de Monte Carlo con los parámetros definidos en «Criterio».</p>
      </div>

      <div className="layout-analisis">
        <div className="stack">
          <div className="card">
            <div className="card-rule" />
            <div className="card-body">
              <div className="chart-head">
                <div>
                  <h3>Simulación de Monte Carlo</h3>
                  <span className="label">
                    {derived.noEdge
                      ? "Sin ventaja estadística (f* ≤ 0): nada que simular."
                      : `Mediana + banda P10–P90 (escala log) · n=${result?.trials ?? settings.trials} trayectorias`}
                  </span>
                </div>
                <div className="controls-row">
                  {state.mode === "cont" && (
                    <div className="seg mini" role="group" aria-label="Distribución de los shocks">
                      <button
                        type="button"
                        aria-pressed={!settings.fatTails}
                        onClick={() => setSettings((s) => ({ ...s, fatTails: false }))}
                      >
                        Normal
                      </button>
                      <button
                        type="button"
                        aria-pressed={settings.fatTails}
                        title="Shocks Student-t(4): caídas extremas mucho más frecuentes"
                        onClick={() => setSettings((s) => ({ ...s, fatTails: true }))}
                      >
                        Colas pesadas
                      </button>
                    </div>
                  )}
                  <select
                    aria-label="Horizonte de simulación"
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
                    aria-label="Número de trayectorias"
                    className="select"
                    value={settings.trials}
                    onChange={(e) => setSettings((s) => ({ ...s, trials: parseInt(e.target.value, 10) }))}
                  >
                    <option value={200}>200 trayectorias</option>
                    <option value={400}>400 trayectorias</option>
                    <option value={1000}>1000 trayectorias</option>
                  </select>
                  <button type="button" className="btn btn-primary" onClick={run}>
                    ↻ Re-simular
                  </button>
                </div>
              </div>
              <div className="chart-box">
                <span className="axis-y">log W</span>
                <canvas
                  ref={canvasRef}
                  className="mc-canvas"
                  role="img"
                  aria-label="Trayectorias medianas de riqueza y banda de percentiles 10 a 90 para cada estrategia"
                />
              </div>
              <p className="axis-x">
                t ({state.mode === "bin" ? "apuestas" : "días bursátiles; 250 ≈ 1 año"}) →
              </p>
              <div className="legend" style={{ marginTop: 10 }}>
                <span>
                  <span className="sw line" style={{ background: "var(--sage)" }} />
                  Full Kelly (f*)
                </span>
                <span>
                  <span
                    className="sw line"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg, var(--blue) 0 4px, transparent 4px 8px)",
                    }}
                  />
                  Elegida ({state.mult.toFixed(2)}×) + banda P10–P90
                </span>
                <span>
                  <span className="sw line" style={{ background: "var(--ruin)" }} />
                  Sobreapuesta (2f*)
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
                    Buy &amp; Hold (f=1)
                  </span>
                )}
                <button type="button" className="btn" onClick={() => exportData("csv")}>
                  ↓ CSV
                </button>
                <button type="button" className="btn" onClick={() => exportData("json")}>
                  ↓ JSON
                </button>
              </div>
            </div>

            {/* Tabla comparativa (crítica #2) */}
            {result && (
              <div className="cmp-wrap">
                <table className="cmp-table" aria-label="Comparación de estrategias">
                  <thead>
                    <tr>
                      <th scope="col">Estrategia</th>
                      <th scope="col">f</th>
                      <th scope="col">Crec. mediano</th>
                      <th scope="col">Drawdown máx.</th>
                      <th scope="col">P(ruina &gt;90 %)</th>
                      <th scope="col">Sharpe</th>
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

          {/* Drawdown temporal (crítica F4-#3) */}
          {result && !derived.noEdge && (
            <div className="card">
              <div className="card-body">
                <div className="chart-head">
                  <div>
                    <h3>Drawdown en el tiempo</h3>
                    <span className="label">
                      Estrategia elegida ({state.mult.toFixed(2)}×)
                      {settings.fatTails && state.mode === "cont" ? " · colas pesadas t(4)" : ""}
                    </span>
                  </div>
                  <div className="legend">
                    <span>
                      <span className="sw line" style={{ background: "var(--blue)" }} />
                      Mediana
                    </span>
                    <span>
                      <span
                        className="sw line"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(90deg, var(--ruin) 0 4px, transparent 4px 8px)",
                        }}
                      />
                      P90 (peor decil)
                    </span>
                  </div>
                </div>
                <div className="chart-box">
                  <span className="axis-y">DD</span>
                  <canvas
                    ref={ddCanvasRef}
                    className="dd-canvas"
                    role="img"
                    aria-label="Evolución del drawdown en el tiempo: mediana y percentil 90 de la estrategia elegida"
                  />
                </div>
                <p className="axis-x">
                  t ({state.mode === "bin" ? "apuestas" : "días bursátiles"}) →
                </p>
                <p className="hint" style={{ marginTop: 8 }}>
                  El drawdown máximo puntual esconde la experiencia real: esta curva muestra
                  cuánto tiempo se pasa hundido respecto al pico anterior. Si la línea P90 le
                  resulta intolerable, su fracción es demasiado alta.
                </p>
              </div>
            </div>
          )}

          {/* Backtest histórico (PRD Fase 4) */}
          {state.mode === "cont" && <BacktestCard rPct={state.rPct} />}

          {/* Extras de trading — modo binario (crítica #8) */}
          {state.mode === "bin" && !derived.noEdge && (
            <div className="card">
              <div className="card-body">
                <span className="label" style={{ color: "var(--blue-deep)", display: "block", marginBottom: 10 }}>
                  Riesgo operativo (modo binario)
                </span>
                <p style={{ marginBottom: 12 }}>
                  Racha máxima de pérdidas esperada en {settings.steps} apuestas (p={state.pPct} %):{" "}
                  <span className="mono" style={{ fontWeight: 700 }}>
                    ≈ {expectedMaxLosingStreak(p, settings.steps).toFixed(1)} seguidas
                  </span>
                  . Su fracción y su psicología deben sobrevivir esa racha.
                </p>
                <table className="cmp-table" aria-label="Sensibilidad de f* a la probabilidad">
                  <thead>
                    <tr>
                      <th scope="col">Escenario</th>
                      <th scope="col">p</th>
                      <th scope="col">f*</th>
                      <th scope="col">Apuesta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivity.map((row) => (
                      <tr key={row.dpp} className={row.dpp === 0 ? "hl" : undefined}>
                        <th scope="row">
                          {row.dpp === 0 ? "Su estimación" : row.dpp > 0 ? `p +${row.dpp} pp` : `p −${-row.dpp} pp`}
                        </th>
                        <td className="num">{row.pPct.toFixed(1)} %</td>
                        <td className="num">{fmtPct(row.fs)}</td>
                        <td className="num">{fmtMoney(row.bet)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="hint" style={{ marginTop: 8 }}>
                  Si sobreestima p por 5 puntos, su «óptimo» real puede ser sobreapuesta severa.
                  Las comisiones y el slippage reducen b efectivo: réstelos antes de calcular.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="stack">
          <div className="panel" style={{ padding: 20 }}>
            <h3 style={{ marginBottom: 14 }}>Parámetros de riesgo</h3>
            <MultSlider flat idSuffix="-analisis" />
            <p className="hint" style={{ marginTop: 8 }}>
              f elegida actual: <span className="mono">{fmtPct(derived.fChosen)}</span> (f* ={" "}
              <span className="mono">{fmtPct(derived.fStar)}</span>)
            </p>
            <div className="warn" style={{ marginTop: 16 }}>
              <h4>Advertencia de exceso</h4>
              <p>
                La sobreapuesta <span className="mono">(f &gt; f*)</span> destruye valor geométrico
                de forma irreversible. En el límite, f = 2f* garantiza una tasa de crecimiento de
                cero a largo plazo.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <span className="label" style={{ color: "var(--blue-deep)", display: "block", marginBottom: 6 }}>
                Glosario técnico
              </span>
              <ul className="glossary">
                <li>
                  <span className="sym">f*</span>
                  <p>Fracción óptima de capital que maximiza la log-riqueza esperada.</p>
                </li>
                <li>
                  <span className="sym">P10/P90</span>
                  <p>Percentiles de las trayectorias: el 10 % de los escenarios termina por debajo de P10.</p>
                </li>
                <li>
                  <span className="sym">Σ⁻¹</span>
                  <p>Inversa de la matriz de varianza-covarianza (pestaña Cartera).</p>
                </li>
                <li>
                  <span className="sym">μ−r</span>
                  <p>Retorno excedente sobre la tasa libre de riesgo.</p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
