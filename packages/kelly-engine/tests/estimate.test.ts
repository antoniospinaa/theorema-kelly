import { describe, expect, it } from "vitest";
import {
  covMatrix,
  estimateMuSigma,
  expectedMaxLosingStreak,
  logReturns,
  quantilePath,
  mulberry32,
  gaussian,
} from "../src/index";

describe("logReturns", () => {
  it("computes ln(P_t / P_{t-1})", () => {
    const r = logReturns([100, 110, 99]);
    expect(r[0]).toBeCloseTo(Math.log(1.1), 12);
    expect(r[1]).toBeCloseTo(Math.log(0.9), 12);
  });

  it("skips non-positive prices defensively", () => {
    expect(logReturns([100, 0, 100]).length).toBe(0);
  });
});

describe("estimateMuSigma", () => {
  it("recovers parameters of a synthetic GBM within tolerance", () => {
    // Generate 5 years of synthetic daily prices with known μ, σ.
    const muTrue = 0.1;
    const sigmaTrue = 0.2;
    const dt = 1 / 252;
    const rng = mulberry32(123);
    const prices = [100];
    for (let t = 0; t < 252 * 5; t++) {
      const drift = (muTrue - 0.5 * sigmaTrue * sigmaTrue) * dt;
      const shock = sigmaTrue * Math.sqrt(dt) * gaussian(rng);
      prices.push((prices[prices.length - 1] as number) * Math.exp(drift + shock));
    }
    const est = estimateMuSigma(logReturns(prices));
    expect(est.sigmaAnnual).toBeGreaterThan(0.17);
    expect(est.sigmaAnnual).toBeLessThan(0.23);
    expect(est.muAnnual).toBeGreaterThan(-0.05); // μ is inherently noisy (20:1)
    expect(est.muAnnual).toBeLessThan(0.25);
    expect(est.n).toBe(252 * 5);
  });

  it("rejects series that are too short", () => {
    expect(() => estimateMuSigma([0.01])).toThrow(RangeError);
  });
});

describe("covMatrix", () => {
  it("diagonal equals annualized variances; matrix is symmetric", () => {
    const a = [0.01, -0.02, 0.015, 0.005, -0.01];
    const b = [0.02, -0.01, 0.01, 0.0, -0.02];
    const cov = covMatrix([a, b], 252);
    const est = estimateMuSigma(a, 252);
    expect((cov[0] as number[])[0]).toBeCloseTo(est.sigmaAnnual ** 2, 10);
    expect((cov[0] as number[])[1]).toBeCloseTo((cov[1] as number[])[0] as number, 12);
  });

  it("perfectly correlated series give cov = var", () => {
    const a = [0.01, -0.02, 0.03, -0.01];
    const cov = covMatrix([a, a], 1);
    expect((cov[0] as number[])[1]).toBeCloseTo((cov[0] as number[])[0] as number, 12);
  });

  it("rejects misaligned series", () => {
    expect(() => covMatrix([[0.1, 0.2], [0.1]])).toThrow(RangeError);
  });
});

describe("expectedMaxLosingStreak", () => {
  it("p=0.5, n=1000 → ≈ log2(1000) ≈ 10", () => {
    expect(expectedMaxLosingStreak(0.5, 1000)).toBeCloseTo(Math.log2(1000), 6);
  });

  it("higher win rate → shorter streaks", () => {
    expect(expectedMaxLosingStreak(0.6, 250)).toBeLessThan(expectedMaxLosingStreak(0.5, 250));
  });
});

describe("quantilePath", () => {
  const paths = [
    new Float64Array([1, 1, 1]),
    new Float64Array([1, 2, 4]),
    new Float64Array([1, 3, 9]),
  ];

  it("q=0.5 equals the median", () => {
    expect(Array.from(quantilePath(paths, 0.5))).toEqual([1, 2, 4]);
  });

  it("q=0.9 interpolates toward the best path", () => {
    const p90 = quantilePath(paths, 0.9);
    expect(p90[2]).toBeGreaterThan(4);
    expect(p90[2]).toBeLessThanOrEqual(9);
  });

  it("rejects out-of-range q", () => {
    expect(() => quantilePath(paths, 0)).toThrow(RangeError);
    expect(() => quantilePath(paths, 1)).toThrow(RangeError);
  });
});
