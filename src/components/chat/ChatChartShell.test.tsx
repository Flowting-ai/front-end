import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ChatChartShell } from "@/components/chat/ChatChartShell"
import { CHAT_CHART_PALETTE } from "@/components/chat/chat-chart-theme"

describe("ChatChartShell", () => {
  it("provides the shared warm-neutral chat chart surface", () => {
    const html = renderToStaticMarkup(
      <ChatChartShell title="Median page-load time">Chart body</ChatChartShell>,
    )

    expect(html).toContain("Median page-load time")
    expect(html).toContain("Chart body")
    expect(html).toContain("var(--neutral-white)")
    expect(html).toContain("1px solid var(--neutral-100)")
    expect(html).toContain("border-radius:12px")
  })

  it("starts the shared series palette with the product brown", () => {
    expect(CHAT_CHART_PALETTE[0]).toBe("var(--brown-700)")
  })
})
