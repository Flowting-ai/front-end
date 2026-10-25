import { describe, expect, it } from "vitest";
import { isPdfUrlAllowed, resolvePdfSource } from "./pdf-source";

describe("resolvePdfSource", () => {
  it("accepts https storage URLs and same-origin paths", () => {
    expect(resolvePdfSource("https://files.example.com/a.pdf?sig=abc")).toEqual({ kind: "url", url: "https://files.example.com/a.pdf?sig=abc" });
    expect(resolvePdfSource("/api/backend/library/x")).toEqual({ kind: "url", url: "/api/backend/library/x" });
  });

  it("refuses every other scheme, inline PDFs included", () => {
    for (const bad of ["javascript:alert(1)", "http://insecure.example.com/a.pdf", "data:application/pdf;base64,JVBERi0=", "data:text/html;base64,PHNjcmlwdD4=", "blob:https://x/abc", "ftp://x/a.pdf", "//evil.example.com/a.pdf", ""]) {
      expect(resolvePdfSource(bad)).toBeNull();
    }
  });
});

describe("isPdfUrlAllowed", () => {
  it("agrees with resolvePdfSource", () => {
    expect(isPdfUrlAllowed("https://files.example.com/a.pdf")).toBe(true);
    expect(isPdfUrlAllowed("/api/backend/x")).toBe(true);
    expect(isPdfUrlAllowed("data:application/pdf;base64,JVBERi0=")).toBe(false);
    expect(isPdfUrlAllowed("javascript:alert(1)")).toBe(false);
    expect(isPdfUrlAllowed("http://insecure.example.com/a.pdf")).toBe(false);
  });
});
