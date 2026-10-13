import { describe, expect, it } from "vitest";
import { isPdfUrlAllowed, resolvePdfSource } from "./pdf-source";

describe("resolvePdfSource", () => {
  it("decodes an inline PDF without any network request", () => {
    const source = resolvePdfSource("data:application/pdf;base64,JVBERi0=");
    expect(source?.kind).toBe("data");
    if (source?.kind === "data") expect(Array.from(source.data)).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
  });

  it("accepts https storage URLs and same-origin paths", () => {
    expect(resolvePdfSource("https://files.example.com/a.pdf?sig=abc")).toEqual({ kind: "url", url: "https://files.example.com/a.pdf?sig=abc" });
    expect(resolvePdfSource("/api/backend/library/x")).toEqual({ kind: "url", url: "/api/backend/library/x" });
  });

  it("refuses every other scheme", () => {
    for (const bad of ["javascript:alert(1)", "http://insecure.example.com/a.pdf", "data:text/html;base64,PHNjcmlwdD4=", "blob:https://x/abc", "ftp://x/a.pdf", ""]) {
      expect(resolvePdfSource(bad)).toBeNull();
    }
  });

  it("returns null for a malformed data URL instead of throwing", () => {
    expect(resolvePdfSource("data:application/pdf;base64,@@@")).toBeNull();
  });
});

describe("isPdfUrlAllowed", () => {
  it("agrees with resolvePdfSource without decoding anything", () => {
    expect(isPdfUrlAllowed("data:application/pdf;base64,JVBERi0=")).toBe(true);
    expect(isPdfUrlAllowed("https://files.example.com/a.pdf")).toBe(true);
    expect(isPdfUrlAllowed("/api/backend/x")).toBe(true);
    expect(isPdfUrlAllowed("javascript:alert(1)")).toBe(false);
    expect(isPdfUrlAllowed("http://insecure.example.com/a.pdf")).toBe(false);
  });
});
