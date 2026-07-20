"use client";

import { useKelly } from "./KellyProvider";

interface MultSliderProps {
  withPresets?: boolean;
  flat?: boolean;
  idSuffix?: string;
}

/**
 * Fractional-Kelly multiplier (PRD §5.4). Slider + exact numeric entry.
 * 2× is styled as experimental: it guarantees zero long-run growth.
 */
export default function MultSlider({ withPresets = false, flat = false, idSuffix = "" }: MultSliderProps) {
  const { state, L, update } = useKelly();
  const id = "mult" + idSuffix;

  const presets = [
    { v: 0.25, label: L.mult.quarter, exp: false },
    { v: 0.5, label: L.mult.half, exp: false },
    { v: 1, label: L.mult.full, exp: false },
    { v: 2, label: L.mult.twoX, exp: true },
  ];

  const commit = (v: number) => {
    if (Number.isFinite(v)) update({ mult: Math.min(2, Math.max(0, v)) });
  };

  return (
    <div className={"slider-block" + (flat ? " flat" : "")}>
      <div className="slider-head">
        <label className="label" htmlFor={id}>
          {L.mult.label}
        </label>
        <span className="mult-exact">
          <input
            type="number"
            id={id + "-exact"}
            aria-label={L.mult.exactAria}
            min={0}
            max={2}
            step={0.01}
            value={state.mult}
            onChange={(e) => commit(parseFloat(e.target.value))}
          />
          <span aria-hidden="true">×</span>
        </span>
      </div>
      <input
        type="range"
        id={id}
        aria-label={L.mult.ariaSlider}
        min={0}
        max={2}
        step={0.01}
        value={state.mult}
        onChange={(e) => commit(parseFloat(e.target.value))}
      />
      <div className="scale-row" aria-hidden="true">
        <span>{L.mult.scale0}</span>
        <span>{L.mult.scale1}</span>
        <span>{L.mult.scale2}</span>
      </div>
      {withPresets && (
        <div className="presets" role="group" aria-label={L.mult.presetsAria}>
          {presets.map((p) => (
            <button
              key={p.v}
              type="button"
              className={p.exp ? "exp" : undefined}
              title={p.exp ? L.mult.twoXTitle : undefined}
              onClick={() => update({ mult: p.v })}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
