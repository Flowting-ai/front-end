import { describe, expect, it } from "vitest";
import type { LibraryFileRow } from "./schemas";
import { RECENT_LIMIT, TILE_LIMIT, isSuggestedEmpty, selectSuggested, tileLine } from "./suggested";

function file(id: string): LibraryFileRow {
  return {
    id,
    title: id,
    extension: "pdf",
    format: "pdf",
    source: "uploaded",
    owner: { id: "u1", name: "Avery" },
    access: "owner",
    adminCanManage: false,
    accessSummary: { everyone: false, people: [{ id: "u1", name: "Avery" }] },
    sizeBytes: 1,
    createdAt: "2026-10-01T00:00:00.000Z",
    lastActivityAt: "2026-10-01T00:00:00.000Z",
    lastActivityKind: "created",
    unread: false,
    life: "active",
    titleIsAiGenerated: false,
  };
}

const many = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => file(`${prefix}${i}`));

describe("selectSuggested", () => {
  it("keeps one row of up to five Recent cards and at most three tiles", () => {
    const view = selectSuggested({ recent: many("r", 9), frequent: many("f", 9), generated: many("g", 9) });
    expect(view.recent).toHaveLength(RECENT_LIMIT);
    expect(view.frequent).toHaveLength(TILE_LIMIT);
    expect(view.generated).toHaveLength(TILE_LIMIT);
  });

  it("skips files already shown in Recent from Frequently used", () => {
    const shared = file("same");
    const view = selectSuggested({ recent: [shared, file("r1")], frequent: [shared, file("f1"), file("f2")], generated: [] });
    expect(view.frequent.map((f) => f.id)).toEqual(["f1", "f2"]);
  });

  it("does not hide a Frequently used file that fell outside the five Recent cards", () => {
    const sixth = file("r5");
    const view = selectSuggested({ recent: [...many("r", 5), sixth], frequent: [sixth], generated: [] });
    expect(view.frequent.map((f) => f.id)).toEqual(["r5"]);
  });

  it("writes the tiles' second line as the prototype does", () => {
    expect(tileLine("frequent", { ...file("a"), openCount: 4 }, "Opened 2d ago")).toBe("Opened 4 times");
    expect(tileLine("frequent", { ...file("a"), openCount: 1 }, "x")).toBe("Opened 1 time");
    expect(tileLine("frequent", file("a"), "Opened 2d ago")).toBe("Opened 2d ago");
    expect(tileLine("generated", { ...file("g"), source: "generated", generatedFrom: { kind: "routine", label: "Weekly sales report" } }, "x")).toBe("Run of Weekly sales report");
    expect(tileLine("generated", { ...file("g"), source: "generated", generatedFrom: { kind: "chat", label: "Refunds" } }, "x")).toBe("");
  });

  it("reports an empty page only when every row is empty", () => {
    expect(isSuggestedEmpty(selectSuggested({ recent: [], frequent: [], generated: [] }))).toBe(true);
    expect(isSuggestedEmpty(selectSuggested({ recent: [], frequent: [], generated: [file("g")] }))).toBe(false);
  });
});
