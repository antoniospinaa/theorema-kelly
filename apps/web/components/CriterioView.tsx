"use client";

import { useEffect, useRef } from "react";
import { useKelly } from "./KellyProvider";
import NumField from "./NumField";
import MultSlider from "./MultSlider";
import { drawGCurve } from "@/lib/charts";
import { fmtGrowth, fmtMoney, fmtPct } from "@/lib/format";

export default function CriterioView() {
  const { state, derived, update } = useKelly();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () =>
      drawGCurve(canvas, {
        mode: state.mode,
        fStar: derived.fStar,
        fChosen: derived.fChosen,
        growthFn: derived.growthFn,
      });
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [state, derived]);

  const { fStar, fChosen, g, doubling, noEdge, regime } = derived;
  const timeUnit = state.mode === "bin" ? "per." : "años";
  const overbetting = !noEdge && state.mult > 1.0001;

  return (
    <section aria-labelledby="h-criterio">
      <div className="page-head">
        <h1 id="h-criterio">Criterio de Kelly</h1>
        <p>Cálculo de la fracción óptima de capital y la tasa de crecimiento geométrico G(f).</p>
      </div>

      <div className="layout">
        {/* Parámetros */}
        <div className="stack">
          <div className="card">
            <div className="card-rule" />
            <div className="card-body">
              <span className="label" style={{ color: "var(--blue-deep)" }}>
                Parámetros de entrada
              </span>

              <div className="seg" role="group" aria-label="Modelo matemático">
                <button
                  type="button"
                  aria-pressed={state.mode === "bin"}
                  onClick={() => update({ mode: "bin" })}
                >
                  Apuesta binaria
                </button>
                <button
                  type="button"
                  aria-pressed={state.mode === "cont"}
                  onClick={() => update({ mode: "cont" })}
                >
                  Activo continuo
                </button>
              </div>

              <NumField
                id="capital"
                label="Capital inicial (bankroll)"
                unit="USD"
                value={state.capital}
                min={0}
                step={100}
                onCommit={(n) => update({ capital: n })}
              />

              {state.mode === "bin" ? (
                <fieldset>
                  <div className="grid-2">
                    <NumField
                      id="pwin"
                      label="Prob. de ganar (p)"
                      unit="%"
                      hint="En porcentaje: 55 = 55 %."
                      value={state.pPct}
                      min={0.1}
                      max={99.9}
                      step={0.1}
                      onCommit={(n) => update({ pPct: n })}
                    />
                    <NumField
                      id="payb"
                      label="Pago (b)"
                      unit="a 1"
                      hint="Ganancia neta por unidad apostada."
                      value={state.b}
                      min={0.01}
                      step={0.1}
                      onCommit={(n) => update({ b: n })}
                    />
                  </div>
                </fieldset>
              ) : (
                <fieldset>
                  <div className="grid-2">
                    <NumField
                      id="mu"
                      label="Retorno esperado (μ)"
                      unit="% a."
                      value={state.muPct}
                      min={-100}
                      max={200}
                      step={0.5}
                      onCommit={(n) => update({ muPct: n })}
                    />
                    <NumField
                      id="sigma"
                      label="Volatilidad (σ)"
                      unit="% a."
                      value={state.sigmaPct}
                      min={0.1}
                      max={300}
                      step={0.5}
                      onCommit={(n) => update({ sigmaPct: n })}
                    />
                  </div>
                  <NumField
                    id="rfree"
                    label="Tasa libre de riesgo (r)"
                    unit="% a."
                    value={state.rPct}
                    min={-10}
                    max={50}
                    step={0.25}
                    onCommit={(n) => update({ rPct: n })}
                  />
                </fieldset>
              )}

              <MultSlider withPresets />
            </div>
          </div>

          <div className="note">
            <span className="i" aria-hidden="true">
              i
            </span>
            <p>
              El criterio de Kelly maximiza el logaritmo de la riqueza a largo plazo. En la
              práctica se recomienda operar con ½ Kelly o menos: reduce poco el crecimiento y
              mucho la volatilidad.
            </p>
          </div>
        </div>

        {/* Resultados */}
        <div className="stack">
          <div className="card">
            <div className="card-rule sage" />
            <div className="bet-card" aria-live="polite">
              <div>
                <span className="label">Apuesta sugerida (f elegida × capital)</span>
                <output className="mono">{fmtMoney(fChosen * state.capital)}</output>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="label">Fracción aplicada</span>
                <output className="mono frac">{fmtPct(fChosen)}</output>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-rule" />
            <div className="card-body">
              <div className="chart-head">
                <span className="label" style={{ color: "var(--blue-deep)" }}>
                  Esquema G(f) — tasa de crecimiento logarítmica
                </span>
                <div className="legend">
                  <span>
                    <span className="sw" style={{ background: "var(--sage-tint)" }} />
                    Crecimiento
                  </span>
                  <span>
                    <span className="sw" style={{ background: "var(--ochre-tint)" }} />
                    Sobreapuesta
                  </span>
                  <span>
                    <span className="sw" style={{ background: "var(--ruin-tint)" }} />
                    Ruina
                  </span>
                </div>
              </div>
              <div className="chart-box">
                <span className="axis-y">G(f)</span>
                <canvas
                  ref={canvasRef}
                  className="g-canvas"
                  role="img"
                  aria-label="Curva de la tasa de crecimiento G en función de la fracción apostada f"
                />
              </div>
              <p className="axis-x">f (fracción del capital) →</p>
            </div>
            <div className="stat-grid" aria-live="polite">
              <div className="stat alt">
                <span className="label">f* óptimo</span>
                <output className="mono" style={{ color: "var(--blue-deep)" }}>
                  {noEdge ? "0 %" : fmtPct(fStar)}
                </output>
              </div>
              <div className="stat">
                <span className="label">f elegida</span>
                <output className="mono">{fmtPct(fChosen)}</output>
              </div>
              <div className="stat alt">
                <span className="label">Crecimiento G(f)</span>
                <output className={"mono " + (g > 0 ? "pos" : g < 0 ? "neg" : "")}>
                  {noEdge ? "—" : fmtGrowth(g)}
                </output>
              </div>
              <div className="stat">
                <span className="label">Tiempo de duplicación</span>
                <output className="mono">
                  {noEdge || !Number.isFinite(doubling) ? "∞" : `${doubling.toFixed(1)} ${timeUnit}`}
                </output>
              </div>
            </div>
          </div>

          {noEdge && (
            <p className="error-msg" role="alert">
              Sin ventaja estadística (f* ≤ 0):{" "}
              {state.mode === "bin"
                ? "la apuesta es desfavorable; la fracción recomendada es f = 0."
                : "el retorno esperado no supera la tasa libre de riesgo. Un f* negativo implicaría una posición corta, fuera del alcance de esta herramienta; la fracción recomendada es f = 0."}
            </p>
          )}

          {!noEdge && state.mode === "cont" && regime === "leveraged" && (
            <div className="warn ochre">
              <h4>Advertencia: apalancamiento implícito (f* &gt; 1)</h4>
              <p>
                Con estos parámetros, la fracción óptima {fmtPct(fStar)} supera el 100 % del
                capital: aplicarla exigiría pedir prestado. Recuerde además que f* es
                extremadamente sensible al error de estimación de μ; en la práctica se recomienda
                una fracción ≤ ½ Kelly.
              </p>
            </div>
          )}

          {overbetting && (
            <div className="warn">
              <h4>Advertencia de sobreapuesta</h4>
              <p>
                Con f &gt; f* el crecimiento esperado disminuye y la volatilidad aumenta. En el
                límite f = 2f* la tasa de crecimiento a largo plazo es cero; más allá, es negativa
                (destrucción geométrica de capital).
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
