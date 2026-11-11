import { STRUCTURED_TAGS } from '@/lib/content-parser'
import { unescapeXml } from '@/lib/xml-widgets'
import { stripLibraryMarkers } from '@/components/Library/chat/library-citations'

// What a message's Copy button puts on the clipboard: the text the reader sees,
// not the raw stream. Widget blocks (<metrics>, <table>, …) become plain lines and
// web-citation markers ([1], {1}) go, except inside code, which is copied as written.

const CODE_SEGMENT = /(?:^|\n) {0,3}(`{3,}|~{3,})[^\n]*(?:\n[\s\S]*?(?:\n {0,3}\1[`~]*[ \t]*(?=\n|$)|$)|$)|(`+)(?!`)[\s\S]*?[^`]\2(?!`)/g
const WIDGET_BLOCK = new RegExp(`<(${STRUCTURED_TAGS.join('|')})\\b[^>]*?(?:/>|>[\\s\\S]*?</\\1\\s*>)`, 'g')
const ATTR = /([a-zA-Z-]+)\s*=\s*"([^"]*)"/g
// Attributes that only style or place a widget; their values mean nothing as text.
const LAYOUT_ATTRS = new Set(['type', 'color', 'colour', 'variant', 'icon', 'trend', 'id', 'lat', 'lng', 'lon', 'zoom', 'width', 'height', 'align', 'tone'])

function widgetText(block: string): string {
  return unescapeXml(
    block
      // Each element's own attribute values, e.g. <metric label="Revenue" value="$4M"/> → "Revenue: $4M".
      .replace(/<[a-zA-Z][^>]*>/g, tag => {
        const values = [...tag.matchAll(ATTR)].filter(([, k]) => !LAYOUT_ATTRS.has(k.toLowerCase())).map(([, , v]) => v.trim()).filter(Boolean)
        return values.length ? `\n${values.join(': ')}${tag.endsWith('/>') ? '\n' : ' '}` : tag.startsWith('<t') || tag.startsWith('<r') ? '' : '\n'
      })
      .replace(/<\/t[dh]\s*>/g, ' | ')
      .replace(/<\/[a-zA-Z][^>]*>/g, '\n'),
  )
    .split('\n')
    .map(line => line.replace(/\s*\|\s*$/, '').replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

function proseText(text: string): string {
  return text
    .replace(WIDGET_BLOCK, block => `\n${widgetText(block)}\n`)
    .replace(/[ \t]*(?<![[\]\w^_])\{\d+\}/g, '')
    .replace(/[ \t]*(?<![[\]\w])\[\d+\](?!\()/g, '')
    .replace(/[ \t]+([.,;:!?)])/g, '$1')
}

export function messageCopyText(content: string): string {
  const text = stripLibraryMarkers(content)
  let out = ''
  let last = 0
  for (const match of text.matchAll(CODE_SEGMENT)) {
    out += proseText(text.slice(last, match.index)) + match[0]
    last = match.index + match[0].length
  }
  return (out + proseText(text.slice(last))).replace(/\n{3,}/g, '\n\n').trim()
}
