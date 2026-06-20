'use client'

type PositionedHighlight = {
  messageId?: string | null
  chatId?: string | null
  startOffset: number
  endOffset?: number
}

function messageDomOrder(): Map<string, number> {
  if (typeof document === 'undefined') return new Map()

  const order = new Map<string, number>()
  document.querySelectorAll<HTMLElement>('[data-message-id]').forEach((element, index) => {
    const messageId = element.dataset.messageId
    if (messageId && !order.has(messageId)) order.set(messageId, index)
  })
  return order
}

export function sortHighlightsBySourcePosition<T extends PositionedHighlight>(highlights: readonly T[]): T[] {
  const order = messageDomOrder()

  return highlights
    .map((highlight, index) => ({ highlight, index }))
    .sort((a, b) => {
      if (a.highlight.messageId && a.highlight.messageId === b.highlight.messageId) {
        return (
          a.highlight.startOffset - b.highlight.startOffset ||
          (a.highlight.endOffset ?? 0) - (b.highlight.endOffset ?? 0) ||
          a.index - b.index
        )
      }

      const aOrder = a.highlight.messageId ? order.get(a.highlight.messageId) : undefined
      const bOrder = b.highlight.messageId ? order.get(b.highlight.messageId) : undefined
      if (aOrder != null && bOrder != null && aOrder !== bOrder) return aOrder - bOrder

      return a.index - b.index
    })
    .map(({ highlight }) => highlight)
}
