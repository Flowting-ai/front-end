// Regression test for the export-pins.ts:69 `dangerous-html-sink` finding
// (see docs v2/performance report/pinboard/07-pinboard-feature-report.md §10).
// The export path used to build the exported document as an HTML string
// (escaping every interpolated field by hand) and assign it via
// `container.innerHTML = ...`. It has since been rewritten to build real DOM
// nodes via `createElement`/`textContent`, which can never be interpreted as
// markup — this test proves that a pin whose title/content/tags/chat-name
// contain HTML-injection payloads ends up as inert text in the rendered
// off-screen container, never as an actual <img>/<script>/<svg> element.
import { JSDOM } from "jsdom"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import type { PinItem } from "@/context/pinboard-context"

// Captures the promise passed to toast.promise(...) so tests can await the
// export's *actual* completion (including the dynamic jspdf/html2canvas
// imports and cleanup) instead of guessing at a fixed number of microtask
// flushes, which would be a flaky way to test this.
let lastTrackedPromise: Promise<unknown> | null = null

vi.mock("sonner", () => ({
  toast: Object.assign(
    (..._args: unknown[]) => {},
    {
      promise: (p: Promise<unknown>) => { lastTrackedPromise = p; return p },
      error:   () => {},
      success: () => {},
    },
  ),
}))

let capturedContainerHtml: string | null = null
let capturedContainer: HTMLElement | null = null

vi.mock("html2canvas", () => ({
  default: async (container: HTMLElement) => {
    capturedContainerHtml = container.innerHTML
    capturedContainer = container
    return {
      width:  100,
      height: 100,
      toDataURL: () => "data:image/png;base64,",
    }
  },
}))

vi.mock("jspdf", () => ({
  default: class FakeJsPDF {
    internal = {
      pageSize: {
        getWidth:  () => 100,
        getHeight: () => 100,
      },
    }
    addImage() {}
    addPage() {}
    save() {}
  },
}))

let dom: JSDOM

beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>")
  vi.stubGlobal("window", dom.window as unknown as Window & typeof globalThis)
  vi.stubGlobal("document", dom.window.document)
  capturedContainerHtml = null
  capturedContainer = null
  lastTrackedPromise = null
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

function maliciousPin(overrides: Partial<PinItem> = {}): PinItem {
  return {
    id:        "pin-1",
    content:   'Body with <script>window.__xss_content = true</script> payload',
    title:     '<img src=x onerror="window.__xss_title = true">',
    category:  "Code",
    tags:      ['"><svg onload=alert(1)>', "safe-tag"],
    chatId:    "chat-1",
    chatName:  "<b>bold chat name</b>",
    messageId: "msg-1",
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe("export-pins — HTML-injection safety", () => {
  it("exportSinglePin never lets pin content become real markup in the rendered container", async () => {
    const { exportSinglePin } = await import("./export-pins")
    const chatNameById = new Map<string, string>()

    exportSinglePin(maliciousPin(), chatNameById)
    await lastTrackedPromise

    expect(capturedContainerHtml).not.toBeNull()
    expect(capturedContainer).not.toBeNull()

    // No injected element ever actually exists in the DOM.
    expect(capturedContainer!.querySelector("script")).toBeNull()
    expect(capturedContainer!.querySelector("img")).toBeNull()
    expect(capturedContainer!.querySelector("svg")).toBeNull()

    // The malicious payloads survive only as inert text content.
    expect(capturedContainer!.textContent).toContain("<img src=x")
    expect(capturedContainer!.textContent).toContain("<script>")
    expect(capturedContainer!.textContent).toContain('<svg onload=alert(1)>')
    expect(capturedContainer!.textContent).toContain("bold chat name")

    // Global scope was never touched by the "onerror"/"onload" payloads.
    expect((dom.window as unknown as { __xss_title?: boolean }).__xss_title).toBeUndefined()
    expect((dom.window as unknown as { __xss_content?: boolean }).__xss_content).toBeUndefined()

    // Off-screen container is cleaned up after rendering.
    expect(dom.window.document.body.contains(capturedContainer)).toBe(false)
  })

  it("exportPins (bulk) applies the same DOM-construction safety to every pin", async () => {
    const { exportPins } = await import("./export-pins")
    const pins = [maliciousPin({ id: "pin-1" }), maliciousPin({ id: "pin-2", title: "<script>alert(2)</script>" })]

    exportPins(pins, new Map())
    await lastTrackedPromise

    expect(capturedContainer).not.toBeNull()
    expect(capturedContainer!.querySelectorAll("script").length).toBe(0)
    expect(capturedContainer!.textContent).toContain("<script>alert(2)</script>")
  })
})
