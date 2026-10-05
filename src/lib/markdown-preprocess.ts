/**
 * markdown-preprocess.ts
 *
 * Pure text-transformation helpers for markdown content, split out from
 * markdown-utils.tsx so that file only exports the MarkdownRenderer
 * component (Fast Refresh can't safely preserve component state in a file
 * that also exports non-component values). `preprocessMarkdown` is the
 * shared preprocessing pipeline used by every renderer (chat, pin card) so
 * behaviour stays consistent; `isLikelyInlineMath` is reused directly by
 * line-renderer.tsx to apply the same math-vs-currency guard.
 */

import { stripResponseInterruptedMarker } from "@/lib/model-error";
import { findCodeRanges } from "@/lib/content-parser";

// Indented code blocks (4+ spaces or a tab) that start after a blank line
// following a top-level paragraph, or at the top. Indented lines under a list
// item are list content, not code, so they are left out (conservatively).
function findIndentedCodeRanges(content: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  let offset = 0
  let prevBlank = true
  let inList = false
  let block: [number, number] | null = null
  for (const line of content.split('\n')) {
    const blank = /^[ \t\r]*$/.test(line)
    const indented = /^(?: {4}|\t)/.test(line)
    if (block && !blank && !indented) {
      ranges.push(block)
      block = null
    }
    if (block) {
      if (!blank) block[1] = offset + line.length
    } else if (!blank && indented && prevBlank && !inList) {
      block = [offset, offset + line.length]
    } else if (!blank && !indented) {
      inList = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]/.test(line)
    }
    prevBlank = blank
    offset += line.length + 1
  }
  if (block) ranges.push(block)
  return ranges
}

// Replaces each range (merged where they overlap) with a stash token.
function stashRanges(content: string, ranges: Array<[number, number]>, stash: string[], token: (i: number) => string): string {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  let out = ''
  let last = 0
  for (let r = 0; r < sorted.length; r++) {
    const start = Math.max(sorted[r][0], last)
    let end = sorted[r][1]
    while (r + 1 < sorted.length && sorted[r + 1][0] < end) end = Math.max(end, sorted[++r][1])
    if (end <= start) continue
    out += content.slice(last, start)
    stash.push(content.slice(start, end))
    out += token(stash.length - 1)
    last = end
  }
  return out + content.slice(last)
}

// Code (fenced ``` / ~~~ blocks, unclosed ones to the end, and inline spans —
// the same scanner the widget parser uses) and display math are hidden from
// `transform`, then restored.
function protectMarkdownRegions(content: string, transform: (value: string) => string): string {
  const stash: string[] = []
  const token = (i: number) => `\x03P${i}\x03`
  const guarded = stashRanges(content, findCodeRanges(content), stash, token)
    .replace(/\$\$[\s\S]*?\$\$/g, (match) => {
      stash.push(match)
      return token(stash.length - 1)
    })

  // A display-math stash can itself contain code tokens, so restore recursively.
  const restore = (value: string): string =>
    value.replace(/\x03P(\d+)\x03/g, (_, i) => restore(stash[Number(i)] ?? ''))
  return restore(transform(guarded))
}

function findNextUnescapedDollar(content: string, start: number): number {
  for (let i = start; i < content.length; i++) {
    if (content[i] === '\n') return -1
    if (content[i] === '$' && content[i - 1] !== '\\') return i
  }
  return -1
}

// Exported so other line-based renderers (e.g. line-renderer.tsx, used for
// the reasoning/"thinking" disclosure) can apply the same guard before
// treating a $...$ span as real math — without it, a price sentence with two
// literal dollar signs gets its whole span rendered as KaTeX, which collapses
// ordinary whitespace between words.
export function isLikelyInlineMath(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 100) return false
  if (/[;:]/.test(trimmed)) return false
  if (/\b(?:mo|month|monthly|yr|year|yearly|day|week|user|seat|credit|token|tokens|plan|plans)\b/i.test(trimmed)) {
    return false
  }
  if (/\b[a-z]{3,}\b/i.test(trimmed.replace(/\\[a-z]+/gi, ''))) return false
  return /[=^_\\{}()+*/<>|]|\d\s*[a-z]/i.test(trimmed)
}

