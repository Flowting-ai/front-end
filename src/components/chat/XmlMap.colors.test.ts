import { describe, expect, it } from "vitest"
import { resolveMapColors } from "./XmlMap.colors"

describe("resolveMapColors", () => {
  it("resolves every token to a concrete colour MapLibre can parse", () => {
    const tokens: Record<string, string> = {
      "--blue-300": " #8EAED8",
      "--blue-500": "#4A83BF ",
      "--blue-600": "#0D6EB2",
      "--neutral-white-90": "rgba(255, 255, 255, 0.90)",
      "--static-white": "#FFFFFF",
      "--neutral-900": "#26211E",
    }
    const colors = resolveMapColors((name) => tokens[name] ?? "")

    expect(colors).toEqual({
      clusterLow: "#8EAED8",
      clusterMid: "#4A83BF",
      clusterHigh: "#0D6EB2",
      clusterStroke: "rgba(255, 255, 255, 0.90)",
      clusterText: "#FFFFFF",
      pointLow: "#8EAED8",
      pointHigh: "#0D6EB2",
      pointStroke: "#FFFFFF",
      pointStrokeSelected: "#26211E",
    })
  })

  it("follows the dark theme's values", () => {
    const colors = resolveMapColors((name) => (name === "--blue-300" ? "#135487" : name === "--neutral-900" ? "#DEDEDE" : ""))
    expect(colors.clusterLow).toBe("#135487")
    expect(colors.pointStrokeSelected).toBe("#DEDEDE")
  })

  it("falls back to hex values, never var(), when a token can't be read", () => {
    for (const value of ["", "var(--blue-300)", "color-mix(in srgb, red 10%, transparent)"]) {
      const colors = resolveMapColors(() => value)
      for (const color of Object.values(colors)) {
        expect(color).not.toContain("var(")
        expect(color).toMatch(/^(#[0-9A-F]{6}|rgba\()/i)
      }
    }
  })
})
