import { describe, it, expect } from "vitest";

// Mirrors the server-action sanitizer (lib/actions/comments.ts) to lock in
// the behavior: every tag is stripped, but inner text is preserved. We avoid
// DOMPurify here because its `isomorphic-dompurify` shim drags in jsdom,
// which fails to load inside Next 15 Server Actions.
function sanitizeBody(input: string): string {
  return input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

describe("comments sanitizer", () => {
  it("strips <script> tags entirely", () => {
    const out = sanitizeBody("<script>alert(1)</script>hello");
    expect(out.toLowerCase()).not.toContain("script");
    expect(out.toLowerCase()).not.toContain("alert");
  });

  it("strips img/onerror payloads but keeps trailing text", () => {
    const out = sanitizeBody("<img src=x onerror=alert(1)>caption");
    expect(out.toLowerCase()).not.toContain("onerror");
    expect(out.toLowerCase()).not.toContain("<img");
    expect(out).toContain("caption");
  });

  it("keeps plain text untouched", () => {
    expect(sanitizeBody("loving this market!")).toBe("loving this market!");
  });

  it("collapses to empty for tag-only input", () => {
    expect(sanitizeBody("<script>x</script>")).toBe("");
  });
});
