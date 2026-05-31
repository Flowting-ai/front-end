"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { HighlightMark } from "@/components/HighlightMark";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import DOMPurify from "isomorphic-dompurify";
import { CodeBlock } from "@/components/chat/CodeBlock";
import { CitationChip } from "@/components/chat/ResponseBlocks";
import type { Components } from "react-markdown";
import type { Pluggable } from "unified";
import type { WebCitation } from "@/hooks/use-chat-state";

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins: Pluggable[] = [rehypeKatex];

// ── Highlight mark types & rehype plugin ──────────────────────────────────────

export type HighlightSpec = { id: string; text: string; colorIndex: 0 | 1 | 2 | 3 }

// Minimal HAST-compatible node shapes - avoids importing @types/hast directly.
type HastNodeAny = {
  type:        string
  value?:      string
  tagName?:    string
  properties?: Record<string, unknown>
  children?:   HastNodeAny[]
}

const SKIP_TAGS = new Set(['code', 'pre'])

function walkNode(node: HastNodeAny, specs: HighlightSpec[]): void {
  if (!node.children) return
  const next: HastNodeAny[] = []
  for (const child of node.children) {
    if (child.type === 'text' && typeof child.value === 'string') {
      next.push(...annotateText(child.value, specs))
    } else {
      if (!SKIP_TAGS.has(child.tagName ?? '')) walkNode(child, specs)
      next.push(child)
    }
  }
  node.children = next
}

function annotateText(text: string, specs: HighlightSpec[]): HastNodeAny[] {
  type Match = { start: number; end: number; colorIndex: 0 | 1 | 2 | 3; id: string }
  const matches: Match[] = []
  for (const spec of specs) {
    let pos = 0
    let idx: number
    while ((idx = text.indexOf(spec.text, pos)) !== -1) {
      matches.push({ start: idx, end: idx + spec.text.length, colorIndex: spec.colorIndex, id: spec.id })
      pos = idx + 1
    }
  }
  if (!matches.length) return [{ type: 'text', value: text }]
  // Sort by start; on tie prefer longer match. Then remove overlaps.
  matches.sort((a, b) => a.start - b.start || b.end - a.end)
  const resolved: Match[] = []
  let cursor = 0
  for (const m of matches) {
    if (m.start >= cursor) { resolved.push(m); cursor = m.end }
  }
  const nodes: HastNodeAny[] = []
  let p = 0
  for (const m of resolved) {
    if (m.start > p) nodes.push({ type: 'text', value: text.slice(p, m.start) })
    nodes.push({
      type:       'element',
      tagName:    'mark',
      properties: { className: [`hl-color-${m.colorIndex}`], 'data-highlight-id': m.id },
      children:   [{ type: 'text', value: text.slice(m.start, m.end) }],
    })
    p = m.end
  }
  if (p < text.length) nodes.push({ type: 'text', value: text.slice(p) })
  return nodes
}

// Returns a rehype plugin pre-configured with the highlight specs for this render.
function makeHighlightMarksPlugin(specs: HighlightSpec[]) {
  return function () {
    return function (tree: HastNodeAny) {
      walkNode(tree, specs)
    }
  }
}

// ── Base link component (no citation awareness) ───────────────────────────────

function BaseLink({ href, children }: { href?: string; children?: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: "var(--brown-500)",
        textDecoration: "underline",
        textUnderlineOffset: "2px",
      }}
    >
      {children}
    </a>
  );
}

// ── Citation-aware link factory ────────────────────────────────────────────────
// When webCitations are provided, the `a` renderer intercepts:
//   1. citation://N  - explicit {N} / [N] markers converted by preprocessCitations()
//   2. Bare URLs     - auto-linked by remarkGfm that match a known webCitation URL

function makeAComponent(webCitations?: WebCitation[]): Components["a"] {
  if (!webCitations?.length) return BaseLink;

  // O(1) URL → citation-index lookup
  const urlMap = new Map<string, number>();
  webCitations.forEach((c, i) => { if (c.url) urlMap.set(c.url, i); });

  return function CitationAwareLink({ href, children }) {
    // Explicit citation reference: citation://N (from preprocessCitations)
    const citRef = href?.match(/^citation:\/\/(\d+)$/);
    if (citRef) {
      const n = parseInt(citRef[1], 10);
      return <CitationChip n={n} citation={webCitations[n - 1]} />;
    }
    // URL matches a known webCitation → replace with numbered chip
    if (href && urlMap.has(href)) {
      const idx = urlMap.get(href)!;
      return <CitationChip n={idx + 1} citation={webCitations[idx]} />;
    }
    return <BaseLink href={href}>{children}</BaseLink>;
  };
}

