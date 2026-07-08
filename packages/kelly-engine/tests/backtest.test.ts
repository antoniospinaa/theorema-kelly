import { describe, expect, it } from "vitest";
import {
  backtestConstantFraction,
  mulberry32,
  portfolioStats,
  fStarPortfolio,
  fStarContinuous,
  simulateContinuous,
  studentT,
  toDrawdowns,
  quantilePath,
} from "../src/index";

describe("backtestConstantFraction", () => {
  const flat = Array.from({ length: 253 }, () => 100); // constant price, 1 year

  it("f=0 grows at the risk-free rate", () => {
    const { metrics } = backtestConstantFraction(flat, 0, 0.04);
    expect(metrics.cagr).toBeCloseTo(Math.pow(1 + 0.04 / 252, 252) - 1, 6);
    expect(metrics.maxDrawdown).toBeCloseTo(0, 10);
  });

  it("f=1 reproduces the asset's total return (buy & hold)", () => {
    const prices = Array.from({ length: 253 }, (_, i) => 100 * Math.pow(1.001, i));
    const { metrics, wealth } = backtestConstantFraction(prices, 1, 0.0);
    const assetTotal = (prices[252] as number) / 100 - 1;
    expect(metrics.totalReturn).toBeCloseTo(assetTotal, 6);
    expect(wealth[0]).toBe(1);
  });

  it("computes drawdown and time underwater on a crafted series", () => {
    // up, crash 50%, recover
    const prices = [100, 110, 121, 60.5, 90, 121, 133.1, 146.41, 160, 170, 180, 190];
    const { metrics } = backtestConstantFraction(prices, 1, 0);
    expect(metrics.maxDrawdown).toBeCloseTo(0.5, 6);
    expect(metrics.timeUnderwater).toBeGreaterThan(0);
    expect(metrics.timeUnderwater).toBeLessThan(1);
  });

  it("2× leverage on a −60% day wipes the account (ruined)", () => {
    const prices = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 40, 60];
    const { metrics, wealth } = backtestConstantFraction(prices, 2, 0);
    expect(metrics.ruined).toBe(true);
    expect(wealth[wealth.length - 1]).toBe(0);
    expect(metrics.cagr).toBe(-1);
  });

  it("rejects series that are too short", () => {
    expect(() => backtestConstantFraction([1, 2, 3], 1, 0)).toThrow(RangeError);
  });
});

describe("portfolioStats", () => {
  const params = {
    mu: [0.1, 0.06],
    r: 0.02,
    cov: [
      [0.04, 0.01],
      [0.01, 0.02],
    ],
  };

  it("full-Kelly weights make the synthetic asset's Merton fraction ≈ 1", () => {
    const w = fStarPortfolio(params);
    const { muAnnual, sigmaAnnual } = portfolioStats(w, params);
    const fSynthetic = fStarContinuous({ mu: muAnnual, r: params.r, sigma: sigmaAnnual });
    expect(fSynthetic).toBeCloseTo(1, 8);
  });

  it("single asset with w=1 returns the asset's own μ and σ", () => {
    const s = portfolioStats([1], { mu: [0.1], r: 0.02, cov: [[0.04]] });
    expect(s.muAnnual).toBeCloseTo(0.1, 12);
    expect(s.sigmaAnnual).toBeCloseTo(0.2, 12);
  });
});

describe("studentT fat tails", () => {
  it("has ~unit variance and fatter tails than Gaussian", () => {
    const rng = mulberry32(99);
    const N = 30000;
    let sum = 0;
    let sum2 = 0;
    let extreme = 0;
    for (let i = 0; i < N; i++) {
      const x = studentT(rng, 4);
      sum += x;
      sum2 += x * x;
      if (Math.abs(x) > 3) extreme++;
    }
    const variance = sum2 / N - (sum / N) ** 2;
    expect(variance).toBeGreaterThan(0.85);
    expect(variance).toBeLessThan(1.2);
    // P(|X|>3) ≈ 0.27% for Gaussian; t(4) normalized is clearly higher.
    expect(extreme / N).toBeGreaterThan(0.005);
  });

  it("rejects df < 3", () => {
    expect(() => studentT(Math.random, 2)).toThrow(RangeError);
  });
});

describe("fat-tail simulation & drawdown paths", () => {
  it("t-shocks produce far more extreme single-step moves than Gaussian", () => {
    const params = { mu: 0.08, r: 0.03, sigma: 0.2 };
    const opts = { trials: 400, steps: 250, dt: 1 / 250 };
    const countExtreme = (paths: Float64Array[]): number => {
      // steps where |log return| exceeds 4 daily sigmas
      const limit = 4 * params.sigma * Math.sqrt(1 / 250);
      let count = 0;
      for (const row of paths) {
        for (let t = 1; t < row.length; t++) {
          if (Math.abs(Math.log((row[t] as number) / (row[t - 1] as number))) > limit) count++;
        }
      }
      return count;
    };
    const normal = countExtreme(simulateContinuous(1, params, { ...opts, rng: mulberry32(5) }));
    const fat = countExtreme(
      simulateContinuous(1, params, { ...opts, rng: mulberry32(5), tails: { df: 3 } }),
    );
    expect(fat).toBeGreaterThan(normal * 3);
  });

  it("toDrawdowns: dd is 0 at new peaks and positive after falls", () => {
    const dd = toDrawdowns([new Float64Array([1, 2, 1.5, 2.5])])[0] as Float64Array;
    expect(dd[0]).toBe(0);
    expect(dd[1]).toBe(0);
    expect(dd[2]).toBeCloseTo(0.25, 12);
    expect(dd[3]).toBe(0);
  });
});
