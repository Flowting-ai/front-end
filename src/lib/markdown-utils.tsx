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
import { stripResponseInterruptedMarker } from "@/lib/model-error";

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins: Pluggable[] = [rehypeKatex];

// ── Highlight mark types & rehype plugin ──────────────────────────────────────

export type HighlightSpec = {
  id: string;
  text: string;
  colorIndex: 0 | 1 | 2 | 3;
  startOffset?: number;
  endOffset?: number;
}

// Minimal HAST-compatible node shapes - avoids importing @types/hast directly.
type HastNodeAny = {
  type:        string
  value?:      string
  tagName?:    string
  properties?: Record<string, unknown>
  children?:   HastNodeAny[]
}

// Only skip <pre> (fenced code blocks handled by LineRenderer/CodeBlock).
// Inline <code> spans are allowed to receive highlight marks.
const SKIP_TAGS = new Set(['pre'])

// True when a HAST element is a KaTeX subtree root (rehype-katex output). LaTeX
// is intentionally never highlighted, so we don't descend into these — doing so
// would mark text nodes inside the rendered formula and break its layout.
function isKatexElement(node: HastNodeAny): boolean {
  const cls = node.properties?.className
  if (Array.isArray(cls)) return cls.some(c => typeof c === 'string' && c.split('-')[0] === 'katex')
  if (typeof cls === 'string') return cls.split(/\s+/).some(c => c.split('-')[0] === 'katex')
  return false
}

function walkNode(node: HastNodeAny, specs: HighlightSpec[]): void {
  if (!node.children) return
  const next: HastNodeAny[] = []
  for (const child of node.children) {
    if (child.type === 'text' && typeof child.value === 'string') {
      next.push(...annotateText(child.value, specs))
    } else {
      if (!SKIP_TAGS.has(child.tagName ?? '') && !isKatexElement(child)) walkNode(child, specs)
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
    // All other links render as proper clickable links
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

function isLikelyInlineMath(value: string): boolean {
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

// Markdown preprocessing pipeline (excluding web-citation handling and HTML
// sanitisation). Shared by every renderer (e.g. the pin card) so behaviour is
// consistent. Only additive, non-destructive normalisations live here — emphasis
// (**bold**) is deliberately left untouched, since react-markdown + remark-gfm
// already parse it correctly and regex "repairs" corrupt valid input.
// Innermost runs first:
//   stripResponseInterruptedMarker → stripCollapsibleHtml → fixHeadingSpace
//   → normalizeMathDelimiters → escapeCurrencyDollars → closeOpenFences
export function preprocessMarkdown(content: string): string {
  return closeOpenFences(
    escapeCurrencyDollars(
      normalizeMathDelimiters(
        fixHeadingSpace(
          stripCollapsibleHtml(
            stripResponseInterruptedMarker(content),
          ),
        ),
      ),
    ),
  );
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
    [hasCitations, webCitations],
  );

  const processed = useMemo(() => {
    const base = hasCitations
      ? preprocessMarkdown(preprocessCitations(content))
      : preprocessMarkdown(content);
    // Sanitise only when about to ask rehype-raw to parse HTML — for pure-markdown
    // rendering, DOMPurify's HTML-context parsing corrupts `<` in code/math.
    // sanitizePreservingMath stashes math blocks before DOMPurify runs.
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
  }, [highlights, allowHtml]);

  return (
    <div
      className="kaya-chat-markdown"
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
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove stray/unclosed emphasis markers left by truncated titles
    // (e.g. "**Predictions for the 2026 FIFA World Cup (as of late").
    .replace(/\*\*/g, "")
    .trim();
}
