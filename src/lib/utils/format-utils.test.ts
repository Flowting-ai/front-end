import { describe, it, expect } from "vitest";
import { parseServerDate, formatServerDateTime } from "./format-utils";

// Regression coverage for timezone handling (issue #6): backend timestamps are
// UTC and must render in the user's LOCAL zone, including tz-less strings which
// JS would otherwise parse as local time.

describe("parseServerDate — UTC-aware parsing (issue #6)", () => {
  it("parses a timezone-less datetime as UTC (not local)", () => {
    const d = parseServerDate("2026-06-10T12:00:00");
    expect(d).not.toBeNull();
    // Treated as UTC noon regardless of the host's timezone.
    expect(d!.toISOString()).toBe("2026-06-10T12:00:00.000Z");
  });

  it("respects an explicit Z (UTC) designator", () => {
    expect(parseServerDate("2026-06-10T12:00:00Z")!.toISOString()).toBe(
      "2026-06-10T12:00:00.000Z",
    );
  });

  it("respects an explicit numeric offset", () => {
    // 12:00 at +02:00 == 10:00 UTC
    expect(parseServerDate("2026-06-10T12:00:00+02:00")!.toISOString()).toBe(
      "2026-06-10T10:00:00.000Z",
    );
  });

  it("handles space-separated datetimes (Postgres style) as UTC", () => {
    expect(parseServerDate("2026-06-10 12:00:00")!.toISOString()).toBe(
      "2026-06-10T12:00:00.000Z",
    );
  });

  it("accepts epoch millisecond numbers", () => {
    const ms = Date.UTC(2026, 5, 10, 12, 0, 0);
    expect(parseServerDate(ms)!.toISOString()).toBe("2026-06-10T12:00:00.000Z");
  });

  it("returns null for empty / invalid input", () => {
    expect(parseServerDate(null)).toBeNull();
    expect(parseServerDate(undefined)).toBeNull();
    expect(parseServerDate("")).toBeNull();
    expect(parseServerDate("not-a-date")).toBeNull();
  });
});

describe("formatServerDateTime", () => {
  it("returns the fallback for unparseable input", () => {
    expect(formatServerDateTime(null, "—")).toBe("—");
    expect(formatServerDateTime("", "—")).toBe("—");
  });

  it("produces a non-empty local string for a valid UTC timestamp", () => {
    const out = formatServerDateTime("2026-06-10T12:00:00Z");
    expect(out).toContain("·");
    expect(out.length).toBeGreaterThan(3);
  });
});
