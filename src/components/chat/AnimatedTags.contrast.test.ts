import { describe, expect, it } from "vitest"
import { blendOver, contrastRatio, ensureContrast } from "./AnimatedTags.contrast"

const SURFACE = "#FCFCFB"
const tagBackground = (color: string) => blendOver(color, 0x15 / 255, SURFACE)

describe("ensureContrast", () => {
  it("matches known WCAG ratios", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5)
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2)
  })

  it("darkens light model colours until the label reaches 4.5:1 on its own tint", () => {
    for (const color of ["#C8920A", "#F2C94C", "#7ED957", "#00BFFF", "#FF6B6B", "#FFFFFF"]) {
      const bg = tagBackground(color)
      expect(contrastRatio(color, bg)).toBeLessThan(4.5)
      const text = ensureContrast(color, bg)
      expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("keeps the hue while darkening", () => {
    const text = ensureContrast("#C8920A", tagBackground("#C8920A"))
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(text.slice(i, i + 2), 16))
    expect(r).toBeGreaterThan(g)
    expect(g).toBeGreaterThan(b)
  })

  it("leaves colours that already pass, and unparsable input, unchanged", () => {
    expect(ensureContrast("#0D6EB2", tagBackground("#0D6EB2"))).toBe("#0D6EB2")
    expect(ensureContrast("#26211E", SURFACE)).toBe("#26211E")
    expect(ensureContrast("tomato", SURFACE)).toBe("tomato")
  })
})
