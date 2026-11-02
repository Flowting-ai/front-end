// @vitest-environment jsdom
//
// The generated-image thumbnail opens its lightbox from the keyboard, and the
// lightbox is a real modal: focus moves in, Escape closes, focus comes back.

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GeneratedImageCard } from "./GeneratedImageCard"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt, style }: React.ImgHTMLAttributes<HTMLImageElement>) => <img src={src} alt={alt} style={style} />,
}))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<GeneratedImageCard img={{ url: "https://example.com/a.png" }} index={0} />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe("GeneratedImageCard lightbox", () => {
  it("opens from the thumbnail button, takes focus, and returns it on Escape", async () => {
    const thumb = container.querySelector<HTMLButtonElement>('button[aria-label="Expand generated image"]')!
    expect(thumb).not.toBeNull()
    act(() => thumb.focus())
    await act(async () => { thumb.click() })

    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog).not.toBeNull()
    expect(dialog.contains(document.activeElement)).toBe(true)

    await act(async () => {
      document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    // Radix returns focus on the next tick after the content unmounts.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(document.activeElement).toBe(thumb)
  })

  it("stays open on an image click and closes on a backdrop click", async () => {
    await act(async () => { container.querySelector<HTMLButtonElement>("button")!.click() })
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    await act(async () => { dialog.querySelector("img")!.click() })
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    await act(async () => { dialog.click() })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})
