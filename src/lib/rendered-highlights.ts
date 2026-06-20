'use client'

import { HIGHLIGHT_COLORS } from '@/components/HighlightCard'
import { hasRawRange } from '@/lib/highlight-offsets'
import type { HighlightSpec } from '@/lib/markdown-utils'

type TextUnit = {
  type: 'text'
  node: Text
  start: number
  len: number
}

type AtomicUnit = {
  type: 'atomic'
  element: HTMLElement
  text: string
  start: number
  len: number
}

type RenderedUnit = TextUnit | AtomicUnit

export interface RenderedSelectionRange {
  startOffset: number
  endOffset: number
  selectedText: string
}

function isIgnoredElement(element: Element): boolean {
  return Boolean(element.closest('[data-highlight-ignore]'))
}

function collectRenderedUnits(root: Element): RenderedUnit[] {
  const units: RenderedUnit[] = []
  let offset = 0

  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text
      const value = text.textContent ?? ''
      if (!value) return
      const parent = text.parentElement
      if (parent?.closest('[data-highlight-ignore], .katex')) return
      units.push({ type: 'text', node: text, start: offset, len: value.length })
      offset += value.length
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return

    const element = node as HTMLElement
    if (isIgnoredElement(element)) return

    const atomicText = element.dataset.highlightText
    if (element.dataset.highlightAtomic && atomicText != null) {
      units.push({ type: 'atomic', element, text: atomicText, start: offset, len: atomicText.length })
      offset += atomicText.length
      return
    }

    if (element.closest('.katex')) return
    element.childNodes.forEach(visit)
  }

  root.childNodes.forEach(visit)
  return units
}

function intersects(range: Range, node: Node): boolean {
  try {
    return range.intersectsNode(node)
  } catch {
    return false
  }
}

