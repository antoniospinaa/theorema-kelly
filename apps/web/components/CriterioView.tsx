"use client";

import { useEffect, useRef, useState } from "react";
import { useKelly } from "./KellyProvider";
import NumField from "./NumField";
import MultSlider from "./MultSlider";
import PlainSummaryCard from "./PlainSummaryCard";
import { drawGCurve, gCurveXMax } from "@/lib/charts";
import { fmtGrowth, fmtMoney, fmtPct } from "@/lib/format";
import { estimateWindow, fetchPrices, fetchRiskFree } from "@/lib/market";
import { downloadCSV } from "@/lib/export";
import type { KellyState } from "@/lib/state";

/* --- Ejemplos precargados (crítica UX: onboarding) ----------------- */
const EXAMPLES: Array<{ label: string; patch: Partial<KellyState> }> = [
  { label: "Moneda sesgada", patch: { mode: "bin", pPct: 55, b: 1, mult: 0.5, sourceLabel: "Ejemplo: moneda sesgada 55/45" } },
  { label: "Acción típica", patch: { mode: "cont", muPct: 8, sigmaPct: 20, rPct: 4, mult: 0.5, sourceLabel: "Ejemplo: acción típica" } },
  { label: "Cripto", patch: { mode: "cont", muPct: 30, sigmaPct: 70, rPct: 4, mult: 0.25, sourceLabel: "Ejemplo: cripto" } },
];

/* --- Perfiles de supuestos (modo continuo) --------------------------- */
const PROFILES: Array<{ label: string; patch: Partial<KellyState> }> = [
  { label: "Conservador", patch: { muPct: 6, sigmaPct: 12, mult: 0.25, sourceLabel: "Perfil conservador" } },
  { label: "Base", patch: { muPct: 8, sigmaPct: 18, mult: 0.5, sourceLabel: "Perfil base" } },
  { label: "Agresivo", patch: { muPct: 12, sigmaPct: 30, mult: 0.5, sourceLabel: "Perfil agresivo" } },
];

/** CTA de la tarjeta de plausibilidad: lleva los supuestos a un rango prudente. */
function conservativePatch(s: KellyState): Partial<KellyState> {
  if (s.mode === "cont") {
    return {
      muPct: Math.min(s.muPct, s.rPct + 6),
      sigmaPct: Math.max(s.sigmaPct, 15),
      mult: Math.min(s.mult, 0.5),
    };
  }
  return { pPct: Math.min(s.pPct, 55), mult: Math.min(s.mult, 0.5) };
}

/* --- Presets de apuesta binaria (objetivo 2 de Fase 2) -------------- */
const BET_PRESETS: Array<{ id: string; label: string; pPct?: number; b?: number; note: string }> = [
  { id: "custom", label: "Personalizada", note: "Introduzca p y b manualmente." },
  { id: "coin", label: "Moneda justa", pPct: 50, b: 1, note: "Sin ventaja: f* = 0. Referencia educativa." },
  { id: "biased", label: "Moneda sesgada 55/45", pPct: 55, b: 1, note: "El ejemplo clásico del paper: f* = 10 %." },
  { id: "bj", label: "Blackjack con conteo", pPct: 50.8, b: 1, note: "Ventaja típica de un contador: ~0.8 % por mano (aprox. pago 1:1)." },
  { id: "roulette", label: "Ruleta europea (rojo/negro)", pPct: 48.65, b: 1, note: "18/37 de ganar: ventaja negativa — la casa siempre gana. f* = 0." },
  { id: "sports", label: "Cuota deportiva 2.50", pPct: 45, b: 1.5, note: "b = cuota decimal − 1. La p es SU estimación: el edge real depende de que su 45 % sea mejor que el implícito de la cuota (40 %)." },
];