// ── Convert explicit {N} and [N] citation markers to sentinel links ────────────
// These survive remark/rehype processing because they become standard links.

function preprocessCitations(content: string): string {
  return content
    // {N} → [[N]](citation://N)
    // Excludes LaTeX exponent syntax like a^{2} or a_{2} by blocking ^ and _ as
    // preceding characters, and word chars to avoid mid-word false positives.
    .replace(/(?<![[\]\w^_])\{(\d+)\}/g, (_, n) => `[[${n}]](citation://${n})`)
    // [N] → [[N]](citation://N)
    // Excludes [N] directly attached to a word character (letter/digit) so that
    // exponent notation like a[2], b[2] is never treated as a citation reference.
    // Real citation markers always follow whitespace or punctuation, not a bare letter.
    .replace(/(?<![[\]\w])\[(\d+)\](?!\()/g, (_, n) => `[[${n}]](citation://${n})`);
}

const BASE_COMPONENTS: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const language = match ? match[1] : undefined;
    const value = String(children).replace(/\n$/, "");

    // Inline code (no language class, inside a <p>)
    if (!className && !value.includes("\n")) {
      return (
        <code
          style={{
            fontFamily: "var(--font-code)",
            fontSize: "13px",
            background: "var(--neutral-800-10)",
            color: "var(--neutral-900)",
            borderRadius: "4px",
            padding: "1px 5px",
            border: "1px solid var(--neutral-700-12)",
            whiteSpace: "pre",
          }}
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <CodeBlock
        language={language}
        value={value}
        elementKey={`code-${language}-${value.slice(0, 20)}`}
      />
    );
  },
  pre({ children }) {
    // Let CodeBlock handle the wrapping
    return <>{children}</>;
  },
  a({ href, children }) {
    return <BaseLink href={href}>{children}</BaseLink>;
  },
  table({ children, ...props }) {
    return (
      <div
        className="kaya-scrollbar"
        style={{ overflowX: "auto", margin: "16px 0", borderRadius: "8px", border: "1px solid var(--neutral-200)" }}
      >
        <table
          style={{
            width: "100%",
            minWidth: "540px",
            borderCollapse: "collapse",
            fontSize: "14px",
            lineHeight: "22px",
            fontFamily: "var(--font-body)",
            tableLayout: "auto",
          }}
          {...props}
        >
          {children}
        </table>
      </div>
    );
  },
  thead({ children, ...props }) {
    return (
      <thead
        style={{ backgroundColor: "var(--neutral-50)" }}
        {...props}
      >
        {children}
      </thead>
    );
  },
  th({ children, ...props }) {
    return (
      <th
        style={{
          padding: "10px 14px",
          textAlign: "left",
          fontWeight: 600,
          fontSize: "13px",
          color: "var(--neutral-700)",
          borderBottom: "1px solid var(--neutral-200)",
          whiteSpace: "nowrap",
          verticalAlign: "top",
        }}
        {...props}
      >
        {children}
      </th>
    );
  },
  td({ children, ...props }) {
    return (
      <td
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--neutral-100)",
          color: "var(--neutral-800)",
          verticalAlign: "top",
          minWidth: "120px",
          wordBreak: "break-word",
        }}
        {...props}
      >
        {children}
      </td>
    );
  },
  blockquote({ children, ...props }) {
    return (
      <blockquote
        style={{
          margin: "0",
          marginBottom: "14px",
          paddingLeft: "12px",
          borderLeft: "2.5px solid var(--neutral-200)",
          color: "var(--neutral-600)",
          fontStyle: "italic",
          lineHeight: "26px",
        }}
        {...props}
      >
        {children}
      </blockquote>
    );
  },
  ul({ children, ...props }) {
    return (
      <ul style={{ margin: "0", marginBottom: "14px", paddingLeft: "20px", listStyleType: "disc", display: "flex", flexDirection: "column", gap: "5px" }} {...props}>
        {children}
      </ul>
    );
  },
  ol({ children, ...props }) {
    return (
      <ol style={{ margin: "0", marginBottom: "14px", paddingLeft: "22px", listStyleType: "decimal", display: "flex", flexDirection: "column", gap: "5px" }} {...props}>
        {children}
      </ol>
    );
  },
  li({ children, ...props }) {
    return (
      <li style={{ lineHeight: "24px", color: "var(--neutral-800)", fontSize: "16px" }} {...props}>
        {children}
      </li>
    );
  },
  h1({ children, ...props }) {
    return (
      <h1 style={{ fontSize: "22px", fontWeight: 500, color: "var(--neutral-900)", fontFamily: "var(--font-body)", lineHeight: "30px", margin: "10px 0 16px" }} {...props}>
        {children}
      </h1>
    );
  },
  h2({ children, ...props }) {
    return (
      <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--neutral-900)", fontFamily: "var(--font-body)", lineHeight: "26px", margin: "8px 0 14px" }} {...props}>
        {children}
      </h2>
    );
  },
  h3({ children, ...props }) {
    return (
      <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--neutral-900)", fontFamily: "var(--font-body)", lineHeight: "24px", margin: "6px 0 14px" }} {...props}>
        {children}
      </h3>
    );
  },
  hr() {
    return (
      <hr style={{ border: "none", borderTop: "1px solid var(--neutral-200)", margin: "16px 0" }} />
    );
  },
  p({ children, ...props }) {
    return (
      <p style={{ margin: "0", marginBottom: "14px", lineHeight: "26px", fontWeight: 400, fontSize: "16px", color: "var(--neutral-800)" }} {...props}>
        {children}
      </p>
    );
  },
  mark({ children, className, node }) {
    const m = String(className ?? '').match(/hl-color-(\d)/)
    const colorIndex = (m ? Number(m[1]) : 0) as 0 | 1 | 2 | 3
    const rawId = node?.properties?.['data-highlight-id']
    const highlightId = typeof rawId === 'string' ? rawId : undefined
    return (
      <HighlightMark colorIndex={colorIndex} data-highlight-id={highlightId}>
        {children}
      </HighlightMark>
    )
  },
};

