import { describe, expect, it } from "vitest";
import { detectForeignChange, mergeChanges, settingsChangeLines, shouldShowSettingsNotice, unseenChanges } from "./settings-notice";

describe("settings change lines", () => {
  const before = { defaultAutoSave: "always" as const, forceAutoSaveOff: false, aiReferenceEnabled: true };
  const at = "2026-10-13T10:00:00Z";

  it("writes one line per setting that changed", () => {
    expect(settingsChangeLines(before, { defaultAutoSave: "ask", forceAutoSaveOff: true, aiReferenceEnabled: false }, at).map((change) => change.text)).toEqual([
      "Auto-save default is now Ask each time.",
      "Your Admin has turned auto-save off.",
      "Souvenir no longer searches Library in answers.",
    ]);
    expect(settingsChangeLines(before, { defaultAutoSave: "always", aiReferenceEnabled: true }, at)).toEqual([]);
  });

  it("keeps only the latest line per setting and lists at most three unseen ones", () => {
    const first = settingsChangeLines(before, { forceAutoSaveOff: true }, "2026-10-12T10:00:00Z");
    const second = settingsChangeLines({ ...before, forceAutoSaveOff: true }, { forceAutoSaveOff: false }, at);
    const merged = mergeChanges(first, second);
    expect(merged.map((change) => change.text)).toEqual(["Auto-save follows your setting again."]);
    expect(unseenChanges(merged, "2026-10-13T11:00:00Z")).toEqual([]);
    expect(unseenChanges(merged, null)).toHaveLength(1);
    expect(unseenChanges(undefined, null)).toEqual([]);
  });
});

const priya = { id: "u2", name: "Priya Shah" };
const you = { id: "u1", name: "Avery Stone" };

describe("detectForeignChange", () => {
  it("names the other Admin when a newer version was written by someone else", () => {
    expect(detectForeignChange(3, { version: 4, updatedBy: priya }, "u1")).toEqual({ by: "Priya Shah" });
  });

  it("says nothing for our own write, an unchanged version, or the first load", () => {
    expect(detectForeignChange(3, { version: 4, updatedBy: you }, "u1")).toBeNull();
    expect(detectForeignChange(4, { version: 4, updatedBy: priya }, "u1")).toBeNull();
    expect(detectForeignChange(null, { version: 4, updatedBy: priya }, "u1")).toBeNull();
    expect(detectForeignChange(3, { version: 4 }, "u1")).toBeNull();
  });

  it("falls back to a neutral name rather than showing an empty one", () => {
    expect(detectForeignChange(1, { version: 2, updatedBy: { id: "u9", name: "   " } }, "u1")).toEqual({ by: "another Admin" });
  });
});

describe("shouldShowSettingsNotice", () => {
  it("shows when settings changed after the last dismissal, or were never dismissed", () => {
    expect(shouldShowSettingsNotice("2026-10-13T10:00:00Z", null)).toBe(true);
    expect(shouldShowSettingsNotice("2026-10-13T10:00:00Z", "2026-10-12T10:00:00Z")).toBe(true);
  });

  it("stays quiet after dismissal, with no change, or with an unreadable date", () => {
    expect(shouldShowSettingsNotice("2026-10-13T10:00:00Z", "2026-10-13T10:00:00Z")).toBe(false);
    expect(shouldShowSettingsNotice("2026-10-13T10:00:00Z", "2026-10-14T10:00:00Z")).toBe(false);
    expect(shouldShowSettingsNotice(undefined, null)).toBe(false);
    expect(shouldShowSettingsNotice("garbage", null)).toBe(false);
  });
});
