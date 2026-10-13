import { describe, expect, it } from "vitest";
import { safeAssetUrl } from "./safe-url";

describe("safeAssetUrl", () => {
  it("allows https, same-origin paths and blob URLs", () => {
    expect(safeAssetUrl("https://files.example.com/a.png?sig=1", "image")).toBe("https://files.example.com/a.png?sig=1");
    expect(safeAssetUrl("/api/backend/library/x", "audio")).toBe("/api/backend/library/x");
    expect(safeAssetUrl("blob:https://app.example.com/abc", "audio")).toBe("blob:https://app.example.com/abc");
  });

  it("allows data: only for images", () => {
    expect(safeAssetUrl("data:image/svg+xml;charset=utf-8,%3Csvg%3E", "image")).not.toBeNull();
    expect(safeAssetUrl("data:image/png;base64,AAAA", "image")).not.toBeNull();
    expect(safeAssetUrl("data:audio/wav;base64,AAAA", "audio")).toBeNull();
    expect(safeAssetUrl("data:text/html;base64,PHNjcmlwdD4=", "image")).toBeNull();
  });

  it("refuses script and insecure schemes, protocol-relative URLs and empty values", () => {
    for (const bad of ["javascript:alert(1)", "http://insecure.example.com/a.png", "//evil.example.com/a.png", "ftp://x/a", "file:///etc/passwd", "", null, undefined]) {
      expect(safeAssetUrl(bad as string | null | undefined, "image")).toBeNull();
    }
  });
});
