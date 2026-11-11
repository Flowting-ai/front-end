import { describe, expect, it } from "vitest";
import { libraryRefsFor, markSaveChoice } from "./composer-uploads";

const file = (name: string) => new File(["x"], name, { type: "text/plain" });

describe("libraryRefsFor", () => {
  it("sends files with no ready upload as bytes and no save answer", () => {
    const a = file("a.txt");
    expect(libraryRefsFor([a])).toEqual({ libraryFileIds: [], files: [a], saveToLibrary: undefined });
  });

  it("carries Save from Ask each time", () => {
    const a = file("a.txt");
    markSaveChoice([a], true);
    expect(libraryRefsFor([a]).saveToLibrary).toBe(true);
  });

  it("carries Don't save / Never", () => {
    const a = file("a.txt");
    markSaveChoice([a], false);
    expect(libraryRefsFor([a]).saveToLibrary).toBe(false);
  });

  it("keeps the message's files in the chat if any of them is not to be saved", () => {
    const a = file("a.txt");
    const b = file("b.txt");
    markSaveChoice([a], true);
    markSaveChoice([b], false);
    expect(libraryRefsFor([a, b]).saveToLibrary).toBe(false);
  });
});
