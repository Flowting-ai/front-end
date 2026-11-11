import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "@/lib/markdown-utils";
import { LibraryCitationsProvider, parseLibraryCitations, preprocessLibraryMarkers, stripLibraryMarkers } from "./library-citations";

const open = { id: "L1", fileId: "f-1", state: "open", title: "Return policy 2026", format: "document", locator: { type: "page", value: "2", passage: "Returns within 30 days." } };

describe("parseLibraryCitations", () => {
  it("keeps valid entries and drops broken ones", () => {
    const parsed = parseLibraryCitations([open, { id: "L2", fileId: "f-2", state: "locked" }, { id: "L3" }, "junk"]);
    expect(parsed.map((c) => c.id)).toEqual(["L1", "L2"]);
  });
  it("is empty for anything that is not a list", () => {
    expect(parseLibraryCitations(undefined)).toEqual([]);
    expect(parseLibraryCitations({ citations: [] })).toEqual([]);
  });
});

describe("markers", () => {
  it("become libcite links", () => {
    expect(preprocessLibraryMarkers("30 days.[[L1]] Done.")).toBe("30 days.[L1](libcite://L1) Done.");
  });
  it("hide a marker cut off at the end while streaming", () => {
    expect(preprocessLibraryMarkers("30 days.[[L", true)).toBe("30 days.");
    expect(preprocessLibraryMarkers("30 days.[[L1]", true)).toBe("30 days.");
  });
  it("are stripped from copied text", () => {
    expect(stripLibraryMarkers("30 days.[[L1]][[L2]] Done.")).toBe("30 days. Done.");
  });
});

describe("rendering", () => {
  it("shows a chip with the file name that links to the passage", () => {
    const html = renderToStaticMarkup(
      <LibraryCitationsProvider citations={parseLibraryCitations([open])}>
        <MarkdownRenderer content={"The window is 30 days.[[L1]]"} />
      </LibraryCitationsProvider>,
    );
    expect(html).toContain("Return policy 2026");
    expect(html).toContain("/library/files/f-1?cite=page%3A2&amp;passage=Returns+within+30+days.");
    expect(html).not.toContain("[[L1]]");
  });

  it("renders nothing for a marker with no citation, and never the raw marker", () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content={"The window is 30 days.[[L9]]"} />);
    expect(html).toContain("The window is 30 days.");
    expect(html).not.toContain("L9");
  });

  it("never names a locked file", () => {
    const html = renderToStaticMarkup(
      <LibraryCitationsProvider citations={parseLibraryCitations([{ id: "L1", fileId: "f-1", state: "locked" }])}>
        <MarkdownRenderer content={"Text.[[L1]]"} />
      </LibraryCitationsProvider>,
    );
    expect(html).toContain("Locked file");
    expect(html).not.toContain("f-1?cite");
  });
});
