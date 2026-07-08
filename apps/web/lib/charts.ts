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

export function drawGCurve(canvas: HTMLCanvasElement, { mode, fStar, fChosen, growthFn }: GCurveOpts): void {
  const c = ctx2d(canvas);
  if (!c) return;
  const { ctx, W, H } = c;
  ctx.clearRect(0, 0, W, H);

  const xmax =
    fStar > 0
      ? mode === "bin"
        ? Math.min(0.99, Math.max(fStar * 3, fChosen * 1.25, 0.05))
        : Math.max(fStar * 3, fChosen * 1.25, 0.05)
      : 0.5;

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

export function drawMonteCarlo(canvas: HTMLCanvasElement, medians: Float64Array[], steps: number): void {
  const c = ctx2d(canvas);
  if (!c) return;
  const { ctx, W, H } = c;
  ctx.clearRect(0, 0, W, H);

  let lo = Infinity;
  let hi = -Infinity;
  for (const m of medians) {
    for (const v of m) {
      const l = Math.log10(Math.max(v, 1e-4));
      if (l < lo) lo = l;
      if (l > hi) hi = l;
    }
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
  // W = 1 reference (initial capital)
  ctx.strokeStyle = cssVar("--ink");
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(0, Y(1));
  ctx.lineTo(W, Y(1));
  ctx.stroke();
  ctx.setLineDash([]);
  // Series: full Kelly (sage), chosen (blue dashed), 2× Kelly (ruin)
  const styles: Array<{ color: string; dash: number[] }> = [
    { color: cssVar("--sage"), dash: [] },
    { color: cssVar("--blue"), dash: [5, 4] },
    { color: cssVar("--ruin"), dash: [] },
  ];
  medians.forEach((m, k) => {
    const st = styles[k] ?? styles[0]!;
    ctx.strokeStyle = st.color;
    ctx.lineWidth = 2;
    ctx.setLineDash(st.dash);
    ctx.beginPath();
    for (let t = 0; t <= steps; t++) {
      const x = X(t);
      const y = Y(m[t] ?? 1);
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