// DOMPurify with the html profile treats the entire string as HTML, so LaTeX
// special chars like <, >, and & inside math delimiters get escaped or stripped
// before rehype-katex ever sees them. Stash all math blocks (both $$ display and
// $ inline) before sanitizing, then restore them after so their content is
// never touched by DOMPurify.
function sanitizePreservingMath(content: string): string {
  const stash: string[] = []
  const token = (i: number) => `\x02M${i}\x02`

  const guarded = content
    // Display math first (longer delimiter wins over inline $)
    .replace(/\$\$([\s\S]*?)\$\$/g, (m) => { stash.push(m); return token(stash.length - 1) })
    // Inline math (no newlines inside — avoids grabbing prose dollar signs)
    .replace(/\$([^$\n]+?)\$/g, (m) => { stash.push(m); return token(stash.length - 1) })

  const sanitized = DOMPurify.sanitize(guarded, { USE_PROFILES: { html: true } })

  return sanitized.replace(/\x02M(\d+)\x02/g, (_, i) => stash[Number(i)] ?? '')
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
function normalizeMathDelimiters(content: string): string {
  // \[...\] → display math block
  let out = content.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`);
  // \(...\) → inline math
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math}$`);
  return out;
}

// When the model outputs **Title** mid-sentence with no surrounding whitespace
// (e.g. "...for 2026.**Planning the search**I'll perform..."), insert blank lines
// so ReactMarkdown treats it as a standalone paragraph/heading rather than inline bold.
function normalizeInlineBoldTitles(content: string): string {
  return content
    // Collapse bold markers split across line breaks (LLM sometimes puts ** on its own line):
    // **text\n**  →  **text**   (closing marker landed on the next line)
    .replace(/(\*\*[^*\n]+)\n\s*(\*\*)/g, '$1$2')
    // **\ntext**  →  **text**   (newlines right after the opening marker)
    .replace(/(\*\*)\n+([^*\n]+\*\*)/g, '$1$2')
    // Blank line BEFORE **..** when immediately preceded by a non-whitespace char
    .replace(/([^\s\n])(\*\*[^*\n]+\*\*)/g, '$1\n\n$2')
    // Blank line AFTER **..** when immediately followed by a letter (start of new sentence)
    .replace(/(\*\*[^*\n]+\*\*)([A-Za-z])/g, '$1\n\n$2');
}

