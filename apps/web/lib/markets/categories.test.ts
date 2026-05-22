import { describe, expect, it } from "vitest";

import { CATEGORY_ORDER, categoryForZip, isValidCategory, zipsForCategory } from "./categories";

describe("market categories", () => {
  it("includes every advertised category in CATEGORY_ORDER", () => {
    expect(CATEGORY_ORDER).toEqual([
      "all",
      "central",
      "east",
      "north",
      "south",
      "west",
      "closing",
      "new",
      "volatile",
    ]);
  });

  it("maps the 9 Austin ZIPs to their bands", () => {
    expect(categoryForZip("78701")).toBe("central");
    expect(categoryForZip("78704")).toBe("central");
    expect(categoryForZip("78702")).toBe("east");
    expect(categoryForZip("78751")).toBe("east");
    expect(categoryForZip("78757")).toBe("north");
    expect(categoryForZip("78758")).toBe("north");
    expect(categoryForZip("78759")).toBe("north");
    expect(categoryForZip("78745")).toBe("south");
    expect(categoryForZip("73301")).toBe("west");
  });

  it("returns 'all' for unknown ZIPs", () => {
    expect(categoryForZip("90210")).toBe("all");
  });

  it("returns ZIPs for geographic categories only", () => {
    expect(zipsForCategory("central")).toEqual(["78701", "78704"]);
    expect(zipsForCategory("all")).toBeUndefined();
    expect(zipsForCategory("closing")).toBeUndefined();
    expect(zipsForCategory("new")).toBeUndefined();
    expect(zipsForCategory("volatile")).toBeUndefined();
  });

  it("validates category strings", () => {
    expect(isValidCategory("central")).toBe(true);
    expect(isValidCategory("volatile")).toBe(true);
    expect(isValidCategory("bogus")).toBe(false);
    expect(isValidCategory("")).toBe(false);
  });
});
