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

function protectMarkdownRegions(content: string, transform: (value: string) => string): string {
  const stash: string[] = []
  const token = (i: number) => `\x03P${i}\x03`
  const guarded = content.replace(/```[\s\S]*?```|`[^`\n]*`|\$\$[\s\S]*?\$\$/g, (match) => {
    stash.push(match)
    return token(stash.length - 1)
  })

  return transform(guarded).replace(/\x03P(\d+)\x03/g, (_, i) => stash[Number(i)] ?? '')
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

// Markdown preprocessing pipeline (excluding web-citation handling and HTML
// sanitisation). Shared by every renderer (e.g. the pin card) so behaviour is
// consistent. Only additive, non-destructive normalisations live here — emphasis
// (**bold**) is deliberately left untouched, since react-markdown + remark-gfm
// already parse it correctly and regex "repairs" corrupt valid input.
// Innermost runs first:
//   stripResponseInterruptedMarker → stripCollapsibleHtml → fixHeadingSpace
//   → normalizeMathDelimiters → escapeCurrencyDollars → restoreMathStash
//   → closeOpenFences
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
  return closeOpenFences(withMathRestored);
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
