import { describe, expect, it } from "vitest";
import {
  classifyFStar,
  doublingTime,
  fStarContinuous,
  growthContinuous,
} from "../src/index";

describe("fStarContinuous (Merton fraction)", () => {
  it("μ=12%, r=3%, σ=25% → f* = 1.44 (implied leverage)", () => {
    expect(fStarContinuous({ mu: 0.12, r: 0.03, sigma: 0.25 })).toBeCloseTo(1.44, 12);
  });

  it("μ=8%, r=3%, σ=30% → f* = 5/9 (standard regime)", () => {
    expect(fStarContinuous({ mu: 0.08, r: 0.03, sigma: 0.3 })).toBeCloseTo(0.05 / 0.09, 12);
  });

  it("μ < r → f* < 0 (implied short)", () => {
    expect(fStarContinuous({ mu: 0.01, r: 0.03, sigma: 0.2 })).toBeLessThan(0);
  });

  it("rejects σ ≤ 0", () => {
    expect(() => fStarContinuous({ mu: 0.1, r: 0.03, sigma: 0 })).toThrow(RangeError);
  });
});

describe("growthContinuous", () => {
  const params = { mu: 0.12, r: 0.03, sigma: 0.25 };
  const fStar = fStarContinuous(params);

  it("g(f*) = r + (μ−r)²/(2σ²) — closed form at the optimum", () => {
    const expected = 0.03 + (0.09 * 0.09) / (2 * 0.0625);
    expect(growthContinuous(fStar, params)).toBeCloseTo(expected, 12);
  });

  it("g is maximized at f*", () => {
    const g = (f: number) => growthContinuous(f, params);
    expect(g(fStar)).toBeGreaterThan(g(fStar - 0.05));
    expect(g(fStar)).toBeGreaterThan(g(fStar + 0.05));
  });

  it("doubling time at f* ≈ 7.3 years for this fixture", () => {
    expect(doublingTime(growthContinuous(fStar, params))).toBeCloseTo(7.3, 1);
  });
});

describe("classifyFStar — PRD §5.2 warning regimes", () => {
  it("flags implied leverage when f* > 1", () => {
    expect(classifyFStar(1.44)).toBe("leveraged");
  });
  it("flags implied short when f* < 0", () => {
    expect(classifyFStar(-0.5)).toBe("short");
  });
  it("standard otherwise", () => {
    expect(classifyFStar(0.6)).toBe("standard");
  });
});
