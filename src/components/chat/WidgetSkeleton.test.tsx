import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { STRUCTURED_TAGS } from "@/lib/content-parser"
import { WidgetReveal, WidgetSkeleton } from "./WidgetSkeleton"

describe("WidgetSkeleton", () => {
  it.each(STRUCTURED_TAGS)("renders a labelled, busy skeleton for <%s>", (tag) => {
    const html = renderToStaticMarkup(<WidgetSkeleton tag={tag} />)

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain(`aria-label="Loading ${tag}…"`)
    expect(html).toContain(`Rendering ${tag}…`)
    expect(html).toContain("kaya-skeleton")
  })

  it("reserves the map's full height", () => {
    expect(renderToStaticMarkup(<WidgetSkeleton tag="map" />)).toContain("height:370px")
  })
})

describe("WidgetReveal", () => {
  it("fades in only when it mounts mid-stream", () => {
    const streamed = renderToStaticMarkup(<WidgetReveal animate><span>w</span></WidgetReveal>)
    const restored = renderToStaticMarkup(<WidgetReveal><span>w</span></WidgetReveal>)

    expect(streamed).toMatch(/^<div class="[^"]*reveal[^"]*"><span>w<\/span><\/div>$/)
    expect(restored).toBe("<div><span>w</span></div>")
  })
})
