import { describe, expect, it } from "vitest"
import { filterCompareModels } from "./filter-models"

const models = [
  { company: "OpenAI", modelName: "GPT-5", tierLabel: "Pro" },
  { company: "OpenAI", modelName: "GPT-5 mini", tierLabel: "free" },
  { company: "Anthropic", modelName: "Claude Opus", tierLabel: "power" },
  { company: "Google", modelName: "Gemini Flash", tierLabel: null },
]
const none = new Set<string>()

describe("filterCompareModels", () => {
  it("returns everything with no filters", () => {
    expect(filterCompareModels(models, { company: "all", tiers: none, query: "" })).toHaveLength(4)
  })

  it("filters by company tab", () => {
    expect(filterCompareModels(models, { company: "OpenAI", tiers: none, query: "" }).map((m) => m.modelName))
      .toEqual(["GPT-5", "GPT-5 mini"])
  })

  it("maps tier ids to backend labels, case-insensitively", () => {
    const pick = (tiers: string[]) =>
      filterCompareModels(models, { company: "all", tiers: new Set(tiers), query: "" }).map((m) => m.modelName)
    expect(pick(["starter"])).toEqual(["GPT-5 mini"])
    expect(pick(["pro"])).toEqual(["GPT-5"])
    expect(pick(["pro", "power"])).toEqual(["GPT-5", "Claude Opus"])
  })

  it("drops models without a tier when a tier filter is on", () => {
    expect(filterCompareModels(models, { company: "Google", tiers: new Set(["starter"]), query: "" })).toEqual([])
  })

  it("searches model name and company, trimmed and case-insensitive", () => {
    expect(filterCompareModels(models, { company: "all", tiers: none, query: "  anthropic " }).map((m) => m.modelName))
      .toEqual(["Claude Opus"])
    expect(filterCompareModels(models, { company: "all", tiers: none, query: "5 mini" })).toHaveLength(1)
  })

  it("combines all three filters", () => {
    expect(filterCompareModels(models, { company: "OpenAI", tiers: new Set(["pro"]), query: "gpt" }).map((m) => m.modelName))
      .toEqual(["GPT-5"])
  })
})
