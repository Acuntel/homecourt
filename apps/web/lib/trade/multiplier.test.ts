import { describe, expect, it } from "vitest";

import {
  chancePct,
  clampPriceCents,
  formatMultiplier,
  multiplier,
  quote,
  sidePriceCents,
} from "./multiplier";

describe("multiplier math", () => {
  it("prices the NO side as the complement of YES", () => {
    expect(sidePriceCents(57, "YES")).toBe(57);
    expect(sidePriceCents(57, "NO")).toBe(43);
  });

  it("clamps prices into the 1..99 band", () => {
    expect(clampPriceCents(0)).toBe(1);
    expect(clampPriceCents(150)).toBe(99);
    expect(sidePriceCents(99, "NO")).toBe(1);
  });

  it("derives the payout multiplier as 100/price", () => {
    expect(multiplier(57, "YES")).toBeCloseTo(1.754, 3);
    expect(formatMultiplier(multiplier(57, "YES"))).toBe("1.75x");
    expect(chancePct(57, "NO")).toBe(43);
  });

  it("floors contracts to the stake and computes payout", () => {
    // $150 stake at 57¢ → floor(15000/57) = 263 contracts.
    const q = quote(150_00, 57, "YES");
    expect(q.contracts).toBe(263);
    expect(q.costCents).toBe(263 * 57);
    expect(q.payoutCents).toBe(263 * 100);
    expect(q.profitCents).toBe(q.payoutCents - q.costCents);
  });

  it("returns a zero quote for a zero stake", () => {
    const q = quote(0, 57, "YES");
    expect(q.contracts).toBe(0);
    expect(q.payoutCents).toBe(0);
    expect(q.profitCents).toBe(0);
  });
});
