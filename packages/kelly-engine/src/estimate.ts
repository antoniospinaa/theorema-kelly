/**
 * Parameter estimation from historical prices (Phase 2, PRD §7).
 *
 * Estimates the arithmetic drift μ and volatility σ that the continuous
 * (Merton) formulation expects, from daily closing prices:
 *
 *   ℓ_t = ln(P_t / P_{t−1})            (log returns)
 *   σ̂  = std(ℓ) · √K                   (annualized, K periods/year)
 *   μ̂  = mean(ℓ)·K + σ̂²/2             (arithmetic drift from log drift)
 *
 * WARNING (capstone finding): estimation error in μ is ~20× more damaging
 * to Kelly allocations than error in Σ. Estimates from short windows are
 * noisy; the UI must surface this.
 */

export const TRADING_DAYS_PER_YEAR = 252;

/** Log returns from a price series (drops non-positive prices defensively). */
export function logReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const a = prices[i - 1] as number;
    const b = prices[i] as number;
    if (a > 0 && b > 0) out.push(Math.log(b / a));
  }
  return out;
}

export interface MuSigmaEstimate {
  /** Annualized arithmetic expected return (decimal). */
  muAnnual: number;
  /** Annualized volatility (decimal). */
  sigmaAnnual: number;
  /** Number of return observations used. */
  n: number;
}

export function estimateMuSigma(
  returns: number[],
  periodsPerYear: number = TRADING_DAYS_PER_YEAR,
): MuSigmaEstimate {
  const n = returns.length;
  if (n < 2) throw new RangeError(`need at least 2 returns; got ${n}`);
  let sum = 0;
  for (const r of returns) sum += r;
  const mean = sum / n;
  let ss = 0;
  for (const r of returns) ss += (r - mean) * (r - mean);
  const variance = ss / (n - 1); // sample variance
  const sigmaAnnual = Math.sqrt(variance * periodsPerYear);
  const muAnnual = mean * periodsPerYear + (sigmaAnnual * sigmaAnnual) / 2;
  return { muAnnual, sigmaAnnual, n };
}

/**
 * Annualized covariance matrix of log returns.
 * `series` is an array of aligned return series (same length, same dates).
 */
export function covMatrix(
  series: number[][],
  periodsPerYear: number = TRADING_DAYS_PER_YEAR,
): number[][] {
  const k = series.length;
  if (k === 0) throw new RangeError("need at least one series");
  const n = (series[0] as number[]).length;
  if (n < 2) throw new RangeError("series too short");
  for (const s of series) {
    if (s.length !== n) throw new RangeError("series must be aligned (equal length)");
  }
  const means = series.map((s) => s.reduce((a, b) => a + b, 0) / n);
  const cov: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = i; j < k; j++) {
      let ss = 0;
      const si = series[i] as number[];
      const sj = series[j] as number[];
      const mi = means[i] as number;
      const mj = means[j] as number;
      for (let t = 0; t < n; t++) ss += ((si[t] as number) - mi) * ((sj[t] as number) - mj);
      const c = (ss / (n - 1)) * periodsPerYear;
      (cov[i] as number[])[j] = c;
      (cov[j] as number[])[i] = c;
    }
  }
  return cov;
}

/**
 * Expected maximum losing streak in `trials` independent bets with win
 * probability `p` (classic approximation: log_{1/q}(n)).
 */
export function expectedMaxLosingStreak(p: number, trials: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError(`p must be in (0,1); got ${p}`);
  if (!(trials >= 1)) throw new RangeError(`trials must be ≥ 1; got ${trials}`);
  const q = 1 - p;
  return Math.log(trials) / Math.log(1 / q);
}
