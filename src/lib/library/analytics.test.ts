import { describe, expect, it } from "vitest";
import { isLibraryVital, libraryPageOf } from "./analytics";

describe("libraryPageOf", () => {
  it("names the three Library pages", () => {
    expect(libraryPageOf("/library")).toBe("list");
    expect(libraryPageOf("/library/trash")).toBe("trash");
    expect(libraryPageOf("/library/files/abc")).toBe("file");
  });

  it("is null outside Library, so other routes report nothing", () => {
    expect(libraryPageOf("/chat")).toBeNull();
    expect(libraryPageOf("/library-old")).toBeNull();
  });
});

describe("isLibraryVital", () => {
  it("keeps only the Core Web Vitals", () => {
    expect(["LCP", "CLS", "INP", "FCP", "TTFB"].filter(isLibraryVital)).toEqual(["LCP", "CLS", "INP"]);
  });
});
