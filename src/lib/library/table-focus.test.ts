import { describe, expect, it } from "vitest";
import { nextRowIndex, withFocusedRow } from "./table-focus";

describe("withFocusedRow", () => {
  it("leaves the visible rows alone when nothing is focused or the focused row is visible", () => {
    const visible = [4, 5, 6];
    expect(withFocusedRow(visible, null)).toBe(visible);
    expect(withFocusedRow(visible, 5)).toBe(visible);
  });

  it("keeps a focused row that scrolled away, in index order", () => {
    expect(withFocusedRow([40, 41, 42], 2)).toEqual([2, 40, 41, 42]);
    expect(withFocusedRow([0, 1, 2], 90)).toEqual([0, 1, 2, 90]);
  });

  it("ignores a focused row past the end of a list that shrank", () => {
    const visible = [0, 1, 2];
    expect(withFocusedRow(visible, 90, 3)).toBe(visible);
    expect(withFocusedRow(visible, 3, 3)).toBe(visible);
    expect(withFocusedRow(visible, -1, 3)).toBe(visible);
    expect(withFocusedRow([0, 1], 2, 3)).toEqual([0, 1, 2]);
  });
});

describe("nextRowIndex", () => {
  it("moves one row with the arrows and stops at the ends", () => {
    expect(nextRowIndex("ArrowDown", 3, 10)).toBe(4);
    expect(nextRowIndex("ArrowUp", 3, 10)).toBe(2);
    expect(nextRowIndex("ArrowDown", 9, 10)).toBe(9);
    expect(nextRowIndex("ArrowUp", 0, 10)).toBe(0);
  });

  it("jumps to the first and last loaded row with Home and End", () => {
    expect(nextRowIndex("Home", 5, 10)).toBe(0);
    expect(nextRowIndex("End", 5, 10)).toBe(9);
  });

  it("ignores other keys and empty lists", () => {
    expect(nextRowIndex("Enter", 5, 10)).toBeNull();
    expect(nextRowIndex("ArrowDown", 0, 0)).toBeNull();
  });
});
