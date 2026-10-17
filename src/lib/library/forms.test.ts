import { describe, expect, it } from "vitest";
import { MAX_TITLE_LENGTH, maxTitleLength, renameSchema, validateTitle } from "./forms";

describe("validateTitle", () => {
  it("trims a good name", () => {
    expect(validateTitle("  Return policy  ")).toEqual({ ok: true, title: "Return policy" });
  });

  it("asks for a name when it is empty or only spaces", () => {
    expect(validateTitle("")).toEqual({ ok: false, error: "Enter a name" });
    expect(validateTitle("   ")).toEqual({ ok: false, error: "Enter a name" });
  });

  it("caps the length", () => {
    expect(validateTitle("a".repeat(MAX_TITLE_LENGTH)).ok).toBe(true);
    expect(validateTitle("a".repeat(MAX_TITLE_LENGTH + 1))).toEqual({ ok: false, error: `Use ${MAX_TITLE_LENGTH} characters or fewer` });
  });
});

describe("validateTitle for a file with an extension", () => {
  it("leaves room for .extension so the server does not cut the name", () => {
    expect(maxTitleLength("pdf")).toBe(251);
    expect(maxTitleLength("")).toBe(MAX_TITLE_LENGTH);
    expect(validateTitle("a".repeat(251), "pdf").ok).toBe(true);
    expect(validateTitle("a".repeat(252), "pdf")).toEqual({ ok: false, error: "Use 251 characters or fewer" });
  });

  it("drops control characters and refuses a name made only of them", () => {
    expect(validateTitle(String.fromCharCode(1, 7, 32, 9), "pdf")).toEqual({ ok: false, error: "Enter a name" });
    expect(validateTitle(`Re${String.fromCharCode(0)}port`, "pdf")).toEqual({ ok: true, title: "Report" });
  });
});

describe("renameSchema as the request body", () => {
  it("sends only the cleaned title", () => {
    expect(renameSchema.parse({ title: " Policy ", extra: 1 })).toEqual({ title: "Policy" });
  });

  it("refuses a body the form would refuse", () => {
    expect(() => renameSchema.parse({ title: " " })).toThrow();
  });
});