export function getRenderedSelectionRange(root: Element, selection: Selection): RenderedSelectionRange | null {
  if (selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null

  const chars: Array<{ ch: string; offset: number }> = []

  for (const unit of collectRenderedUnits(root)) {
    if (unit.type === 'atomic') {
      if (!intersects(range, unit.element)) continue
      for (let i = 0; i < unit.text.length; i++) {
        chars.push({ ch: unit.text[i], offset: unit.start + i })
      }
      continue
    }

    if (!intersects(range, unit.node)) continue

    const text = unit.node.textContent ?? ''
    const localStart = range.startContainer === unit.node ? range.startOffset : 0
    const localEnd = range.endContainer === unit.node ? range.endOffset : text.length
    if (localEnd <= localStart) continue

    for (let i = localStart; i < localEnd; i++) {
      chars.push({ ch: text[i], offset: unit.start + i })
    }
  }

  const first = chars.findIndex(({ ch }) => /\S/.test(ch))
  if (first === -1) return null

  let last = chars.length - 1
  while (last >= first && !/\S/.test(chars[last].ch)) last--

  return {
    startOffset: chars[first].offset,
    endOffset: chars[last].offset + 1,
    selectedText: chars.slice(first, last + 1).map(({ ch }) => ch).join(''),
  }
}

export function clearRenderedHighlights(root: Element): void {
  root.querySelectorAll('mark[data-highlight-id]').forEach((mark) => {
    const parent = mark.parentNode
    if (!parent) return
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
  })

  root.querySelectorAll<HTMLElement>('[data-rendered-highlight-atomic]').forEach((element) => {
    element.removeAttribute('data-highlight-id')
    element.removeAttribute('data-rendered-highlight-atomic')
    element.style.removeProperty('background-color')
    element.style.removeProperty('border-radius')
    element.style.removeProperty('box-decoration-break')
    element.style.removeProperty('-webkit-box-decoration-break')
  })
}

export function applyRenderedHighlights(root: Element, specs: HighlightSpec[]): void {
  clearRenderedHighlights(root)

  type RangedHighlightSpec = HighlightSpec & { startOffset: number; endOffset: number }
  const ranged = specs.filter((spec): spec is RangedHighlightSpec => hasRawRange(spec))
  if (!ranged.length) return

  const units = collectRenderedUnits(root)
  if (!units.length) return

  const fullText = units.map((unit) => (
    unit.type === 'atomic' ? unit.text : unit.node.textContent ?? ''
  )).join('')

  const resolveRange = (spec: RangedHighlightSpec): { start: number; end: number } => {
    const start = Math.max(0, Math.min(spec.startOffset, fullText.length))
    const end = Math.max(start, Math.min(spec.endOffset, fullText.length))
    if (!spec.text || fullText.slice(start, end) === spec.text) return { start, end }

    let nearest = -1
    let nearestDistance = Number.POSITIVE_INFINITY
    let pos = 0
    while ((pos = fullText.indexOf(spec.text, pos)) !== -1) {
      const distance = Math.abs(pos - start)
      if (distance < nearestDistance) {
        nearest = pos
        nearestDistance = distance
      }
      pos += 1
    }

    return nearest === -1
      ? { start, end }
      : { start: nearest, end: nearest + spec.text.length }
  }

  type Match = { start: number; end: number; spec: RangedHighlightSpec }
  const matches = ranged
    .map((spec): Match => ({ ...resolveRange(spec), spec }))
    .filter((match) => match.end > match.start)
    .sort((a, b) => a.start - b.start || b.end - a.end)

  const resolved: Match[] = []
  let cursor = 0
  for (const match of matches) {
    if (match.start >= cursor) {
      resolved.push(match)
      cursor = match.end
    }
  }

  const textRanges: Array<{ node: Text; start: number; end: number; spec: Match['spec'] }> = []
  const atomicRanges: Array<{ element: HTMLElement; spec: Match['spec'] }> = []

  for (const match of resolved) {
    for (const unit of units) {
      const unitEnd = unit.start + unit.len
      const start = Math.max(match.start, unit.start)
      const end = Math.min(match.end, unitEnd)
      if (end <= start) continue

      if (unit.type === 'atomic') {
        atomicRanges.push({ element: unit.element, spec: match.spec })
      } else {
        textRanges.push({
          node: unit.node,
          start: start - unit.start,
          end: end - unit.start,
          spec: match.spec,
        })
      }
    }
  }

  const seenAtomic = new Set<HTMLElement>()
  for (const { element, spec } of atomicRanges) {
    if (seenAtomic.has(element)) continue
    seenAtomic.add(element)
    const { bg } = HIGHLIGHT_COLORS[spec.colorIndex]
    element.setAttribute('data-highlight-id', spec.id)
    element.setAttribute('data-rendered-highlight-atomic', 'true')
    element.style.backgroundColor = bg
    element.style.borderRadius = '3px'
    element.style.setProperty('box-decoration-break', 'clone')
    element.style.setProperty('-webkit-box-decoration-break', 'clone')
  }

  textRanges.sort((a, b) => {
    if (a.node === b.node) return b.start - a.start
    const position = a.node.compareDocumentPosition(b.node)
    return position & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1
  })

  for (const item of textRanges) {
    try {
      const range = document.createRange()
      range.setStart(item.node, item.start)
      range.setEnd(item.node, item.end)

      const mark = document.createElement('mark')
      const { bg } = HIGHLIGHT_COLORS[item.spec.colorIndex]
      mark.setAttribute('data-highlight-id', item.spec.id)
      mark.style.backgroundColor = bg
      mark.style.color = 'inherit'
      mark.style.borderRadius = '3px'
      mark.style.padding = '1px 2px'
      mark.style.setProperty('box-decoration-break', 'clone')
      mark.style.setProperty('-webkit-box-decoration-break', 'clone')
      range.surroundContents(mark)
    } catch {
      // Text nodes can be replaced by React or hljs between collection and apply.
    }
  }
}

export function scrollToRenderedOffset(root: Element, charOffset: number): boolean {
  const unit = collectRenderedUnits(root).find((candidate) => (
    candidate.start <= charOffset && candidate.start + candidate.len >= charOffset
  ))
  if (!unit) return false

  if (unit.type === 'atomic') {
    unit.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return true
  }

  try {
    const range = document.createRange()
    range.setStart(unit.node, Math.min(Math.max(0, charOffset - unit.start), unit.len))
    range.collapse(true)

    const anchor = document.createElement('span')
    anchor.setAttribute('aria-hidden', 'true')
    anchor.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;'
    range.insertNode(anchor)
    anchor.scrollIntoView({ behavior: 'smooth', block: 'center' })
    requestAnimationFrame(() => anchor.remove())
    return true
  } catch {
    return false
  }
}
