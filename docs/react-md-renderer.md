---
name: react-markdown-renderer
description: >
  Build clean, production-quality Markdown rendering for React/Next.js apps — including AI chat UIs that stream token-by-token. Use this skill whenever the user wants to render Markdown in a React app, build an AI chat interface with formatted responses, add syntax highlighting to code blocks, handle streaming LLM output gracefully, or replicate the polished look of Claude or ChatGPT's message rendering. Triggers on phrases like "render markdown", "AI chat UI", "streaming markdown", "syntax highlighting", "react-markdown setup", "ChatGPT-style formatting", or "Claude-style responses".
---

# React Markdown Renderer

Build the same rendering stack used by Claude, ChatGPT, and other AI chat UIs: `react-markdown` + `remark`/`rehype` plugins + custom styled components + streaming-aware block memoization.

---

## Stack Overview

| Layer | Package | Purpose |
|---|---|---|
| Markdown → React | `react-markdown` | Core renderer, safe virtual DOM |
| GFM extensions | `remark-gfm` | Tables, strikethrough, task lists, autolinks |
| Syntax highlighting | `rehype-highlight` or `shiki` | Code block coloring |
| Math | `remark-math` + `rehype-katex` | LaTeX equations |
| HTML passthrough | `rehype-raw` + `rehype-sanitize` | Safe raw HTML in Markdown |
| Streaming optimization | `React.memo` + block splitting | Prevent full re-renders on each token |
| Styling | Tailwind or custom CSS | Typography, spacing, colors |

---

## Install

```bash
npm install react-markdown remark-gfm rehype-highlight rehype-sanitize
# optional extras:
npm install remark-math rehype-katex rehype-raw
```

---

## Basic Setup (non-streaming)

```tsx
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize from 'rehype-sanitize';
import 'highlight.js/styles/github-dark.css'; // or any hljs theme

export function MessageRenderer({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize, rehypeHighlight]}
      components={markdownComponents}
    >
      {content}
    </Markdown>
  );
}
```

---

## Custom Components (the "polished" part)

This is what makes it look clean. Override each HTML element:

```tsx
import { Components } from 'react-markdown';

export const markdownComponents: Components = {
  // Headings
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold mt-6 mb-3 tracking-tight">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold mt-5 mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold mt-4 mb-1">{children}</h3>
  ),

  // Paragraphs
  p: ({ children }) => (
    <p className="my-3 leading-7">{children}</p>
  ),

  // Inline code
  code: ({ inline, children, className, ...props }) => {
    if (inline) {
      return (
        <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
          {children}
        </code>
      );
    }
    return <code className={className} {...props}>{children}</code>;
  },

  // Code blocks
  pre: ({ children }) => (
    <pre className="bg-zinc-900 text-zinc-100 rounded-lg p-4 overflow-x-auto my-4 text-sm leading-relaxed">
      {children}
    </pre>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="list-disc list-outside pl-6 my-3 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside pl-6 my-3 space-y-1">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-7">{children}</li>,

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 italic my-4 text-zinc-600 dark:text-zinc-400">
      {children}
    </blockquote>
  ),

  // Table (remark-gfm)
  table: ({ children }) => (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-zinc-200 dark:border-zinc-700 px-3 py-2">{children}</td>
  ),

  // Links
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
       className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:opacity-80">
      {children}
    </a>
  ),

  // Horizontal rule
  hr: () => <hr className="my-6 border-zinc-200 dark:border-zinc-700" />,
};
```

---

## Streaming Setup (AI chat)

When streaming token-by-token, naively re-rendering the whole message on every token is expensive. The trick: split into blocks and memoize each one.

```tsx
import { memo, useMemo } from 'react';
import Markdown, { Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Memoized block — only re-renders when content changes
const MemoizedMarkdown = memo(
  ({ content, ...props }: { content: string } & Options) => (
    <Markdown remarkPlugins={[remarkGfm]} {...props}>{content}</Markdown>
  ),
  (prev, next) => prev.content === next.content
);

// Split on double newlines (paragraph/block boundaries)
function splitIntoBlocks(text: string): string[] {
  return text.split(/\n\n+/).filter(Boolean);
}

export function StreamingMessage({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming: boolean;
}) {
  const blocks = useMemo(() => splitIntoBlocks(content), [content]);

  return (
    <div className="prose dark:prose-invert max-w-none">
      {blocks.map((block, i) => (
        <MemoizedMarkdown
          key={i}
          content={block}
          components={markdownComponents}
        />
      ))}
      {isStreaming && (
        <span className="inline-block w-1 h-4 bg-current animate-pulse ml-0.5" />
      )}
    </div>
  );
}
```

---

## Math Support (optional)

```tsx
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// Add to plugins:
remarkPlugins={[remarkGfm, remarkMath]}
rehypePlugins={[rehypeSanitize, rehypeKatex]}
```

---

## Security Notes

- **Always use `rehype-sanitize`** when rendering user-influenced AI output. It strips `<script>`, `onerror`, `javascript:` URLs, and other vectors.
- If you need raw HTML passthrough, pair `rehype-raw` with `rehype-sanitize` — never use `rehype-raw` alone.
- Never use `dangerouslySetInnerHTML` as a markdown approach; `react-markdown` avoids this by building a virtual DOM instead.

---

## Shiki (alternative to rehype-highlight)

Shiki gives VS Code-quality highlighting but adds ~200KB. Use it when quality matters more than bundle size:

```tsx
import { codeToHtml } from 'shiki';

// Custom code component using Shiki
const ShikiCode = async ({ children, className }: any) => {
  const lang = className?.replace('language-', '') ?? 'text';
  const html = await codeToHtml(String(children), {
    lang,
    theme: 'github-dark',
  });
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
};
```

> Note: Shiki is async — works best with React Server Components (Next.js App Router) or pre-rendering. For client-side streaming, stick with `rehype-highlight`.

---

## Quick-start Checklist

- [ ] Install `react-markdown` + `remark-gfm`
- [ ] Add `rehype-sanitize` (security — don't skip)
- [ ] Add `rehype-highlight` + a highlight.js CSS theme for code blocks
- [ ] Write custom `components` for headings, code, lists, tables
- [ ] For streaming: wrap in `React.memo`, split on `\n\n`, add caret cursor
- [ ] Test with: headers, code blocks, tables, bold/italic, nested lists, links