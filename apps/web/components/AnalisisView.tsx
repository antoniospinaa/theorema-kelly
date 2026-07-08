"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useKelly } from "./KellyProvider";
import MultSlider from "./MultSlider";
import { drawMonteCarlo } from "@/lib/charts";
import { runMonteCarlo, type MonteCarloResult } from "@/lib/simulation";
import { fmtPct } from "@/lib/format";

export default function AnalisisView() {
  const { state, derived } = useKelly();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastResult = useRef<MonteCarloResult | null>(null);
  const [result, setResult] = useState<MonteCarloResult | null>(null);

  const run = useCallback(() => {
    const res = runMonteCarlo(state, derived);
    lastResult.current = res;
    setResult(res);
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (res) {
      drawMonteCarlo(canvas, res.medians, res.steps);
    } else {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [state, derived]);

  // Re-simulate (debounced) whenever parameters change.
  useEffect(() => {
    const t = setTimeout(run, 150);
    return () => clearTimeout(t);
  }, [run]);

  // Redraw last result on resize without re-simulating.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const res = lastResult.current;
      if (res) drawMonteCarlo(canvas, res.medians, res.steps);
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  const stats = result?.stats ?? null;

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
                      : `Riqueza mediana (escala log) — n=${result?.trials ?? 400} trayectorias · ${result?.steps ?? 250} períodos`}
                  </span>
                </div>
                <button type="button" className="btn btn-primary" onClick={run}>
                  ↻ Ejecutar de nuevo
                </button>
              </div>
              <div className="chart-box">
                <span className="axis-y">log W</span>
                <canvas
                  ref={canvasRef}
                  className="mc-canvas"
                  role="img"
                  aria-label="Trayectorias medianas de riqueza para Kelly completo, fracción elegida y doble Kelly"
                />
              </div>
              <p className="axis-x">t (períodos) →</p>
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
                  Elegida ({state.mult.toFixed(2)}×)
                </span>
                <span>
                  <span className="sw line" style={{ background: "var(--ruin)" }} />
                  Sobreapuesta (2f*)
                </span>
              </div>
            </div>
            <div className="stat-grid" aria-live="polite">
              <div className="stat alt">
                <span className="label">Crecimiento final (mediana)</span>
                <output className={"mono " + (stats && stats.growth >= 0 ? "pos" : "neg")}>
                  {stats ? (stats.growth >= 0 ? "+" : "") + (stats.growth * 100).toFixed(1) + " %" : "—"}
                </output>
              </div>
              <div className="stat">
                <span className="label">Drawdown máx. (mediana)</span>
                <output className="mono neg">
                  {stats ? "−" + (stats.maxDrawdown * 100).toFixed(1) + " %" : "—"}
                </output>
              </div>
              <div className="stat alt">
                <span className="label">Prob. de ruina (&gt;90 % pérdida)</span>
                <output className={"mono " + (stats && stats.ruinProbability > 0.01 ? "att" : "")}>
                  {stats ? (stats.ruinProbability * 100).toFixed(2) + " %" : "—"}
                </output>
              </div>
              <div className="stat">
                <span className="label">Sharpe (por horizonte)</span>
                <output className="mono">{stats ? stats.sharpe.toFixed(2) : "—"}</output>
              </div>
            </div>
          </div>

          <div className="grid-2cards">
            <div className="card">
              <div className="card-body">
                <div className="chart-head" style={{ marginBottom: 8 }}>
                  <span className="label" style={{ color: "var(--blue-deep)" }}>
                    Optimizador de cartera
                  </span>
                  <span className="tag">Fase 3</span>
                </div>
                <div className="placeholder-box">
                  <p className="formula">F* = Σ⁻¹(μ − r·1)</p>
                  <p className="hint" style={{ marginTop: 8 }}>
                    Kelly multivariable. El motor ya existe en{" "}
                    <span className="mono">kelly-engine/portfolio</span>; la interfaz llega en la
                    Fase 3.
                  </p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-body">
                <div className="chart-head" style={{ marginBottom: 8 }}>
                  <span className="label" style={{ color: "var(--blue-deep)" }}>
                    Asignación de cartera
                  </span>
                  <span className="tag">Datos de ejemplo</span>
                </div>
                {[
                  { name: "Activo_A (Renta variable)", pct: 42, cash: false },
                  { name: "Activo_B (Cripto)", pct: 18, cash: false },
                  { name: "Activo_C (Materias primas)", pct: 12, cash: false },
                  { name: "Liquidez (efectivo)", pct: 28, cash: true },
                ].map((a) => (
                  <div className="alloc" key={a.name}>
                    <div className="row">
                      <span>{a.name}</span>
                      <span>{a.pct}%</span>
                    </div>
                    <div className="bar">
                      <div className={"fill" + (a.cash ? " cash" : "")} style={{ width: `${a.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
                  <span className="sym">G(f)</span>
                  <p>Tasa de crecimiento logarítmica esperada por período.</p>
                </li>
                <li>
                  <span className="sym">Σ⁻¹</span>
                  <p>Inversa de la matriz de varianza-covarianza (caso multiactivo).</p>
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
