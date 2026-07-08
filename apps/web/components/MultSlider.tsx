"use client";

import { useKelly } from "./KellyProvider";

const PRESETS = [
  { v: 0.25, label: "¼ Kelly" },
  { v: 0.5, label: "½ Kelly" },
  { v: 1, label: "Full" },
  { v: 2, label: "2×" },
];

interface MultSliderProps {
  withPresets?: boolean;
  flat?: boolean;
  idSuffix?: string;
}

/**
 * Fractional-Kelly multiplier (PRD §5.4). Slider + exact numeric entry
 * (critique UX: values like 0.33× must be typeable). Shared state.
 */
export default function MultSlider({ withPresets = false, flat = false, idSuffix = "" }: MultSliderProps) {
  const { state, update } = useKelly();
  const id = "mult" + idSuffix;

  const commit = (v: number) => {
    if (Number.isFinite(v)) update({ mult: Math.min(2, Math.max(0, v)) });
  };

  return (
    <div className={"slider-block" + (flat ? " flat" : "")}>
      <div className="slider-head">
        <label className="label" htmlFor={id}>
          Multiplicador de Kelly (× f*)
        </label>
        <span className="mult-exact">
          <input
            type="number"
            id={id + "-exact"}
            aria-label="Multiplicador exacto"
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
        aria-label="Multiplicador de Kelly"
        min={0}
        max={2}
        step={0.01}
        value={state.mult}
        onChange={(e) => commit(parseFloat(e.target.value))}
      />
      <div className="scale-row" aria-hidden="true">
        <span>0×</span>
        <span>1× = f* óptimo</span>
        <span>2×</span>
      </div>
      {withPresets && (
        <div className="presets" role="group" aria-label="Preajustes de fracción">
          {PRESETS.map((p) => (
            <button key={p.v} type="button" onClick={() => update({ mult: p.v })}>
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
