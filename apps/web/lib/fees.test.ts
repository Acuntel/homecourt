import { describe, it, expect } from "vitest";
import { calcFeeCents } from "./fees";

describe("calcFeeCents", () => {
  it("computes 7% of price*(100-price)/100 per share at P=50¢", () => {
    // 0.07 * 50 * 50 / 100 = 1.75 → round 2¢ per share
    expect(calcFeeCents(50, 1)).toBe(Math.round((0.07 * 50 * 50) / 100));
    expect(calcFeeCents(50, 1)).toBe(2);
  });

  it("computes fee at P=10¢ (asymmetric prices)", () => {
    // 0.07 * 10 * 90 / 100 = 0.63 → round 1¢ per share, ×100 = 100
    expect(calcFeeCents(10, 100)).toBe(Math.round((0.07 * 10 * 90) / 100) * 100);
    expect(calcFeeCents(10, 100)).toBe(100);
  });

  it("computes fee at P=99¢ (edge of valid range)", () => {
    // 0.07 * 99 * 1 / 100 = 0.0693 → round 0¢ per share
    expect(calcFeeCents(99, 50)).toBe(0);
  });

  it("matches the formula at P=55¢ for 10 shares", () => {
    expect(calcFeeCents(55, 10)).toBe(Math.round((0.07 * 55 * 45) / 100) * 10);
  });

  it("rejects out-of-range prices", () => {
    expect(() => calcFeeCents(0, 1)).toThrow();
    expect(() => calcFeeCents(100, 1)).toThrow();
    expect(() => calcFeeCents(-5, 1)).toThrow();
  });

  it("rejects non-positive qty", () => {
    expect(() => calcFeeCents(50, 0)).toThrow();
    expect(() => calcFeeCents(50, -3)).toThrow();
  });
});
