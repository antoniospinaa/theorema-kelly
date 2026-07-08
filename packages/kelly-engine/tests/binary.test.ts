import { describe, expect, it } from "vitest";
import {
  doublingTime,
  fStarBinary,
  growthBinary,
  isFavorable,
  wealthStepBinary,
} from "../src/index";

describe("fStarBinary — fixtures from the capstone paper", () => {
  it("p=0.6, b=1 → f* = 0.20 (paper §4 example)", () => {
    expect(fStarBinary({ p: 0.6, b: 1 })).toBeCloseTo(0.2, 12);
  });

  it("p=0.55, b=1 → f* = 0.10", () => {
    expect(fStarBinary({ p: 0.55, b: 1 })).toBeCloseTo(0.1, 12);
  });

  it("p=0.55, b=2 → f* = 0.325 (regression: mobile mock showed 10%)", () => {
    expect(fStarBinary({ p: 0.55, b: 2 })).toBeCloseTo(0.325, 12);
  });

  it("unfavorable bet (p=0.4, b=1) → f* < 0 and isFavorable = false", () => {
    expect(fStarBinary({ p: 0.4, b: 1 })).toBeLessThan(0);
    expect(isFavorable({ p: 0.4, b: 1 })).toBe(false);
  });

  it("rejects out-of-domain parameters", () => {
    expect(() => fStarBinary({ p: 0, b: 1 })).toThrow(RangeError);
    expect(() => fStarBinary({ p: 1, b: 1 })).toThrow(RangeError);
    expect(() => fStarBinary({ p: 0.5, b: 0 })).toThrow(RangeError);
  });
});

describe("growthBinary", () => {
  const params = { p: 0.55, b: 1 };
  const fStar = fStarBinary(params);

  it("G(f*) > 0 for a favorable bet", () => {
    expect(growthBinary(fStar, params)).toBeGreaterThan(0);
  });

  it("G is maximized at f* (numerical check on neighbors)", () => {
    const g = (f: number) => growthBinary(f, params);
    expect(g(fStar)).toBeGreaterThan(g(fStar - 0.01));
    expect(g(fStar)).toBeGreaterThan(g(fStar + 0.01));
  });

  it("G(2f*) ≈ 0 — overbetting boundary", () => {
    expect(Math.abs(growthBinary(2 * fStar, params))).toBeLessThan(1e-3);
  });

  it("G(f) < 0 well beyond 2f* (geometric capital destruction)", () => {
    expect(growthBinary(0.5, params)).toBeLessThan(0);
  });

  it("returns NaN outside the domain [0, 1)", () => {
    expect(growthBinary(1, params)).toBeNaN();
    expect(growthBinary(-0.1, params)).toBeNaN();
  });
});

describe("doublingTime", () => {
  it("ln2 / G at f* for p=0.55, b=1 ≈ 138.4 trials", () => {
    const g = growthBinary(0.1, { p: 0.55, b: 1 });
    expect(doublingTime(g)).toBeCloseTo(Math.LN2 / g, 12);
    expect(doublingTime(g)).toBeCloseTo(138.4, 0);
  });

  it("Infinity when growth ≤ 0", () => {
    expect(doublingTime(0)).toBe(Infinity);
    expect(doublingTime(-0.01)).toBe(Infinity);
  });
});

describe("wealthStepBinary", () => {
  it("applies win and loss multipliers", () => {
    expect(wealthStepBinary(1, 0.1, { p: 0.55, b: 1 }, 0.1)).toBeCloseTo(1.1, 12);
    expect(wealthStepBinary(1, 0.1, { p: 0.55, b: 1 }, 0.9)).toBeCloseTo(0.9, 12);
  });
});