// Bold markers that cross paragraph boundaries (\n\n) can never be rendered by
// remark — it resets bold state at every paragraph break. When the LLM splits a
// **bold span** across paragraphs, every subsequent ** in the document may appear
// as a literal. Fix by inspecting each paragraph independently:
//
//   • Odd count + trailing **     → orphaned opener with no content, remove it
//   • Odd count + right-flanking  → orphaned closer from a prior paragraph, remove it
//   • Odd count + left-flanking   → opener with no closer in this paragraph, close it
//
// This runs BEFORE normalizeInlineBoldTitles so the within-paragraph cross-line
// patterns are handled after the paragraph-level structure is already clean.
function repairCrossParaBold(content: string): string {
  // Protect code regions — ** inside fences/spans must not be counted or moved.
  const codeBlocks: string[] = []
  const guarded = content.replace(/```[\s\S]*?```|`[^`\n]+`/g, m => {
    codeBlocks.push(m)
    return `\x02${codeBlocks.length - 1}\x02`
  })

  // Split on paragraph breaks, keeping the separators so we can rejoin cleanly.
  const segments = guarded.split(/(\n{2,})/)

  const fixed = segments.map(seg => {
    // Pure-newline separators — keep verbatim.
    if (/^\n+$/.test(seg)) return seg

    const markers = [...seg.matchAll(/\*\*/g)]
    if (markers.length % 2 === 0) return seg  // Even → balanced, nothing to do.

    // ── Odd marker count: find and repair the orphan ──────────────────────────

    if (markers.length === 1) {
      const pos       = markers[0].index!
      const charBefore = pos > 0 ? seg[pos - 1] : ''
      const afterSlice = seg.slice(pos + 2)
      // Trailing: ** at end of paragraph with no text after it.
      const isTrailing = /^\s*$/.test(afterSlice)
      // Right-flanking: non-whitespace immediately precedes ** → it's a closer.
      const isRightFlanking = charBefore !== '' && !/[\s\n]/.test(charBefore)

      if (isTrailing || isRightFlanking) {
        // Orphaned closing marker or opener with no content → remove.
        return seg.slice(0, pos) + afterSlice
      }
      // Orphaned opening marker with actual content → close the span at paragraph end.
      return seg.trimEnd() + '**'
    }

    // Multiple markers (≥ 3), odd count — the paragraph has balanced pairs plus
    // one stray. If the paragraph ends with **, that's the stray; strip it.
    // Otherwise close the span at the end (covers the opener-without-closer case).
    if (/\*\*\s*$/.test(seg)) {
      return seg.replace(/\*\*(\s*)$/, '$1')
    }
    return seg.trimEnd() + '**'
  })

  let result = fixed.join('')
  result = result.replace(/\x02(\d+)\x02/g, (_, n) => codeBlocks[Number(n)])
  return result
}

// LLMs occasionally produce orphaned ** markers that corrupt remark's bold-tracking
// state, causing every subsequent ** pair in the document to render as literal text
// instead of bold. Two common patterns:
//
//   1. A lone ** on its own line — always orphaned because valid bold always has text
//      between its delimiters. Removing it restores the parser's balance.
//
//   2. ** immediately before a list bullet ("**- item") — the model placed a closing
//      marker at the wrong position. Removing the ** prefix lets the list parse correctly.
//
// After those targeted removals, recount all ** outside code spans/fences.
// If the total is still odd (one unclosed bold remains), append a closing ** —
// the same streaming-safe strategy used by closeOpenFences for code blocks.
function fixOrphanedBold(content: string): string {
  let out = content
    // 1. Lone ** on its own line (with optional surrounding whitespace) — remove entirely.
    .replace(/^[ \t]*\*\*[ \t]*$/gm, '')
    // 2. ** at the start of a line immediately before a list bullet — strip the ** prefix.
    .replace(/^(\s*)\*\*\s*(?=[-•+*]\s|\d+\.\s)/gm, '$1')

  // 3. Count ** markers outside code fences and inline code spans.
  //    Replace code regions with placeholder chars (preserving length is not required,
  //    we only need to eliminate their ** from the count).
  const stripped = out
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]+`/g, '')
  const count = (stripped.match(/\*\*/g) ?? []).length
  // Odd count → unmatched bold open somewhere; close it.
  if (count % 2 !== 0) out = out + '**'

  return out
}

