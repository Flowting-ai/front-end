"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { sanitizeHTML } from "@/lib/security";
import { CodeBlock } from "@/components/chat/CodeBlock";
import type { Components } from "react-markdown";

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];

const components: Components = {
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
  a({ href, children, ...props }) {
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
        {...props}
      >
        {children}
      </a>
    );
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
};

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const sanitized = sanitizeHTML(content);

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
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {sanitized}
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
