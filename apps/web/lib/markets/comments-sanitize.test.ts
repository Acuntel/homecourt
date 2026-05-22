import { describe, it, expect } from "vitest";
import DOMPurify from "isomorphic-dompurify";

// Mirrors the server-action sanitizer (lib/actions/comments.ts) to lock in the
// behavior: every tag is stripped, but inner text is preserved.
function sanitizeBody(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
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
