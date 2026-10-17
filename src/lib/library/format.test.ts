import { describe, expect, it } from "vitest";
import { activityLine, agoShort, daysLeftLabel, fileDocumentTitle, formatBytes, formatDateTime, formatGroupOf, formatsInGroup, pluralize, sanitizeDisplayText, storageLabel, storageShare, truncateText } from "./format";
import { testFile } from "./test-files";

// 2026-10-13 15:00 UTC, pinned so nothing here depends on the machine's clock or time zone.
const NOW = Date.UTC(2026, 9, 13, 15, 0, 0);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (ms: number) => new Date(ms).toISOString();

describe("formats", () => {
  it("maps every format to one of the five filter groups", () => {
    expect(formatGroupOf("pdf")).toBe("pdfs");
    expect(formatGroupOf("slides")).toBe("documents");
    expect(formatGroupOf("email")).toBe("documents");
    expect(formatGroupOf("sheet")).toBe("spreadsheets");
    expect(formatGroupOf("image")).toBe("images");
    expect(formatGroupOf("audio")).toBe("audio");
    expect(formatsInGroup("documents").sort()).toEqual(["document", "email", "slides", "text", "web"]);
  });
});

describe("sizes", () => {
  it("uses decimal units with sensible digits", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(900)).toBe("900 B");
    expect(formatBytes(184_000)).toBe("184 KB");
    expect(formatBytes(1_400_000)).toBe("1.4 MB");
    expect(formatBytes(1_930_000_000)).toBe("1.93 GB");
    expect(formatBytes(20_000_000_000)).toBe("20 GB");
    expect(formatBytes(2_000_000)).toBe("2 MB");
    expect(formatBytes(1_500_000_000)).toBe("1.50 GB");
  });

  it("describes storage with and without a cap", () => {
    expect(storageLabel(1_930_000_000, null)).toBe("1.93 GB used");
    expect(storageLabel(1_930_000_000, 20_000_000_000)).toBe("1.93 GB of 20 GB used");
    expect(storageShare(5, null)).toBe(0);
    expect(storageShare(5, 10)).toBe(0.5);
    expect(storageShare(50, 10)).toBe(1);
  });
});

describe("dates", () => {
  it("says Today, Yesterday, or the date, in the given time zone", () => {
    expect(formatDateTime(iso(NOW - 2 * HOUR), NOW, "UTC")).toBe("Today, 1:00 PM");
    expect(formatDateTime(iso(NOW - DAY), NOW, "UTC")).toBe("Yesterday, 3:00 PM");
    expect(formatDateTime(iso(NOW - 10 * DAY), NOW, "UTC")).toBe("Oct 3, 3:00 PM");
    expect(formatDateTime("not a date", NOW, "UTC")).toBe("");
  });

  it("flips Today at the viewer's midnight, not UTC's", () => {
    // 23:30 UTC the previous day is already Oct 13 in Tokyo.
    const lateUtc = Date.UTC(2026, 9, 12, 23, 30, 0);
    const now = Date.UTC(2026, 9, 13, 1, 0, 0);
    expect(formatDateTime(iso(lateUtc), now, "Asia/Tokyo")).toMatch(/^Today/);
    expect(formatDateTime(iso(lateUtc), now, "UTC")).toMatch(/^Yesterday/);
  });

  it("shortens relative times", () => {
    expect(agoShort(iso(NOW - 3 * HOUR), NOW, "UTC")).toBe("today");
    expect(agoShort(iso(NOW - 2 * DAY), NOW, "UTC")).toBe("2d ago");
    expect(agoShort(iso(NOW - 15 * DAY), NOW, "UTC")).toBe("2w ago");
    expect(agoShort(iso(NOW - 95 * DAY), NOW, "UTC")).toBe("3mo ago");
  });

  it("describes the latest activity in generic words", () => {
    expect(activityLine({ lastActivityAt: iso(NOW - 2 * DAY), lastActivityKind: "shared" }, NOW, "UTC")).toBe("Shared 2d ago");
    expect(activityLine({ lastActivityAt: iso(NOW - HOUR), lastActivityKind: "created" }, NOW, "UTC")).toBe("Created today");
  });

  it("labels the days left in Trash", () => {
    expect(daysLeftLabel(1)).toBe("1 day");
    expect(daysLeftLabel(0)).toBe("Less than a day");
    expect(daysLeftLabel(27)).toBe("27 days");
    expect(daysLeftLabel(undefined)).toBe("");
  });
});

describe("untrusted text", () => {
  it("strips control, zero-width and bidi characters", () => {
    const rtlOverride = String.fromCodePoint(0x202e);
    expect(sanitizeDisplayText(`invoice${rtlOverride}fdp.exe`)).toBe("invoicefdp.exe");
    expect(sanitizeDisplayText(`a${String.fromCodePoint(0x200b)}b${String.fromCodePoint(7)}c`)).toBe("abc");
    expect(sanitizeDisplayText("  many   spaces\nhere ")).toBe("many spaces here");
  });

  it("builds display names and tab titles from sanitised, truncated text", () => {
    expect(testFile({ title: "Return policy", extension: "pdf" }).name).toBe("Return policy.pdf");
    expect(testFile({ title: "   ", extension: "" }).name).toBe("Untitled");
    expect(fileDocumentTitle(testFile({ title: "x".repeat(200), extension: "pdf" })).length).toBeLessThanOrEqual(90);
    expect(fileDocumentTitle(testFile({ title: "Brand", extension: "pdf" }))).toBe("Brand.pdf | Library");
  });

  it("truncates with an ellipsis", () => {
    expect(truncateText("hello world", 8)).toBe("hello w…");
    expect(truncateText("short", 8)).toBe("short");
  });

  it("pluralizes", () => {
    expect(pluralize(1, "file")).toBe("1 file");
    expect(pluralize(2, "file")).toBe("2 files");
  });
});
