import { describe, expect, it } from "vitest";
import { MAX_TITLE_LENGTH, renameSchema, validateTitle } from "./forms";

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

describe("renameSchema as the request body", () => {
  it("sends only the cleaned title", () => {
    expect(renameSchema.parse({ title: " Policy ", extra: 1 })).toEqual({ title: "Policy" });
  });

  it("refuses a body the form would refuse", () => {
    expect(() => renameSchema.parse({ title: " " })).toThrow();
  });
});