// Currency like "$50-150/mo ... $500+/mo" is common in generated business
// answers. remark-math sees two dollar signs in one line as an inline math span,
// which can turn a normal price sentence into KaTeX italics. Convert numeric
// currency markers to an entity so they render as "$" but cannot delimit math.
// Code, display math, and real inline math are left alone.
function escapeCurrencyDollars(content: string): string {
  return protectMarkdownRegions(content, (value) => {
    let out = ''

    for (let i = 0; i < value.length; i++) {
      const char = value[i]
      if (char !== '$' || value[i - 1] === '\\') {
        out += char
        continue
      }

      let next = i + 1
      while (value[next] === ' ' || value[next] === '\t') next++

      if (!/\d/.test(value[next] ?? '')) {
        out += char
        continue
      }

      const close = findNextUnescapedDollar(value, next + 1)
      if (close !== -1 && isLikelyInlineMath(value.slice(next, close))) {
        out += char
      } else {
        out += '&#36;'
      }
    }

    return out
  })
}

// ATX headings need a space after the hashes ("###Heading" renders as literal
// text). The `[A-Za-z]` guard leaves "#1" / "#5 goal" (hashtags, not headings)
// untouched. Code regions are protected so a fenced "###define" stays verbatim.
function fixHeadingSpace(content: string): string {
  return protectMarkdownRegions(content, (value) =>
    value.replace(/^(#{1,6})([A-Za-z])/gm, "$1 $2"),
  );
}

// HTML rendering is off by default, so a model that wraps content in collapsible
// tags (<details>/<summary>) makes remark treat the whole block as one raw HTML
// node — the tags show literally and the Markdown inside (bold, line breaks) is
// swallowed unparsed. Strip just these wrapper tags, leaving paragraph breaks so
// the inner content renders as normal Markdown. Code regions are protected.
function stripCollapsibleHtml(content: string): string {
  return protectMarkdownRegions(content, (value) =>
    value.replace(/<\/?(?:details|summary)(?:\s[^>]*)?>/gi, "\n\n"),
  );
}

// During streaming, an unclosed code fence causes react-markdown to extend
// the code block over all remaining text. Count fences and append a close
// if the tally is odd so the parser always sees balanced delimiters.
function closeOpenFences(content: string): string {
  const count = (content.match(/^```/gm) ?? []).length;
  return count % 2 !== 0 ? content + "\n```" : content;
}

// remark-math only understands $...$ and $$...$$. Claude and other LLMs
// commonly emit \(...\) for inline math and \[...\] for block math (standard
// LaTeX delimiters). Convert them so rehype-katex can render them.
// Block math is placed on its own lines so remark-math treats it as a flow
// (display-mode) equation rather than inline.
// Code spans / fences are excluded by running this before fence-closing and
// only on the text layer - false positives (literal \( in prose) are
// extremely rare in LLM output.
//
// The `$...$`/`$$...$$` spans this produces are stashed into `stash` (as
// opaque `\x04N{i}\x04` tokens) rather than left inline, so a later pipeline
// stage — escapeCurrencyDollars, whose job is to guard against literal
// currency text like "$50/mo" — never re-examines them. An explicit \(...\)
// from the model is unambiguously real math regardless of how trivial its
// content is (a bare `\(1\)`), but escapeCurrencyDollars's heuristic doesn't
// know that: it previously misclassified spans like `$1$` as "not math" and
// rewrote only their opening `$` to `&#36;`, leaving the closing `$`
// dangling. remark-math then re-paired that orphaned `$` with the NEXT
// unrelated `$` in the text, swallowing everything in between (including
// plain English) into one bogus math span. Restoring the stash happens after
// escapeCurrencyDollars runs (see preprocessMarkdown) so it can't happen.
function normalizeMathDelimiters(content: string, stash: string[]): string {
  const token = (i: number) => `\x04N${i}\x04`
  // \[...\] → display math block
  let out = content.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
    stash.push(`\n$$\n${math.trim()}\n$$\n`)
    return token(stash.length - 1)
  });
  // \(...\) → inline math
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => {
    stash.push(`$${math}$`)
    return token(stash.length - 1)
  });
  return out;
}

function restoreMathStash(content: string, stash: string[]): string {
  return content.replace(/\x04N(\d+)\x04/g, (_, i) => stash[Number(i)] ?? '')
}

// remark-math ends a math span at the first `$`, escaped or not, so `$\$5$`
// closes right after the backslash and garbles the rest of the line. Inside a
// math span, rewrite each `\$` to a KaTeX dollar that contains no `$`. Spans
// are paired on unescaped dollars (display `$$…$$` may span lines, inline
// `$…$` may not); `\$` outside math is left for Markdown to unescape. Code
// (fenced, including a fence still open mid-stream, inline, and indented
// blocks) is untouched.
function escapeDollarsInMath(content: string): string {
  const escape = (math: string) => math.replace(/\\\$/g, '\\text{\\textdollar}')
  const code: string[] = []
  const codeRanges = [...findCodeRanges(content), ...findIndentedCodeRanges(content)]
  const guarded = stashRanges(content, codeRanges, code, (i) => `\x03C${i}\x03`)

  let out = ''
  let i = 0
  while (i < guarded.length) {
    if (guarded[i] === '$' && guarded[i - 1] !== '\\') {
      if (guarded[i + 1] === '$') {
        let close = guarded.indexOf('$$', i + 2)
        while (close !== -1 && guarded[close - 1] === '\\') close = guarded.indexOf('$$', close + 1)
        if (close !== -1) {
          out += `$$${escape(guarded.slice(i + 2, close))}$$`
          i = close + 2
          continue
        }
      } else {
        const close = findNextUnescapedDollar(guarded, i + 1)
        if (close !== -1) {
          out += `$${escape(guarded.slice(i + 1, close))}$`
          i = close + 1
          continue
        }
      }
    }
    out += guarded[i]
    i++
  }

  return out.replace(/\x03C(\d+)\x03/g, (_, n) => code[Number(n)] ?? '')
}

// Markdown preprocessing pipeline (excluding web-citation handling and HTML
// sanitisation). Shared by every renderer (e.g. the pin card) so behaviour is
// consistent. Only additive, non-destructive normalisations live here — emphasis
// (**bold**) is deliberately left untouched, since react-markdown + remark-gfm
// already parse it correctly and regex "repairs" corrupt valid input.
// Innermost runs first:
//   stripResponseInterruptedMarker → stripCollapsibleHtml → fixHeadingSpace
//   → normalizeMathDelimiters → escapeCurrencyDollars → restoreMathStash
//   → escapeDollarsInMath → closeOpenFences
// The math stash is threaded through and restored AFTER escapeCurrencyDollars
// (not inside normalizeMathDelimiters itself) specifically so that stage's
// currency-detection scan never sees the $...$/$$...$$ spans normalizeMath
// Delimiters just produced from explicit model LaTeX — see the comment on
// normalizeMathDelimiters.
export function preprocessMarkdown(content: string): string {
  const mathStash: string[] = [];
  const withoutHtml = stripCollapsibleHtml(stripResponseInterruptedMarker(content));
  const withHeadingSpace = fixHeadingSpace(withoutHtml);
  const withMathTokens = normalizeMathDelimiters(withHeadingSpace, mathStash);
  const withCurrencyEscaped = escapeCurrencyDollars(withMathTokens);
  const withMathRestored = restoreMathStash(withCurrencyEscaped, mathStash);
  return closeOpenFences(escapeDollarsInMath(withMathRestored));
}

// Minimal HAST shape (react-markdown's `node` prop) - avoids importing @types/hast.
interface HastLike {
  type: string
  value?: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastLike[]
}

function hastText(node: HastLike): string {
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(hastText).join('')
}

/**
 * Reads a fenced code block from the HAST `pre > code` pair react-markdown
 * hands a `pre` component: the language is the `language-*` class verbatim
 * (so `c++` and `objective-c` survive) and the value is the code's text,
 * never `String(undefined)`. A `pre` without a `code` child (raw HTML) yields
 * its own text.
 */
export function readCodeBlock(pre: HastLike | undefined): { language?: string; value: string } {
  const code = pre?.children?.find((child) => child.type === 'element' && child.tagName === 'code')
  const cls = code?.properties?.className
  const classes = Array.isArray(cls) ? cls : typeof cls === 'string' ? cls.split(/\s+/) : []
  const languageClass = classes.find((c): c is string => typeof c === 'string' && c.startsWith('language-'))
  const source = code ?? pre
  return {
    language: languageClass?.slice('language-'.length) || undefined,
    value: source ? hastText(source).replace(/\n$/, '') : '',
  }
}

/** react-markdown hands every custom component the HAST `node`; spread as-is
 *  it lands on the DOM element as node="[object Object]". */
export function withoutNode<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const { node: _node, ...rest } = props // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest
}

export function stripMarkdown(text: unknown): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove stray/unclosed emphasis markers left by truncated titles
    // (e.g. "**Predictions for the 2026 FIFA World Cup (as of late").
    .replace(/\*\*/g, "")
    .trim();
}
