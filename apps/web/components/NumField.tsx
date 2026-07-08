"use client";

import { useState } from "react";

interface NumFieldProps {
  id: string;
  label: string;
  unit: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number | string;
  onCommit: (n: number) => void;
}

/**
 * Numeric input that only commits valid values to shared state.
 * Invalid input keeps the last valid value in state and flags the field.
 */
export default function NumField({
  id,
  label,
  unit,
  hint,
  value,
  min,
  max,
  step,
  onCommit,
}: NumFieldProps) {
  const [raw, setRaw] = useState(String(value));
  const [invalid, setInvalid] = useState(false);

  const handleChange = (v: string) => {
    setRaw(v);
    const n = parseFloat(v);
    const ok =
      Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max);
    setInvalid(!ok);
    if (ok) onCommit(n);
  };

  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={"field" + (invalid ? " invalid" : "")}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="input-wrap">
        <input
          type="number"
          id={id}
          value={raw}
          min={min}
          max={max}
          step={step}
          inputMode="decimal"
          onChange={(e) => handleChange(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={hintId}
        />
        <span className="unit">{unit}</span>
      </div>
      {hint && (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      )}
      {invalid && <p className="hint err">Valor fuera de rango.</p>}
    </div>
  );
}
