import { describe, it, expect } from "vitest";

import { formatRelative, formatSignedUsdCents } from "./format";

describe("formatSignedUsdCents", () => {
  it("returns +-prefixed for non-zero values", () => {
    expect(formatSignedUsdCents(125)).toBe("+$1.25");
    expect(formatSignedUsdCents(-250)).toBe("-$2.50");
  });

  it("returns plain $0.00 for zero", () => {
    expect(formatSignedUsdCents(0)).toBe("$0.00");
  });
});

describe("formatRelative", () => {
  it("uses seconds for < 1 minute", () => {
    const now = new Date("2026-05-22T12:00:30Z");
    const past = new Date("2026-05-22T12:00:00Z");
    expect(formatRelative(past, now)).toBe("30s ago");
  });

  it("uses minutes for < 1 hour", () => {
    const now = new Date("2026-05-22T12:30:00Z");
    const past = new Date("2026-05-22T12:00:00Z");
    expect(formatRelative(past, now)).toBe("30m ago");
  });

  it("uses days for < 1 week", () => {
    const now = new Date("2026-05-22T12:00:00Z");
    const past = new Date("2026-05-19T12:00:00Z");
    expect(formatRelative(past, now)).toBe("3d ago");
  });
});
