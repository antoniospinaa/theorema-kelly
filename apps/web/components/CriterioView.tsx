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

/** CTA de plausibilidad: lleva los supuestos a un rango prudente. */
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

export default function CriterioView() {
  const { state, derived, L, update } = useKelly();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [ticker, setTicker] = useState("AAPL");
  const [windowDays, setWindowDays] = useState(252);
  const [busy, setBusy] = useState(false);
  const [estStatus, setEstStatus] = useState<string | null>(null);
  const [estError, setEstError] = useState<string | null>(null);
  const [betPreset, setBetPreset] = useState("custom");

  const C = L.criterio;

  const examples: Array<{ label: string; patch: Partial<KellyState> }> = [
    { label: C.exCoin, patch: { mode: "bin", pPct: 55, b: 1, mult: 0.5, sourceLabel: C.srcExCoin } },
    { label: C.exStock, patch: { mode: "cont", muPct: 8, sigmaPct: 20, rPct: 4, mult: 0.5, sourceLabel: C.srcExStock } },
    { label: C.exCrypto, patch: { mode: "cont", muPct: 30, sigmaPct: 70, rPct: 4, mult: 0.25, sourceLabel: C.srcExCrypto } },
  ];

  const profiles: Array<{ label: string; patch: Partial<KellyState> }> = [
    { label: C.profCons, patch: { muPct: 6, sigmaPct: 12, mult: 0.25, sourceLabel: C.srcProf(C.profCons) } },
    { label: C.profBase, patch: { muPct: 8, sigmaPct: 18, mult: 0.5, sourceLabel: C.srcProf(C.profBase) } },
    { label: C.profAggr, patch: { muPct: 12, sigmaPct: 30, mult: 0.5, sourceLabel: C.srcProf(C.profAggr) } },
  ];

  const betPresets: Array<{ id: string; label: string; pPct?: number; b?: number; note: string }> = [
    { id: "custom", label: C.betCustom, note: C.betCustomNote },
    { id: "coin", label: C.betCoin, pPct: 50, b: 1, note: C.betCoinNote },
    { id: "biased", label: C.betBiased, pPct: 55, b: 1, note: C.betBiasedNote },
    { id: "bj", label: C.betBj, pPct: 50.8, b: 1, note: C.betBjNote },
    { id: "roulette", label: C.betRoulette, pPct: 48.65, b: 1, note: C.betRouletteNote },
    { id: "sports", label: C.betSports, pPct: 45, b: 1.5, note: C.betSportsNote },
  ];

  const warnings: string[] = [];
  if (state.mode === "cont") {
    if (state.sigmaPct < 5) warnings.push(C.warnSigmaLow(state.sigmaPct));
    if (state.muPct - state.rPct > 20) warnings.push(C.warnMuHigh((state.muPct - state.rPct).toFixed(1)));
  } else if (state.pPct > 60 && state.b >= 1) {
    warnings.push(C.warnPHigh(state.pPct, state.b));
  }

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
  const timeUnit = state.mode === "bin" ? C.dblBin : C.dblCont;
  const overbetting = !noEdge && state.mult > 1.0001;
  const presetInfo = betPresets.find((p) => p.id === betPreset);

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
        sourceLabel: C.srcTicker(est.ticker, windowDays),
      });
      setEstStatus(
        C.estStatus(
          est.ticker,
          est.source,
          est.from,
          est.to,
          est.n,
          fmtMoney(est.lastClose),
          (est.muAnnual * 100).toFixed(1),
          (est.sigmaAnnual * 100).toFixed(1),
        ),
      );
    } catch (e) {
      setEstError(e instanceof Error ? e.message : C.estError);
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
          ? C.rfStatusTreasury(rf.ratePct.toFixed(2), rf.asOf)
          : C.rfStatusDefault(rf.ratePct.toFixed(2)),
      );
    } catch (e) {
      setEstError(e instanceof Error ? e.message : C.rfError);
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
        <h1 id="h-criterio">{C.title}</h1>
        <p>{C.subtitle}</p>
        <div className="examples-row" role="group" aria-label={C.examplesAria}>
          <span className="label">{C.examplesLabel}</span>
          {examples.map((ex) => (
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
                {C.params}
              </span>

              <div className="seg" role="group" aria-label={C.modelAria}>
                <button
                  type="button"
                  aria-pressed={state.mode === "bin"}
                  onClick={() => update({ mode: "bin" })}
                >
                  {C.modeBin}
                </button>
                <button
                  type="button"
                  aria-pressed={state.mode === "cont"}
                  onClick={() => update({ mode: "cont" })}
                >
                  {C.modeCont}
                </button>
              </div>

              <NumField
                id="capital"
                label={C.capital}
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
                      {C.step1Bet}
                    </label>
                    <select
                      id="bet-preset"
                      className="select"
                      value={betPreset}
                      onChange={(e) => {
                        const preset = betPresets.find((p) => p.id === e.target.value);
                        setBetPreset(e.target.value);
                        if (preset?.pPct !== undefined && preset?.b !== undefined) {
                          update({ pPct: preset.pPct, b: preset.b, sourceLabel: C.srcBet(preset.label) });
                        }
                      }}
                    >
                      {betPresets.map((p) => (
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
                      label={C.pLabel}
                      unit="%"
                      hint={C.pHint}
                      value={state.pPct}
                      min={0.1}
                      max={99.9}
                      step={0.1}
                      onCommit={(n) => update({ pPct: n, sourceLabel: null })}
                    />
                    <NumField
                      id="payb"
                      label={C.bLabel}
                      unit="a 1"
                      hint={C.bHint}
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
                      {C.estTitle}
                    </span>
                    <div className="estimator-row">
                      <input
                        type="text"
                        aria-label={C.tickerAria}
                        value={ticker}
                        maxLength={12}
                        onChange={(e) => setTicker(e.target.value.toUpperCase())}
                        placeholder={C.tickerPh}
                      />
                      <select
                        aria-label={C.windowAria}
                        className="select"
                        value={windowDays}
                        onChange={(e) => setWindowDays(parseInt(e.target.value, 10))}
                      >
                        <option value={63}>{C.w63}</option>
                        <option value={126}>{C.w126}</option>
                        <option value={252}>{C.w252}</option>
                        <option value={504}>{C.w504}</option>
                      </select>
                    </div>
                    <p className="hint">{C.windowHint}</p>
                    <div className="estimator-row">
                      <button type="button" className="btn btn-primary" onClick={handleEstimate} disabled={busy}>
                        {busy ? C.estimatingBtn : C.estimateBtn}
                      </button>
                      <button type="button" className="btn" onClick={handleRiskFree} disabled={busy}>
                        {C.riskFreeBtn}
                      </button>
                    </div>
                    {estStatus && <p className="status-line">{estStatus}</p>}
                    {estError && <p className="hint err">{estError}</p>}
                    <p className="hint">{C.estHint}</p>
                  </div>
                  <div className="field">
                    <span className="label" style={{ display: "block", marginBottom: 6 }}>
                      {C.step2}
                    </span>
                    <div
                      className="examples-row"
                      style={{ marginTop: 0, marginBottom: 10 }}
                      role="group"
                      aria-label={C.profilesAria}
                    >
                      {profiles.map((p) => (
                        <button key={p.label} type="button" className="btn" onClick={() => update(p.patch)}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid-2">
                    <NumField
                      id="mu"
                      label={C.muLabel}
                      unit={C.unitAnnual}
                      hint={C.muHint}
                      value={state.muPct}
                      min={-100}
                      max={200}
                      step={0.5}
                      onCommit={(n) => update({ muPct: n, sourceLabel: null })}
                    />
                    <NumField
                      id="sigma"
                      label={C.sigmaLabel}
                      unit={C.unitAnnual}
                      hint={C.sigmaHint}
                      value={state.sigmaPct}
                      min={0.1}
                      max={300}
                      step={0.5}
                      onCommit={(n) => update({ sigmaPct: n, sourceLabel: null })}
                    />
                  </div>
                  <NumField
                    id="rfree"
                    label={C.rLabel}
                    unit={C.unitAnnual}
                    hint={C.rHint}
                    value={state.rPct}
                    min={-10}
                    max={50}
                    step={0.25}
                    onCommit={(n) => update({ rPct: n })}
                  />
                </fieldset>
              )}

              <span className="label" style={{ display: "block", marginTop: 18 }}>
                {C.step3}
              </span>
              <MultSlider withPresets />
            </div>
          </div>

          {warnings.map((w) => (
            <div className="warn ochre strong" key={w.slice(0, 24)}>
              <h4>{C.plausTitle}</h4>
              <p>{w}</p>
              <button
                type="button"
                className="btn"
                style={{ marginTop: 10 }}
                onClick={() => update(conservativePatch(state))}
              >
                {C.plausCTA}
              </button>
            </div>
          ))}

          <div className="note">
            <span className="i" aria-hidden="true">
              i
            </span>
            <p>{C.noteHalf}</p>
          </div>
        </div>

        {/* Resultados */}
        <div className="stack">
          <PlainSummaryCard />

          <div className="card">
            <div className="card-rule sage" />
            <div className="card-body" style={{ paddingBottom: 10 }}>
              <span className="label" style={{ color: "var(--blue-deep)" }}>
                {state.mode === "bin" ? C.sizingBet : C.sizingPos}
              </span>
            </div>
            <div className={"stat-grid" + (state.mode === "cont" ? " three" : "")} aria-live="polite">
              <div className="stat alt dim">
                <span className="label">{C.statTheo}</span>
                <output className="mono">{fmtMoney(fStar * state.capital)}</output>
                <span className="sub">{fmtPct(fStar)}</span>
              </div>
              <div className="stat">
                <span className="label">{C.statApplied(state.mult.toFixed(2))}</span>
                <output className="mono big" style={{ color: "var(--blue-deep)" }}>
                  {fmtMoney(fChosen * state.capital)}
                </output>
                <span className="sub">{fmtPct(fChosen)}</span>
              </div>
              {state.mode === "cont" && (
                <div className="stat alt dim">
                  <span className="label">{C.statNoLev}</span>
                  <output className="mono">{fmtMoney(derived.fNoLeverage * state.capital)}</output>
                  <span className="sub">{fmtPct(derived.fNoLeverage)}</span>
                </div>
              )}
            </div>
            {fChosen > 1 && (
              <p className="hint" style={{ padding: "10px 16px", borderTop: "1px solid var(--hairline)" }}>
                {C.capNote(fmtGrowth(derived.gNoLeverage))}
              </p>
            )}
          </div>

          {isLab && (
            <div className="card">
              <div className="card-rule" />
              <div className="card-body">
                <div className="chart-head">
                  <span className="label" style={{ color: "var(--blue-deep)" }}>
                    {C.chartTitle}
                  </span>
                  <div className="legend">
                    <span>
                      <span className="sw" style={{ background: "var(--sage-tint)" }} />
                      {C.legendGrowth}
                    </span>
                    <span>
                      <span className="sw" style={{ background: "var(--ochre-tint)" }} />
                      {C.legendOver}
                    </span>
                    <span>
                      <span className="sw" style={{ background: "var(--ruin-tint)" }} />
                      {C.legendRuin}
                    </span>
                    <button type="button" className="btn" onClick={exportGCurve}>
                      {L.common.csv}
                    </button>
                  </div>
                </div>
                <div className="chart-box">
                  <span className="axis-y">G(f)</span>
                  <canvas ref={canvasRef} className="g-canvas" role="img" aria-label={C.chartAria} />
                </div>
                <p className="axis-x">{C.axisF}</p>
              </div>
              <div className="stat-grid" aria-live="polite">
                <div className="stat alt">
                  <span className="label">{C.statFStar}</span>
                  <output className="mono" style={{ color: "var(--blue-deep)" }}>
                    {noEdge ? "0 %" : fmtPct(fStar)}
                  </output>
                </div>
                <div className="stat">
                  <span className="label">{C.statFChosen}</span>
                  <output className="mono">{fmtPct(fChosen)}</output>
                </div>
                <div className="stat alt">
                  <span className="label">{C.statG}</span>
                  <output className={"mono " + (g > 0 ? "pos" : g < 0 ? "neg" : "")}>
                    {noEdge ? "—" : fmtGrowth(g)}
                  </output>
                </div>
                <div className="stat">
                  <span className="label">{C.statDbl}</span>
                  <output className="mono">
                    {noEdge || !Number.isFinite(doubling) ? "∞" : `${doubling.toFixed(1)} ${timeUnit}`}
                  </output>
                </div>
              </div>
            </div>
          )}

          {noEdge && (
            <p className="error-msg" role="alert">
              {C.noEdgeLead}
              {state.mode === "bin" ? C.noEdgeBin : C.noEdgeCont}
            </p>
          )}

          {!noEdge && state.mode === "cont" && regime === "leveraged" && (
            <div className="warn ochre">
              <h4>{C.levTitle}</h4>
              <p>{C.levBody(fmtPct(fStar))}</p>
            </div>
          )}

          {overbetting && (
            <div className="warn">
              <h4>{C.overbetTitle}</h4>
              <p>{C.overbetBody}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
