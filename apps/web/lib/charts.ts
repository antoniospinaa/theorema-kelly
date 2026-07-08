/** Canvas rendering for the G(f) curve and Monte Carlo chart (client-only). */

import type { Mode } from "./state";

function ctx2d(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; W: number; H: number } | null {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W: rect.width, H: rect.height };
}

const cssVar = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export interface GCurveOpts {
  mode: Mode;
  fStar: number;
  fChosen: number;
  growthFn: (f: number) => number;
}

/** X-axis extent of the G(f) chart; shared with CSV export. */
export function gCurveXMax(mode: Mode, fStar: number, fChosen: number): number {
  return fStar > 0
    ? mode === "bin"
      ? Math.min(0.99, Math.max(fStar * 3, fChosen * 1.25, 0.05))
      : Math.max(fStar * 3, fChosen * 1.25, 0.05)
    : 0.5;
}

export function drawGCurve(canvas: HTMLCanvasElement, { mode, fStar, fChosen, growthFn }: GCurveOpts): void {
  const c = ctx2d(canvas);
  if (!c) return;
  const { ctx, W, H } = c;
  ctx.clearRect(0, 0, W, H);

  const xmax = gCurveXMax(mode, fStar, fChosen);

  const N = 240;
  const pts: Array<[number, number]> = [];
  let gmin = 0;
  let gmax = 0;
  for (let i = 0; i <= N; i++) {
    const f = (xmax * i) / N;
    const g = growthFn(f);
    if (Number.isFinite(g)) {
      pts.push([f, g]);
      if (g < gmin) gmin = g;
      if (g > gmax) gmax = g;
    }
  }
  const pad = Math.max((gmax - gmin) * 0.18, 1e-4);
  gmin -= pad;
  gmax += pad;
  const X = (f: number) => (f / xmax) * W;
  const Y = (g: number) => H - ((g - gmin) / (gmax - gmin)) * H;

  // Semantic zones
  if (fStar > 0) {
    ctx.fillStyle = cssVar("--sage-tint");
    ctx.fillRect(0, 0, X(Math.min(fStar, xmax)), H);
    ctx.fillStyle = cssVar("--ochre-tint");
    ctx.fillRect(
      X(Math.min(fStar, xmax)),
      0,
      X(Math.min(2 * fStar, xmax)) - X(Math.min(fStar, xmax)),
      H,
    );
    if (2 * fStar < xmax) {
      ctx.fillStyle = cssVar("--ruin-tint");
      ctx.fillRect(X(2 * fStar), 0, W - X(2 * fStar), H);
    }
  }
  // Grid
  ctx.strokeStyle = "rgba(26,26,27,.06)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const x = (W * i) / 6;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let i = 1; i < 4; i++) {
    const y = (H * i) / 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // Zero line
  ctx.strokeStyle = cssVar("--ink");
  ctx.beginPath();
  ctx.moveTo(0, Y(0));
  ctx.lineTo(W, Y(0));
  ctx.stroke();
  // Curve
  ctx.strokeStyle = cssVar("--blue");
  ctx.lineWidth = 2;
  ctx.beginPath();
  pts.forEach(([f, g], i) => {
    const x = X(f);
    const y = Y(g);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  // f* marker (sage, dashed)
  if (fStar > 0 && fStar <= xmax) {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = cssVar("--sage");
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X(fStar), 0);
    ctx.lineTo(X(fStar), H);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // User marker (deep blue square)
  if (fChosen > 0 && fChosen <= xmax) {
    const ux = X(fChosen);
    const uy = Y(growthFn(fChosen));
    ctx.strokeStyle = cssVar("--ink-70");
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ux, 0);
    ctx.lineTo(ux, H);
    ctx.stroke();
    ctx.fillStyle = cssVar("--blue-deep");
    ctx.fillRect(ux - 4, uy - 4, 8, 8);
    ctx.strokeStyle = cssVar("--paper");
    ctx.strokeRect(ux - 4, uy - 4, 8, 8);
  }
  // Axis labels (tabular mono)
  ctx.fillStyle = cssVar("--ink-55");
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = "left";
  ctx.fillText("0", 4, H - 6);
  ctx.textAlign = "right";
  ctx.fillText(xmax.toFixed(2), W - 4, H - 6);
  if (fStar > 0 && fStar < xmax * 0.9) {
    ctx.textAlign = "center";
    ctx.fillText("f*=" + fStar.toFixed(3), X(fStar), 12);
  }
  ctx.textAlign = "left";
  ctx.fillText((gmax * 100).toFixed(2) + "%", 4, 12);
  ctx.fillText("0%", 4, Y(0) - 4);

  canvas.setAttribute(
    "aria-label",
    `Curva G(f). Máximo en f* = ${(fStar * 100).toFixed(2)} %. Fracción elegida ${(fChosen * 100).toFixed(2)} % con crecimiento ${(growthFn(fChosen) * 100).toFixed(3)} % por período.`,
  );
}

export type SeriesColor = "sage" | "blue" | "ruin" | "ink" | "ochre";

export interface MCSeries {
  values: Float64Array;
  color: SeriesColor;
  dash?: number[];
}

export interface MCDrawOpts {
  steps: number;
  series: MCSeries[];
  /** Optional P10–P90 band for the chosen strategy (critique #5). */
  band?: { lo: Float64Array; hi: Float64Array };
}

const SERIES_VARS: Record<SeriesColor, string> = {
  sage: "--sage",
  blue: "--blue",
  ruin: "--ruin",
  ink: "--ink-70",
  ochre: "--ochre",
};

/** Drawdown-over-time chart (critique F4-#3): 0% at top, deeper is lower. */
export function drawDrawdown(
  canvas: HTMLCanvasElement,
  { steps, median, p90 }: { steps: number; median: Float64Array; p90: Float64Array },
): void {
  const c = ctx2d(canvas);
  if (!c) return;
  const { ctx, W, H } = c;
  ctx.clearRect(0, 0, W, H);

  let maxDd = 0.05;
  for (const v of p90) if (v > maxDd) maxDd = v;
  maxDd *= 1.15;
  const X = (t: number) => (t / steps) * W;
  const Y = (dd: number) => (dd / maxDd) * H; // 0 at top, deeper drawdown lower

  // Grid
  ctx.strokeStyle = "rgba(26,26,27,.06)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const x = (W * i) / 8;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let i = 1; i < 4; i++) {
    const y = (H * i) / 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // Median area fill
  ctx.fillStyle = cssVar("--blue-tint");
  ctx.beginPath();
  ctx.moveTo(0, Y(0));
  for (let t = 0; t <= steps; t++) ctx.lineTo(X(t), Y(median[t] ?? 0));
  ctx.lineTo(W, Y(0));
  ctx.closePath();
  ctx.fill();
  // Median line (blue)
  ctx.strokeStyle = cssVar("--blue");
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let t = 0; t <= steps; t++) {
    const x = X(t);
    const y = Y(median[t] ?? 0);
    if (t === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // P90 line (ruin, dashed)
  ctx.strokeStyle = cssVar("--ruin");
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  for (let t = 0; t <= steps; t++) {
    const x = X(t);
    const y = Y(p90[t] ?? 0);
    if (t === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Labels
  ctx.fillStyle = cssVar("--ink-55");
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = "left";
  ctx.fillText("0%", 4, 12);
  ctx.fillText("−" + (maxDd * 100).toFixed(0) + "%", 4, H - 6);
  ctx.textAlign = "right";
  ctx.fillText("t=" + steps, W - 4, H - 6);
}

export function drawMonteCarlo(canvas: HTMLCanvasElement, { steps, series, band }: MCDrawOpts): void {
  const c = ctx2d(canvas);
  if (!c) return;
  const { ctx, W, H } = c;
  ctx.clearRect(0, 0, W, H);

  let lo = Infinity;
  let hi = -Infinity;
  const consider = (arr: Float64Array) => {
    for (const v of arr) {
      const l = Math.log10(Math.max(v, 1e-4));
      if (l < lo) lo = l;
      if (l > hi) hi = l;
    }
  };
  series.forEach((s) => consider(s.values));
  if (band) {
    consider(band.lo);
    consider(band.hi);
  }
  const pad = Math.max((hi - lo) * 0.12, 0.02);
  lo -= pad;
  hi += pad;
  const X = (t: number) => (t / steps) * W;
  const Y = (w: number) => H - ((Math.log10(Math.max(w, 1e-4)) - lo) / (hi - lo)) * H;

  // Grid
  ctx.strokeStyle = "rgba(26,26,27,.06)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const x = (W * i) / 8;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let i = 1; i < 5; i++) {
    const y = (H * i) / 5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // P10–P90 band (under everything else)
  if (band) {
    ctx.fillStyle = cssVar("--blue-tint");
    ctx.beginPath();
    for (let t = 0; t <= steps; t++) {
      const x = X(t);
      const y = Y(band.hi[t] ?? 1);
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let t = steps; t >= 0; t--) {
      ctx.lineTo(X(t), Y(band.lo[t] ?? 1));
    }
    ctx.closePath();
    ctx.fill();
  }
  // W = 1 reference (initial capital)
  ctx.strokeStyle = cssVar("--ink");
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(0, Y(1));
  ctx.lineTo(W, Y(1));
  ctx.stroke();
  ctx.setLineDash([]);
  // Median lines
  series.forEach((s) => {
    ctx.strokeStyle = cssVar(SERIES_VARS[s.color]);
    ctx.lineWidth = 2;
    ctx.setLineDash(s.dash ?? []);
    ctx.beginPath();
    for (let t = 0; t <= steps; t++) {
      const x = X(t);
      const y = Y(s.values[t] ?? 1);
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
  ctx.setLineDash([]);
  // Labels
  ctx.fillStyle = cssVar("--ink-55");
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = "left";
  ctx.fillText("×" + Math.pow(10, hi).toFixed(1), 4, 12);
  ctx.fillText("×1.0", 4, Y(1) - 4);
  ctx.fillText("×" + Math.pow(10, lo).toFixed(2), 4, H - 6);
  ctx.textAlign = "right";
  ctx.fillText("t=" + steps, W - 4, H - 6);
}
