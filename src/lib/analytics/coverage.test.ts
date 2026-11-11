import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Every declared browser event and feature name needs a call site. Names that
 * are declared ahead of their wiring are listed below; wiring one means
 * deleting it here, and a new unwired name fails until it is wired or listed.
 */
const NOT_YET_WIRED = new Set<string>([
  "activation_milestone", // backend door recommended (docs/analytics/mixpanel-backend-contract.md)
  "brain_run_stopped", // needs the live run phase from UI state; generic stop would mislabel
  "pin_drag", // Pins are switched off (PINS_ENABLED)
  "flashcards", // no flashcards feature in the app yet
  "output_viewed", // its component (Brain ExternalOutputCard) was removed
])

const SRC = join(__dirname, "..", "..")
const EVENTS_FILE = join(__dirname, "events.ts")

function unionMembers(source: string, typeName: string): string[] {
  const start = source.indexOf(`export type ${typeName} =`)
  const block = start < 0 ? "" : source.slice(start, source.indexOf(";", start))
  return [...block.matchAll(/"([a-z_]+)"/g)].map((match) => match[1])
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe("analytics coverage", () => {
  const events = readFileSync(EVENTS_FILE, "utf8")
  const declared = [...unionMembers(events, "BrowserEvent"), ...unionMembers(events, "FeatureName")]
  const callSites = sourceFiles(SRC)
    .filter((file) => file !== EVENTS_FILE)
    .map((file) => readFileSync(file, "utf8"))
    .filter((text) => /track(BrowserEvent|Feature)\(/.test(text))
    .join("\n")
  const isCalled = (name: string) =>
    new RegExp(String.raw`track(BrowserEvent|Feature)\(\s*["']${name}["']`).test(callSites)

  it("parses the declared names", () => {
    expect(declared.length).toBeGreaterThan(20)
  })

  it("has a call site for every declared name", () => {
    expect(declared.filter((name) => !isCalled(name) && !NOT_YET_WIRED.has(name))).toEqual([])
  })

  it("does not list wired names as unwired", () => {
    expect([...NOT_YET_WIRED].filter(isCalled)).toEqual([])
  })
})
