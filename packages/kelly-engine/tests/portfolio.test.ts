import { describe, expect, it } from "vitest";
import { fStarContinuous, fStarPortfolio, solveLinearSystem } from "../src/index";

describe("solveLinearSystem", () => {
  it("solves a known 2×2 system", () => {
    // 2x + y = 5 ; x + 3y = 10 → x = 1, y = 3
    const x = solveLinearSystem(
      [
        [2, 1],
        [1, 3],
      ],
      [5, 10],
    );
    expect(x[0]).toBeCloseTo(1, 10);
    expect(x[1]).toBeCloseTo(3, 10);
  });

  it("throws on singular matrices", () => {
    expect(() =>
      solveLinearSystem(
        [
          [1, 2],
          [2, 4],
        ],
        [1, 2],
      ),
    ).toThrow(RangeError);
  });
});

describe("fStarPortfolio — F* = Σ⁻¹(μ − r·1)", () => {
  it("single asset reduces to the Merton fraction", () => {
    const single = fStarPortfolio({ mu: [0.12], r: 0.03, cov: [[0.0625]] });
    expect(single[0]).toBeCloseTo(fStarContinuous({ mu: 0.12, r: 0.03, sigma: 0.25 }), 12);
  });

  it("diagonal Σ decouples into independent Merton fractions", () => {
    const w = fStarPortfolio({
      mu: [0.1, 0.06],
      r: 0.02,
      cov: [
        [0.04, 0],
        [0, 0.01],
      ],
    });
    expect(w[0]).toBeCloseTo(0.08 / 0.04, 12);
    expect(w[1]).toBeCloseTo(0.04 / 0.01, 12);
  });

  it("positive correlation reduces combined allocation vs diagonal case", () => {
    const diag = fStarPortfolio({
      mu: [0.1, 0.1],
      r: 0.02,
      cov: [
        [0.04, 0],
        [0, 0.04],
      ],
    });
    const corr = fStarPortfolio({
      mu: [0.1, 0.1],
      r: 0.02,
      cov: [
        [0.04, 0.03],
        [0.03, 0.04],
      ],
    });
    const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
    expect(sum(corr)).toBeLessThan(sum(diag));
  });
});