/* --- Validación de plausibilidad (crítica #1) ------------------------ */
function plausibilityWarnings(s: KellyState): string[] {
  const w: string[] = [];
  if (s.mode === "cont") {
    if (s.sigmaPct < 5)
      w.push(
        `σ = ${s.sigmaPct} % anual es inusualmente baja. Rangos típicos: acciones 15–30 %, ETF amplios 10–20 %, bonos 5–10 %, cripto 50–100 %. Una σ subestimada infla f* de forma peligrosa.`,
      );
    if (s.muPct - s.rPct > 20)
      w.push(
        `Un exceso de retorno μ−r = ${(s.muPct - s.rPct).toFixed(1)} % anual sostenido es extraordinario (el S&P 500 histórico ronda 5–7 %). Verifique la estimación: el error en μ pesa ~20× más que el error en σ.`,
      );
  } else if (s.pPct > 60 && s.b >= 1) {
    w.push(
      `p = ${s.pPct} % con pago ${s.b}:1 es una ventaja enorme y rara en apuestas reales. Si p está sobreestimada, el f* calculado le hará sobreapostar.`,
    );
  }
  return w;
}

export default function CriterioView() {
  const { state, derived, update } = useKelly();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* Estimador de mercado (objetivo 1 de Fase 2 / crítica #7) */
  const [ticker, setTicker] = useState("AAPL");
  const [windowDays, setWindowDays] = useState(252);
  const [busy, setBusy] = useState(false);
  const [estStatus, setEstStatus] = useState<string | null>(null);
  const [estError, setEstError] = useState<string | null>(null);
  const [betPreset, setBetPreset] = useState("custom");

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
  const isLab = state.view === "lab";
  const timeUnit = state.mode === "bin" ? "per." : "años";
  const overbetting = !noEdge && state.mult > 1.0001;
  const warnings = plausibilityWarnings(state);
  const presetInfo = BET_PRESETS.find((p) => p.id === betPreset);

  const handleEstimate = async () => {
    setBusy(true);
    setEstError(null);
    setEstStatus(null);
    try {
      const data = await fetchPrices(ticker, windowDays + 80);
      const est = estimateWindow(data, windowDays);
      update({
        mode: "cont",
        muPct: Math.round(est.muAnnual * 10000) / 100,
        sigmaPct: Math.round(est.sigmaAnnual * 10000) / 100,
        sourceLabel: `${est.ticker} (historial de ${windowDays} días)`,
      });
      setEstStatus(
        `${est.ticker} (${est.source}) · ${est.from} → ${est.to} · n=${est.n} retornos · cierre ${fmtMoney(est.lastClose)} · μ̂=${(est.muAnnual * 100).toFixed(1)} % · σ̂=${(est.sigmaAnnual * 100).toFixed(1)} %`,
      );
    } catch (e) {
      setEstError(e instanceof Error ? e.message : "Error al estimar.");
    } finally {
      setBusy(false);
    }
  };

  const handleRiskFree = async () => {
    setBusy(true);
    setEstError(null);
    try {
      const rf = await fetchRiskFree();
      update({ rPct: Math.round(rf.ratePct * 100) / 100 });
      setEstStatus(
        rf.source === "treasury"
          ? `Tasa T-Bills (Tesoro EE. UU.): ${rf.ratePct.toFixed(2)} % · dato al ${rf.asOf}`
          : `Fuente del Tesoro no disponible; usando ${rf.ratePct.toFixed(2)} % por defecto.`,
      );
    } catch (e) {
      setEstError(e instanceof Error ? e.message : "Error al consultar la tasa.");
    } finally {
      setBusy(false);
    }
  };

  const exportGCurve = () => {
    const xmax = gCurveXMax(state.mode, fStar, fChosen);
    const rows: Array<Array<string | number>> = [];
    for (let i = 0; i <= 200; i++) {
      const f = (xmax * i) / 200;
      const gv = derived.growthFn(f);
      if (Number.isFinite(gv)) rows.push([f.toFixed(5), gv.toFixed(8)]);
    }
    downloadCSV("theorema-kelly_G-curve.csv", ["f", "G(f)"], rows);
  };

  return (
    <section aria-labelledby="h-criterio">
      <div className="page-head">
        <h1 id="h-criterio">Criterio de Kelly</h1>
        <p>Cálculo de la fracción óptima de capital y la tasa de crecimiento geométrico G(f).</p>
        <div className="examples-row" role="group" aria-label="Ejemplos precargados">
          <span className="label">Ejemplos:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex.label} type="button" className="btn" onClick={() => update(ex.patch)}>
              {ex.label}
            </button>
          ))}
        </div>
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
                  <div className="field">
                    <label className="label" htmlFor="bet-preset">
                      1 · Tipo de apuesta
                    </label>
                    <select
                      id="bet-preset"
                      className="select"
                      value={betPreset}
                      onChange={(e) => {
                        const preset = BET_PRESETS.find((p) => p.id === e.target.value);
                        setBetPreset(e.target.value);
                        if (preset?.pPct !== undefined && preset?.b !== undefined) {
                          update({ pPct: preset.pPct, b: preset.b, sourceLabel: `Apuesta: ${preset.label}` });
                        }
                      }}
                    >
                      {BET_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    {presetInfo && <p className="hint">{presetInfo.note}</p>}
                  </div>
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
                      onCommit={(n) => update({ pPct: n, sourceLabel: null })}
                    />
                    <NumField
                      id="payb"
                      label="Pago (b)"
                      unit="a 1"
                      hint="b = cuota decimal − 1."
                      value={state.b}
                      min={0.01}
                      step={0.1}
                      onCommit={(n) => update({ b: n, sourceLabel: null })}
                    />
                  </div>
                </fieldset>
              ) : (
                <fieldset>
                  <div className="estimator">
                    <span className="label" style={{ color: "var(--blue-deep)" }}>
                      1 · Activo — estimar desde el mercado
                    </span>
                    <div className="estimator-row">
                      <input
                        type="text"
                        aria-label="Ticker del activo"
                        value={ticker}
                        maxLength={12}
                        onChange={(e) => setTicker(e.target.value.toUpperCase())}
                        placeholder="AAPL, MSFT, SPY…"
                      />
                      <select
                        aria-label="Ventana de estimación"
                        className="select"
                        value={windowDays}
                        onChange={(e) => setWindowDays(parseInt(e.target.value, 10))}
                      >
                        <option value={63}>63 días (3 m)</option>
                        <option value={126}>126 días (6 m)</option>
                        <option value={252}>252 días (1 a)</option>
                        <option value={504}>504 días (2 a)</option>
                      </select>
                    </div>
                    <p className="hint">
                      La ventana es cuánto historial de precios se usa para calcular μ̂ y σ̂
                      (252 días ≈ 1 año bursátil). Más corta reacciona rápido pero es más ruidosa.
                    </p>
                    <div className="estimator-row">
                      <button type="button" className="btn btn-primary" onClick={handleEstimate} disabled={busy}>
                        {busy ? "Consultando…" : "Estimar μ y σ"}
                      </button>
                      <button type="button" className="btn" onClick={handleRiskFree} disabled={busy}>
                        r del Tesoro
                      </button>
                    </div>
                    {estStatus && <p className="status-line">{estStatus}</p>}
                    {estError && <p className="hint err">{estError}</p>}
                    <p className="hint">
                      Acciones/ETF: AAPL, SPY… · Cripto: BTC, ETH (se resuelven a BTC-USD,
                      ETH-USD). μ̂ y σ̂ anualizados desde retornos logarítmicos diarios.
                    </p>
                  </div>
                  <div className="field">
                    <span className="label" style={{ display: "block", marginBottom: 6 }}>
                      2 · Supuestos del modelo
                    </span>
                    <div className="examples-row" style={{ marginTop: 0, marginBottom: 10 }} role="group" aria-label="Perfiles de supuestos">
                      {PROFILES.map((p) => (
                        <button key={p.label} type="button" className="btn" onClick={() => update(p.patch)}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid-2">
                    <NumField
                      id="mu"
                      label="Retorno esperado (μ)"
                      unit="% a."
                      hint="Retorno anual esperado; muy sensible al error."
                      value={state.muPct}
                      min={-100}
                      max={200}
                      step={0.5}
                      onCommit={(n) => update({ muPct: n, sourceLabel: null })}
                    />
                    <NumField
                      id="sigma"
                      label="Volatilidad (σ)"
                      unit="% a."
                      hint="Volatilidad anual histórica del activo."
                      value={state.sigmaPct}
                      min={0.1}
                      max={300}
                      step={0.5}
                      onCommit={(n) => update({ sigmaPct: n, sourceLabel: null })}
                    />
                  </div>
                  <NumField
                    id="rfree"
                    label="Tasa libre de riesgo (r)"
                    unit="% a."
                    hint="Referencia sin riesgo (T-Bills); lo que renta no invertir."
                    value={state.rPct}
                    min={-10}
                    max={50}
                    step={0.25}
                    onCommit={(n) => update({ rPct: n })}
                  />
                </fieldset>
              )}

              <span className="label" style={{ display: "block", marginTop: 18 }}>
                3 · Sizing aplicado
              </span>
              <MultSlider withPresets />
            </div>
          </div>

          {warnings.map((w) => (
            <div className="warn ochre strong" key={w.slice(0, 24)}>
              <h4>⚠ Parámetros poco plausibles</h4>
              <p>{w}</p>
              <button
                type="button"
                className="btn"
                style={{ marginTop: 10 }}
                onClick={() => update(conservativePatch(state))}
              >
                Usar rango conservador
              </button>
            </div>
          ))}

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
          <PlainSummaryCard />

          <div className="card">
            <div className="card-rule sage" />
            <div className="card-body" style={{ paddingBottom: 10 }}>
              <span className="label" style={{ color: "var(--blue-deep)" }}>
                {state.mode === "bin" ? "Apuesta sugerida" : "Tamaño de posición estimado"}
              </span>
            </div>
            <div
              className={"stat-grid" + (state.mode === "cont" ? " three" : "")}
              aria-live="polite"
            >
              <div className="stat alt dim">
                <span className="label">Kelly teórico (f* · 1×)</span>
                <output className="mono">{fmtMoney(fStar * state.capital)}</output>
                <span className="sub">{fmtPct(fStar)}</span>
              </div>
              <div className="stat">
                <span className="label">Aplicado ({state.mult.toFixed(2)}×)</span>
                <output className="mono big" style={{ color: "var(--blue-deep)" }}>
                  {fmtMoney(fChosen * state.capital)}
                </output>
                <span className="sub">{fmtPct(fChosen)}</span>
              </div>
              {state.mode === "cont" && (
                <div className="stat alt dim">
                  <span className="label">Sin apalancamiento (f ≤ 1)</span>
                  <output className="mono">
                    {fmtMoney(derived.fNoLeverage * state.capital)}
                  </output>
                  <span className="sub">{fmtPct(derived.fNoLeverage)}</span>
                </div>
              )}
            </div>
            {fChosen > 1 && (
              <p className="hint" style={{ padding: "10px 16px", borderTop: "1px solid var(--hairline)" }}>
                La fracción aplicada supera el 100 % de su capital (requiere margen). La columna
                «Sin apalancamiento» invierte exactamente lo que tiene: como G(f) crece hasta f*,
                invertir el 100 % es el óptimo alcanzable sin pedir prestado, y conserva un
                crecimiento esperado de {fmtGrowth(derived.gNoLeverage)} anual.
              </p>
            )}
          </div>

          {isLab && (
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
                  <button type="button" className="btn" onClick={exportGCurve}>
                    ↓ CSV
                  </button>
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
          )}

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
                Con estos parámetros la fracción óptima {fmtPct(fStar)} supera el 100 % del
                capital: aplicarla exige pedir prestado (margen), lo que añade costo de
                financiamiento y riesgo de <em>margin call</em> — una caída fuerte puede liquidar
                la posición antes de cualquier recuperación. En la práctica, la mayoría de
                inversores minoristas debería limitar f ≤ 1 (sin apalancamiento) y usar ½ Kelly o
                menos, porque f* es extremadamente sensible al error de estimación de μ.
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
