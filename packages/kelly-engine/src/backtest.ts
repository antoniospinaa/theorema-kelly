/**
 * Historical backtesting (Phase 4, PRD §4).
 *
 * Constant-fraction strategy on a real price series: each period the
 * portfolio holds fraction `f` in the asset and (1 − f) at the risk-free
 * rate (f > 1 borrows at the risk-free rate):
 *
 *   W_t = W_{t−1} · (1 + f·ret_t + (1 − f)·rf)
 *
 * f = 1 is buy & hold. In-sample caveat: if f* was estimated from the same
 * series, the backtest is optimistic by construction — the UI must say so.
 */

export interface BacktestMetrics {
  /** Total return over the window (0.5 = +50%). */
  totalReturn: number;
  /** Compound annual growth rate. −1 means the strategy was wiped out. */
  cagr: number;
  /** Annualized volatility of strategy returns. */
  vol: number;
  /** Maximum peak-to-trough drawdown (positive number). */
  maxDrawdown: number;
  /** Fraction of periods spent below a previous peak. */
  timeUnderwater: number;
  /** Annualized Sharpe ratio of excess returns. */
  sharpe: number;
  /** True if wealth hit zero (leveraged wipeout). */
  ruined: boolean;
}

export interface BacktestResult {
  wealth: Float64Array;
  metrics: BacktestMetrics;
}

export function backtestConstantFraction(
  closes: number[],
  f: number,
  rAnnual: number,
  periodsPerYear = 252,
): BacktestResult {
  const n = closes.length - 1;
  if (n < 10) throw new RangeError(`need at least 11 closes; got ${closes.length}`);
  if (!Number.isFinite(f)) throw new RangeError("f must be finite");

  const rf = rAnnual / periodsPerYear;
  const wealth = new Float64Array(n + 1);
  wealth[0] = 1;

  const stratReturns = new Float64Array(n);
  let w = 1;
  let ruined = false;
  for (let t = 1; t <= n; t++) {
    const p0 = closes[t - 1] as number;
    const p1 = closes[t] as number;
    const assetRet = p1 / p0 - 1;
    const stepRet = f * assetRet + (1 - f) * rf;
    if (!ruined) {
      w *= 1 + stepRet;
      if (w <= 0) {
        w = 0;
        ruined = true;
      }
    }
    wealth[t] = w;
    stratReturns[t - 1] = ruined && w === 0 ? -1 : stepRet;
  }

  // Metrics
  const finalW = wealth[n] as number;
  const totalReturn = finalW - 1;
  const cagr = finalW > 0 ? Math.pow(finalW, periodsPerYear / n) - 1 : -1;

  let sum = 0;
  for (const r of stratReturns) sum += r;
  const mean = sum / n;
  let ss = 0;
  for (const r of stratReturns) ss += (r - mean) * (r - mean);
  const sd = Math.sqrt(ss / (n - 1));
  const vol = sd * Math.sqrt(periodsPerYear);
  const sharpe = sd > 0 ? ((mean - rf) / sd) * Math.sqrt(periodsPerYear) : 0;

  let peak = wealth[0] as number;
  let maxDrawdown = 0;
  let underwater = 0;
  for (let t = 1; t <= n; t++) {
    const wt = wealth[t] as number;
    if (wt > peak) peak = wt;
    else underwater++;
    const dd = peak > 0 ? 1 - wt / peak : 1;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  return {
    wealth,
    metrics: {
      totalReturn,
      cagr,
      vol,
      maxDrawdown,
      timeUnderwater: underwater / n,
      sharpe,
      ruined,
    },
  };
}