interface MarkdownRendererProps {
  content: string;
  webCitations?: WebCitation[];
  highlights?: HighlightSpec[];
  /**
   * When true, raw HTML in the source (e.g. an LLM that emits `<table>`
   * tags instead of markdown tables) is parsed and rendered. The input is
   * sanitised with DOMPurify before rendering so `<script>`, javascript:
   * URLs, and inline event handlers are stripped. Default: false.
   */
  allowHtml?: boolean;
}

export function MarkdownRenderer({ content, webCitations, highlights, allowHtml = false }: MarkdownRendererProps) {
  const hasCitations = !!webCitations?.length;

  const resolvedComponents = useMemo<Components>(
    () => hasCitations
      ? { ...BASE_COMPONENTS, a: makeAComponent(webCitations) }
      : BASE_COMPONENTS,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasCitations, webCitations],
  );

  const processed = useMemo(() => {
    // Pipeline (innermost runs first):
    //   repairCrossParaBold      — per-paragraph ** balance (paragraph-break cascade fix)
    //   normalizeInlineBoldTitles — within-paragraph cross-line-break ** collapse
    //   fixOrphanedBold          — lone ** lines, ** before bullets, doc-level balance
    //   normalizeMathDelimiters  — LaTeX delimiter normalisation
    //   closeOpenFences          — unclosed code fence guard
    const base = hasCitations
      ? closeOpenFences(normalizeMathDelimiters(fixOrphanedBold(normalizeInlineBoldTitles(repairCrossParaBold(preprocessCitations(content))))))
      : closeOpenFences(normalizeMathDelimiters(fixOrphanedBold(normalizeInlineBoldTitles(repairCrossParaBold(content)))));
    // Sanitise only when we're about to ask rehype-raw to parse HTML —
    // for pure-markdown rendering, DOMPurify's HTML-context parsing can
    // corrupt characters like `<` that appear in code blocks or math.
    // sanitizePreservingMath stashes math blocks before DOMPurify runs so
    // LaTeX with <, >, or & (e.g. alignment environments) is never corrupted.
    return allowHtml
      ? sanitizePreservingMath(base)
      : base;
  }, [hasCitations, content, allowHtml]);

  const resolvedRehypePlugins = useMemo<Pluggable[]>(() => {
    const plugins: Pluggable[] = highlights?.length
      ? [rehypeKatex, makeHighlightMarksPlugin(highlights)]
      : [...rehypePlugins];
    // rehype-katex must run BEFORE rehype-raw. rehype-raw re-serialises the
    // HAST tree, which would destroy the math node metadata that rehype-katex
    // needs to render KaTeX. By running rehype-katex first, math is already
    // rendered to HTML before rehype-raw processes the rest of the document.
    if (allowHtml) plugins.push(rehypeRaw);
    return plugins;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlights, allowHtml]);

  return (
    <div
      style={{
        fontFamily: "var(--font-body)",
        fontSize: "16px",
        lineHeight: "26px",
        color: "var(--neutral-800)",
        wordBreak: "break-word",
      }}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={resolvedRehypePlugins}
        components={resolvedComponents}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}

export function renderInlineMarkdown(text: string): React.ReactNode {
  const markdownRegex = /(\*\*|__)(.+?)\1|\*([^*\n]+?)\*|`([^`\n]+)`/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let count = 0;

  while ((match = markdownRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[2] !== undefined) {
      nodes.push(<strong key={`md-b-${count++}`}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      nodes.push(<em key={`md-i-${count++}`}>{match[3]}</em>);
    } else if (match[4] !== undefined) {
      nodes.push(
        <code
          key={`md-c-${count++}`}
          style={{
            fontFamily: "var(--font-code)",
            fontSize: "13px",
            background: "var(--neutral-800-10)",
            color: "var(--neutral-900)",
            borderRadius: "4px",
            padding: "1px 5px",
            border: "1px solid var(--neutral-700-12)",
            whiteSpace: "pre",
          }}
        >
          {match[4]}
        </code>,
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : text;
}

export function stripMarkdown(text: unknown): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}
