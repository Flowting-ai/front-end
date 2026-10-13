import { describe, expect, it } from "vitest";
import { citeQuery, formatCite, formatTimestamp, parseCite, parsePageCite, parseRowCite, passageRuns, splitPassage } from "./cite";

describe("parseCite", () => {
  it("reads page, row and time locators", () => {
    expect(parseCite("page:2")).toEqual({ type: "page", value: "2" });
    expect(parseCite("row:Rates!14")).toEqual({ type: "row", value: "Rates!14" });
    expect(parseCite("time:42000")).toEqual({ type: "time", value: "42000" });
  });

  it("ignores anything that is not a valid locator", () => {
    for (const bad of [null, undefined, "", "page", ":2", "chart:2", "page:", "time:12s", "x".repeat(300)]) {
      expect(parseCite(bad)).toBeNull();
    }
  });

  it("round-trips", () => {
    expect(parseCite(formatCite({ type: "row", value: "Sheet1!3" }))).toEqual({ type: "row", value: "Sheet1!3" });
  });
});

describe("cited passages", () => {
  it("reads a passage on a page citation only", () => {
    expect(parseCite("page:2", "  Returns   accepted ")).toEqual({ type: "page", value: "2", passage: "Returns accepted" });
    expect(parseCite("row:3", "Returns")).toEqual({ type: "row", value: "3" });
    expect(parseCite("page:2", "x".repeat(600))).toEqual({ type: "page", value: "2" });
  });

  it("builds the link query", () => {
    expect(citeQuery({ type: "page", value: "2", passage: "Care: spot clean" })).toBe("cite=page%3A2&passage=Care%3A+spot+clean");
    expect(citeQuery({ type: "time", value: "2000" })).toBe("cite=time%3A2000");
  });

  it("splits text around a passage, ignoring case and spacing", () => {
    const text = "Care: spot clean. Returns accepted within 30 days in original condition.";
    expect(splitPassage(text, "returns  accepted within 30 days")).toEqual({
      before: "Care: spot clean. ",
      match: "Returns accepted within 30 days",
      after: " in original condition.",
    });
    expect(splitPassage(text, "not here")).toBeNull();
    expect(splitPassage(text, "")).toBeNull();
    expect(splitPassage("Price (USD) $5", "(USD) $5")?.match).toBe("(USD) $5");
  });

  it("finds the text runs that hold a passage across run boundaries", () => {
    const runs = ["Shipping", "Returns accepted", "within 30", "days.", "Contact us"];
    expect(passageRuns(runs, "accepted within 30 days")).toEqual([1, 2, 3]);
    expect(passageRuns(runs, "nowhere")).toEqual([]);
    expect(passageRuns(runs, null)).toEqual([]);
  });
});

describe("locator values", () => {
  it("reads a row with or without a sheet name", () => {
    expect(parseRowCite("Rates!14")).toEqual({ sheet: "Rates", row: 14 });
    expect(parseRowCite("14")).toEqual({ row: 14 });
    expect(parseRowCite("Rates!0")).toBeNull();
    expect(parseRowCite("Rates!x")).toBeNull();
  });

  it("reads a page number from common labels", () => {
    expect(parsePageCite("2")).toBe(2);
    expect(parsePageCite("Page 3")).toBe(3);
    expect(parsePageCite("p. 12")).toBe(12);
    expect(parsePageCite("Cover")).toBeNull();
    expect(parsePageCite("Page 0")).toBeNull();
  });

  it("formats a recording time", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(42_000)).toBe("0:42");
    expect(formatTimestamp(125_999)).toBe("2:05");
    expect(formatTimestamp(-5)).toBe("0:00");
  });
});
