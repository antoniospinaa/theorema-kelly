import { describe, expect, it } from "vitest";
import {
  growthBinary,
  medianPath,
  mulberry32,
  pathStats,
  simulateBinary,
  simulateContinuous,
} from "../src/index";

const BIN = { p: 0.55, b: 1 };

describe("simulateBinary", () => {
  it("is deterministic under an injected RNG", () => {
    const a = simulateBinary(0.1, BIN, { trials: 5, steps: 50, rng: mulberry32(42) });
    const b = simulateBinary(0.1, BIN, { trials: 5, steps: 50, rng: mulberry32(42) });
    expect(Array.from(a[3] as Float64Array)).toEqual(Array.from(b[3] as Float64Array));
  });

  it("empirical log-growth matches theoretical G(f*) within 15%", () => {
    const paths = simulateBinary(0.1, BIN, { trials: 2000, steps: 200, rng: mulberry32(7) });
    let sum = 0;
    for (const row of paths) sum += Math.log(row[200] as number) / 200;
    const empirical = sum / paths.length;
    const theoretical = growthBinary(0.1, BIN);
    expect(Math.abs(empirical - theoretical) / theoretical).toBeLessThan(0.15);
  });

  it("overbetting at 2f* yields lower median terminal wealth than f*", () => {
    const opt = pathStats(simulateBinary(0.1, BIN, { trials: 1500, steps: 400, rng: mulberry32(1) }));
    const over = pathStats(simulateBinary(0.2, BIN, { trials: 1500, steps: 400, rng: mulberry32(1) }));
    expect(over.growth).toBeLessThan(opt.growth);
  });
});

describe("simulateContinuous", () => {
  it("median terminal wealth grows at roughly g(f) for the Merton model", () => {
    const params = { mu: 0.08, r: 0.03, sigma: 0.2 };
    const f = 0.5;
    const paths = simulateContinuous(f, params, { trials: 3000, steps: 250, rng: mulberry32(11), dt: 1 / 250 });
    const m = medianPath(paths);
    const gEmpirical = Math.log(m[250] as number); // one simulated year
    const gTheoretical = 0.03 + f * 0.05 - 0.5 * f * f * 0.04;
    expect(Math.abs(gEmpirical - gTheoretical)).toBeLessThan(0.01);
  });
});

describe("pathStats", () => {
  it("computes drawdown and ruin on a crafted path set", () => {
    const stable = new Float64Array([1, 1.1, 1.21, 1.331]);
    const crash = new Float64Array([1, 0.5, 0.05, 0.04]); // ruined (<0.1)
    const stats = pathStats([stable, crash]);
    expect(stats.ruinProbability).toBeCloseTo(0.5, 12);
    expect(stats.maxDrawdown).toBeGreaterThan(0);
  });

  it("medianPath returns pointwise medians", () => {
    const m = medianPath([
      new Float64Array([1, 2, 3]),
      new Float64Array([1, 4, 5]),
      new Float64Array([1, 6, 100]),
    ]);
    expect(Array.from(m)).toEqual([1, 4, 5]);
  });
});
