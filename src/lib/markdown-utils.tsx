"use client";

import { useMemo } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { HighlightMark } from "@/components/HighlightMark";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import DOMPurify from "isomorphic-dompurify";
import { CodeBlock } from "@/components/chat/CodeBlock";
import { CitationChip } from "@/components/chat/CitationChip";
import type { Components } from "react-markdown";
import type { Pluggable } from "unified";
import type { WebCitation } from "@/types/chat";
import { preprocessMarkdown } from "@/lib/markdown-preprocess";

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins: Pluggable[] = [rehypeKatex];

function markdownUrlTransform(value: string, key: string): string {
  if (key === "href" && /^citation:\/\/[1-9]\d*$/.test(value)) return value;
  return defaultUrlTransform(value);
}

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
            fontSize: "var(--prose-size-code)",
            background: "var(--neutral-800-10)",
            color: "var(--prose-heading)",
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
          marginBottom: "var(--prose-block-gap)",
          paddingLeft: "var(--space-3)",
          borderLeft: "2.5px solid var(--neutral-200)",
          color: "var(--prose-quote-text)",
          fontStyle: "italic",
          lineHeight: "var(--prose-line-body)",
        }}
        {...props}
      >
        {children}
      </blockquote>
    );
  },
  ul({ children, ...props }) {
    return (
      <ul style={{ margin: "0", marginBottom: "var(--prose-block-gap)", paddingLeft: "var(--prose-list-indent)", listStyleType: "disc", display: "flex", flexDirection: "column", gap: "var(--prose-list-item-gap)" }} {...props}>
        {children}
      </ul>
    );
  },
  ol({ children, ...props }) {
    return (
      <ol style={{ margin: "0", marginBottom: "var(--prose-block-gap)", paddingLeft: "var(--prose-list-indent)", listStyleType: "decimal", display: "flex", flexDirection: "column", gap: "var(--prose-list-item-gap)" }} {...props}>
        {children}
      </ol>
    );
  },
  li({ children, ...props }) {
    return (
      <li style={{ lineHeight: "var(--prose-line-body)", color: "var(--prose-text)", fontSize: "var(--prose-size-body)" }} {...props}>
        {children}
      </li>
    );
  },
  h1({ children, ...props }) {
    return (
      <h2 style={{ fontSize: "var(--prose-size-h1)", fontWeight: 600, color: "var(--prose-heading)", fontFamily: "var(--font-body)", lineHeight: "var(--prose-line-h1)", margin: "var(--prose-h1-space-before) 0 var(--prose-h1-space-after)" }} {...props}>
        {children}
      </h2>
    );
  },
  h2({ children, ...props }) {
    return (
      <h2 style={{ fontSize: "var(--prose-size-h2)", fontWeight: 600, color: "var(--prose-heading)", fontFamily: "var(--font-body)", lineHeight: "var(--prose-line-h2)", margin: "var(--prose-h2-space-before) 0 var(--prose-h2-space-after)" }} {...props}>
        {children}
      </h2>
    );
  },
  h3({ children, ...props }) {
    return (
      <h3 style={{ fontSize: "var(--prose-size-h3)", fontWeight: 600, color: "var(--prose-heading)", fontFamily: "var(--font-body)", lineHeight: "var(--prose-line-h3)", margin: "var(--prose-h3-space-before) 0 var(--prose-h3-space-after)" }} {...props}>
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
      <p style={{ margin: "0", marginBottom: "var(--prose-block-gap)", lineHeight: "var(--prose-line-body)", fontWeight: 400, fontSize: "var(--prose-size-body)", color: "var(--prose-text)" }} {...props}>
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
        fontSize: "var(--prose-size-body)",
        lineHeight: "var(--prose-line-body)",
        color: "var(--prose-text)",
        wordBreak: "break-word",
        maxWidth: "var(--prose-measure)",
      }}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={resolvedRehypePlugins}
        components={resolvedComponents}
        urlTransform={markdownUrlTransform}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}

