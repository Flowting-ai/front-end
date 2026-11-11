import { afterEach, describe, expect, it, vi } from "vitest";
import { isLibraryListUrl, libraryReturnUrl, rememberLibraryReturn } from "./return-to";

const store = new Map<string, string>();
vi.stubGlobal("window", {
  sessionStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  },
});

afterEach(() => store.clear());

describe("library return URL", () => {
  it("accepts only Library list URLs", () => {
    expect(isLibraryListUrl("/library?tab=shared&q=price")).toBe(true);
    expect(isLibraryListUrl("/library/trash")).toBe(true);
    expect(isLibraryListUrl("/library/files/f_1")).toBe(false);
    expect(isLibraryListUrl("//evil.example/library")).toBe(false);
    expect(isLibraryListUrl("https://evil.example/library")).toBe(false);
    expect(isLibraryListUrl("/chat")).toBe(false);
    expect(isLibraryListUrl(null)).toBe(false);
  });

  it("prefers ?from=, then the remembered list, then /library", () => {
    expect(libraryReturnUrl()).toBe("/library");
    rememberLibraryReturn("/library?tab=all&sort=name");
    expect(libraryReturnUrl()).toBe("/library?tab=all&sort=name");
    expect(libraryReturnUrl("/library?tab=shared")).toBe("/library?tab=shared");
    expect(libraryReturnUrl("/settings")).toBe("/library?tab=all&sort=name");
  });

  it("accepts a tab name in ?from=", () => {
    expect(libraryReturnUrl("all")).toBe("/library?tab=all");
    expect(libraryReturnUrl("shared")).toBe("/library?tab=shared");
    expect(libraryReturnUrl("suggested")).toBe("/library");
    expect(libraryReturnUrl("trash")).toBe("/library/trash");
  });

  it("ignores a URL that is not a list", () => {
    rememberLibraryReturn("/library/files/f_1");
    expect(libraryReturnUrl()).toBe("/library");
  });
});
