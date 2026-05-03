"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const remarkPlugins = [remarkGfm];

const pinComponents: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const value = String(children).replace(/\n$/, "");

    // Code block
    if (match || value.includes("\n")) {
      return (
        <pre
          style={{
            margin: "4px 0",
            padding: "6px 8px",
            borderRadius: 6,
            background: "var(--neutral-800-10, rgba(59,54,50,0.06))",
            overflowX: "auto",
            fontSize: 10,
            lineHeight: "14px",
            fontFamily: "var(--font-code, monospace)",
            color: "var(--neutral-700)",
            border: "1px solid var(--neutral-700-12, rgba(59,54,50,0.08))",
          }}
        >
          <code>{children}</code>
        </pre>
      );
    }

    // Inline code
    return (
      <code
        style={{
          fontFamily: "var(--font-code, monospace)",
          fontSize: 10,
          background: "var(--neutral-800-10, rgba(59,54,50,0.06))",
          color: "var(--neutral-700)",
          borderRadius: 3,
          padding: "0px 3px",
          border: "1px solid var(--neutral-700-12, rgba(59,54,50,0.08))",
        }}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre({ children }) {
    return <>{children}</>;
  },
  p({ children, ...props }) {
    return (
      <p
        style={{
          margin: "0 0 4px 0",
          fontSize: 11,
          lineHeight: "16px",
          color: "var(--neutral-600)",
        }}
        {...props}
      >
        {children}
      </p>
    );
  },
  a({ href, children, ...props }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: "var(--brown-500, #92400e)",
          textDecoration: "underline",
          textUnderlineOffset: "1px",
          fontSize: 11,
        }}
        {...props}
      >
        {children}
      </a>
    );
  },
  ul({ children, ...props }) {
    return (
      <ul
        style={{
          margin: "2px 0",
          paddingLeft: 14,
          listStyleType: "disc",
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
        {...props}
      >
        {children}
      </ul>
    );
  },
  ol({ children, ...props }) {
    return (
      <ol
        style={{
          margin: "2px 0",
          paddingLeft: 14,
          listStyleType: "decimal",
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
        {...props}
      >
        {children}
      </ol>
    );
  },
  li({ children, ...props }) {
    return (
      <li
        style={{
          fontSize: 11,
          lineHeight: "16px",
          color: "var(--neutral-600)",
        }}
        {...props}
      >
        {children}
      </li>
    );
  },
  h1({ children, ...props }) {
    return (
      <p
        style={{
          margin: "0 0 2px 0",
          fontSize: 12,
          fontWeight: 600,
          lineHeight: "16px",
          color: "var(--neutral-800)",
        }}
        {...props}
      >
        {children}
      </p>
    );
  },
  h2({ children, ...props }) {
    return (
      <p
        style={{
          margin: "0 0 2px 0",
          fontSize: 12,
          fontWeight: 600,
          lineHeight: "16px",
          color: "var(--neutral-800)",
        }}
        {...props}
      >
        {children}
      </p>
    );
  },
  h3({ children, ...props }) {
    return (
      <p
        style={{
          margin: "0 0 2px 0",
          fontSize: 11,
          fontWeight: 600,
          lineHeight: "16px",
          color: "var(--neutral-800)",
        }}
        {...props}
      >
        {children}
      </p>
    );
  },
  h4({ children, ...props }) {
    return (
      <p
        style={{
          margin: "0 0 2px 0",
          fontSize: 11,
          fontWeight: 600,
          lineHeight: "16px",
          color: "var(--neutral-700)",
        }}
        {...props}
      >
        {children}
      </p>
    );
  },
  h5({ children, ...props }) {
    return (
      <p
        style={{
          margin: "0 0 2px 0",
          fontSize: 11,
          fontWeight: 600,
          lineHeight: "16px",
          color: "var(--neutral-700)",
        }}
        {...props}
      >
        {children}
      </p>
    );
  },
  h6({ children, ...props }) {
    return (
      <p
        style={{
          margin: "0 0 2px 0",
          fontSize: 11,
          fontWeight: 600,
          lineHeight: "16px",
          color: "var(--neutral-700)",
        }}
        {...props}
      >
        {children}
      </p>
    );
  },
  blockquote({ children, ...props }) {
    return (
      <blockquote
        style={{
          margin: "2px 0",
          paddingLeft: 8,
          borderLeft: "2px solid var(--neutral-200)",
          color: "var(--neutral-500)",
          fontStyle: "italic",
          fontSize: 11,
          lineHeight: "16px",
        }}
        {...props}
      >
        {children}
      </blockquote>
    );
  },
  strong({ children, ...props }) {
    return (
      <strong
        style={{ fontWeight: 600, color: "var(--neutral-700)" }}
        {...props}
      >
        {children}
      </strong>
    );
  },
  em({ children, ...props }) {
    return (
      <em style={{ fontStyle: "italic" }} {...props}>
        {children}
      </em>
    );
  },
  hr() {
    return (
      <hr
        style={{
          margin: "4px 0",
          border: "none",
          borderTop: "1px solid var(--neutral-200)",
        }}
      />
    );
  },
  table({ children, ...props }) {
    return (
      <div
        style={{
          overflowX: "auto",
          margin: "4px 0",
          borderRadius: 4,
          border: "1px solid var(--neutral-200)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 10,
            lineHeight: "14px",
          }}
          {...props}
        >
          {children}
        </table>
      </div>
    );
  },
  th({ children, ...props }) {
    return (
      <th
        style={{
          padding: "3px 6px",
          textAlign: "left",
          fontWeight: 600,
          fontSize: 10,
          color: "var(--neutral-700)",
          borderBottom: "1px solid var(--neutral-200)",
          background: "var(--neutral-50)",
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
          padding: "3px 6px",
          fontSize: 10,
          color: "var(--neutral-600)",
          borderBottom: "1px solid var(--neutral-100)",
        }}
        {...props}
      >
        {children}
      </td>
    );
  },
};

export function PinMarkdownRenderer({ content }: { content: string }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-body)",
        fontSize: 11,
        lineHeight: "16px",
        color: "var(--neutral-600)",
        wordBreak: "break-word",
      }}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        components={pinComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
