"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { HighlightMark } from "@/components/HighlightMark";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { CodeBlock } from "@/components/chat/CodeBlock";
import { CitationChip } from "@/components/chat/ResponseBlocks";
import type { Components } from "react-markdown";
import type { WebCitation } from "@/hooks/use-chat-state";

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];

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
    // {N} → [^N](citation://N)
    .replace(/\{(\d+)\}/g, (_, n) => `[[${n}]](citation://${n})`)
    // [N] not already followed by ( - standalone bracketed number
    .replace(/(?<!\])\[(\d+)\](?!\()/g, (_, n) => `[[${n}]](citation://${n})`);
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
      <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--neutral-900)", fontFamily: "var(--font-body)", lineHeight: "30px", margin: "10px 0 16px" }} {...props}>
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
    // Blank line BEFORE **..** when immediately preceded by a non-whitespace char
    .replace(/([^\s\n])(\*\*[^*\n]+\*\*)/g, '$1\n\n$2')
    // Blank line AFTER **..** when immediately followed by a letter (start of new sentence)
    .replace(/(\*\*[^*\n]+\*\*)([A-Za-z])/g, '$1\n\n$2');
}

interface MarkdownRendererProps {
  content: string;
  webCitations?: WebCitation[];
  highlights?: HighlightSpec[];
}

export function MarkdownRenderer({ content, webCitations, highlights }: MarkdownRendererProps) {
  const hasCitations = !!webCitations?.length;
  const resolvedComponents: Components = hasCitations
    ? { ...BASE_COMPONENTS, a: makeAComponent(webCitations) }
    : BASE_COMPONENTS;

  const processed = hasCitations
    ? closeOpenFences(normalizeMathDelimiters(normalizeInlineBoldTitles(preprocessCitations(content))))
    : closeOpenFences(normalizeMathDelimiters(normalizeInlineBoldTitles(content)));

  const resolvedRehypePlugins = useMemo(
    () => highlights?.length
      ? [rehypeKatex, makeHighlightMarksPlugin(highlights)]
      : rehypePlugins,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [highlights],
  )

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
