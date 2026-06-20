export interface RawRange {
  startOffset: number
  endOffset: number
}

const INLINE_TOKEN_RE =
  /\*\*([^*\n]+?)\*\*|__([^_\n]+?)__|(?<!\*)\*([^*\n]+?)\*(?!\*)|(?<!_)_([^_\n]+?)_(?!_)|`([^`\n]+?)`|\[([^\]\n]+?)\]\((https?:\/\/[^\)\n]+?)\)|~~([^~\n]+?)~~|\{(\d+)\}|\$\$([^$\n]+?)\$\$|\$([^$\n]+?)\$|(https?:\/\/[^\s\])\n>"']+|www\.[^\s\])\n>"']+|(?:[a-zA-Z0-9][a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}\/[^\s\])\n>"']*)|\\\((.+?)\\\)/g

interface VisibleRawMap {
  visibleToRaw: number[]
}

function appendRawChars(map: VisibleRawMap, text: string, rawStart: number): void {
  for (let i = 0; i < text.length; i++) {
    map.visibleToRaw.push(rawStart + i)
  }
}

function appendInlineMap(map: VisibleRawMap, text: string, rawStart: number): void {
  INLINE_TOKEN_RE.lastIndex = 0
  let last = 0
  let m: RegExpExecArray | null

  while ((m = INLINE_TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) appendRawChars(map, text.slice(last, m.index), rawStart + last)

    if (m[1] !== undefined) appendRawChars(map, m[1], rawStart + m.index + 2)
    else if (m[2] !== undefined) appendRawChars(map, m[2], rawStart + m.index + 2)
    else if (m[3] !== undefined) appendRawChars(map, m[3], rawStart + m.index + 1)
    else if (m[4] !== undefined) appendRawChars(map, m[4], rawStart + m.index + 1)
    else if (m[5] !== undefined) appendRawChars(map, m[5], rawStart + m.index + 1)
    else if (m[6] !== undefined) appendRawChars(map, m[6], rawStart + m.index + 1)
    else if (m[8] !== undefined) appendRawChars(map, m[8], rawStart + m.index + 2)
    else if (m[12] !== undefined) appendRawChars(map, m[12], rawStart + m.index)

    last = m.index + m[0].length
  }

  if (last < text.length) appendRawChars(map, text.slice(last), rawStart + last)
}

function pushRenderedNewline(map: VisibleRawMap, rawIndex: number): void {
  map.visibleToRaw.push(rawIndex)
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s|:-]+\|[\s|:-]*$/.test(line.trim())
}

function buildVisibleRawMap(content: string): VisibleRawMap {
  const map: VisibleRawMap = { visibleToRaw: [] }
  const lines = content.split("\n")
  const starts: number[] = []
  let rawCursor = 0

  for (const line of lines) {
    starts.push(rawCursor)
    rawCursor += line.length + 1
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const lineStart = starts[i]
    const trimmed = line.trim()
    const trimStart = line.indexOf(trimmed)

    if (!trimmed) {
      i++
      continue
    }

    if (trimmed.startsWith("```")) {
      i++
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        appendRawChars(map, lines[i], starts[i])
        if (i < lines.length - 1) pushRenderedNewline(map, starts[i] + lines[i].length)
        i++
      }
      i++
      continue
    }

    if (trimmed === "$$" || (trimmed.startsWith("$$") && !trimmed.endsWith("$$"))) {
      i++
      while (i < lines.length && lines[i].trim() !== "$$") i++
      i++
      continue
    }
    if ((trimmed.startsWith("$$") && trimmed.endsWith("$$")) || trimmed.startsWith("\\[")) {
      i++
      continue
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const textStart = lineStart + line.indexOf(heading[2])
      appendInlineMap(map, heading[2], textStart)
      i++
      continue
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      i++
      continue
    }

    if (trimmed.startsWith("> ")) {
      const text = trimmed.slice(2)
      appendInlineMap(map, text, lineStart + trimStart + 2)
      i++
      continue
    }

    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      appendInlineMap(map, trimmed, lineStart + trimStart)
      i += 2
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        appendInlineMap(map, lines[i].trim(), starts[i] + lines[i].indexOf(lines[i].trim()))
        i++
      }
      continue
    }

    if (/^[-*+] /.test(trimmed)) {
      while (i < lines.length && /^[-*+] /.test(lines[i].trim())) {
        const item = lines[i].trim().slice(2)
        appendInlineMap(map, item, starts[i] + lines[i].indexOf(lines[i].trim()) + 2)
        i++
      }
      continue
    }

    if (/^\d+\. /.test(trimmed)) {
      while (i < lines.length && /^\d+\. /.test(lines[i].trim())) {
        const item = lines[i].trim().replace(/^\d+\.\s/, "")
        appendInlineMap(map, item, starts[i] + lines[i].indexOf(item))
        i++
      }
      continue
    }

    while (i < lines.length) {
      const paragraphLine = lines[i]
      const paragraphTrimmed = paragraphLine.trim()
      if (!paragraphTrimmed) break
      if (/^#{1,6} /.test(paragraphTrimmed)) break
      if (paragraphTrimmed.startsWith("```")) break
      if (paragraphTrimmed.startsWith("$$")) break
      if (paragraphTrimmed.startsWith("\\[")) break
      if (/^[-*_]{3,}$/.test(paragraphTrimmed)) break
      if (paragraphTrimmed.startsWith("> ")) break
      if (/^[-*+] /.test(paragraphTrimmed)) break
      if (/^\d+\. /.test(paragraphTrimmed)) break
      if (paragraphTrimmed.startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) break

      appendInlineMap(map, paragraphLine, starts[i])
      if (i < lines.length - 1 && lines[i + 1].trim()) {
        pushRenderedNewline(map, starts[i] + paragraphLine.length)
      }
      i++
    }
  }

  return map
}

export function rawRangeFromVisibleRange(
  content: string,
  visibleStart: number,
  visibleEnd: number,
): RawRange | null {
  if (visibleEnd <= visibleStart) return null

  const map = buildVisibleRawMap(content)
  const startVisible = Math.max(0, Math.min(visibleStart, map.visibleToRaw.length - 1))
  const endVisible = Math.max(0, Math.min(visibleEnd - 1, map.visibleToRaw.length - 1))
  const startOffset = map.visibleToRaw[startVisible]
  const endOffset = map.visibleToRaw[endVisible] + 1

  if (startOffset == null || endOffset == null || endOffset <= startOffset) return null
  return { startOffset, endOffset }
}

export function hasRawRange(value: {
  startOffset?: number
  endOffset?: number
}): value is { startOffset: number; endOffset: number } {
  return (
    typeof value.startOffset === "number" &&
    typeof value.endOffset === "number" &&
    value.endOffset > value.startOffset
  )
}
