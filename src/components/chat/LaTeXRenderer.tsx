"use client";

import katex from "katex";
import { sanitizeKaTeX } from "@/lib/security";
import type { JSX } from "react";

export const renderBoldInlineContent = (
  text: string,
  keyPrefix: string,
): Array<string | JSX.Element> => {
  const markdownRegex =
    /(\*\*\*|___)([\s\S]+?)\1|(\*\*|__)([\s\S]+?)\3|\*([^*\n]+?)\*|`([^`\n]+)`/g;
  const nodes: Array<string | JSX.Element> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let count = 0;

  while ((match = markdownRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-bi-${count++}`} style={{ fontWeight: 600 }}>
          <em>{match[2]}</em>
        </strong>,
      );
    } else if (match[4] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-bold-${count++}`} style={{ fontWeight: 600 }}>
          {match[4]}
        </strong>,
      );
    } else if (match[5] !== undefined) {
      nodes.push(<em key={`${keyPrefix}-em-${count++}`}>{match[5]}</em>);
    } else if (match[6] !== undefined) {
      nodes.push(
        <code
          key={`${keyPrefix}-code-${count++}`}
          style={{
            borderRadius: "4px",
            backgroundColor: "var(--neutral-100)",
            padding: "1px 4px",
            fontFamily: "var(--font-mono, ui-monospace, monospace)",
            fontSize: "0.875em",
          }}
        >
          {match[6]}
        </code>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  if (nodes.length === 0) {
    nodes.push(text);
  }

  return nodes;
};

export const renderLatexInlineContent = (
  text: string,
  keyPrefix: string,
): Array<string | JSX.Element> => {
  const nodes: Array<string | JSX.Element> = [];
  const latexRegex =
    /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let latexCount = 0;

  while ((match = latexRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const beforeText = text.slice(lastIndex, match.index);
      nodes.push(
        ...renderBoldInlineContent(beforeText, `${keyPrefix}-pre-${latexCount}`),
      );
    }

    const blockContent = match[1] ?? match[2];
    const inlineContent = match[3] ?? match[4];
    const isBlock = Boolean(blockContent);
    const latexContent = (isBlock ? blockContent : inlineContent) ?? "";

    try {
      const html = katex.renderToString(latexContent, {
        throwOnError: false,
        displayMode: isBlock,
      });
      nodes.push(
        <span
          key={`${keyPrefix}-latex-${latexCount++}`}
          style={{
            display: isBlock ? "block" : "inline-block",
            margin: isBlock ? "8px 0" : "0 2px",
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeKaTeX(html) }}
        />,
      );
    } catch {
      nodes.push(
        <code
          key={`${keyPrefix}-latex-err-${latexCount++}`}
          style={{
            backgroundColor: "var(--red-100)",
            color: "var(--red-800)",
            padding: "1px 4px",
            borderRadius: "4px",
          }}
        >
          {match[0]}
        </code>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    nodes.push(...renderBoldInlineContent(remaining, `${keyPrefix}-post`));
  }

  if (nodes.length === 0) {
    nodes.push(...renderBoldInlineContent(text, `${keyPrefix}-all`));
  }

  return nodes;
};

export function renderBlockMath(
  mathContent: string,
  elementKey: string,
): JSX.Element | null {
  try {
    const html = katex.renderToString(mathContent, {
      throwOnError: false,
      displayMode: true,
    });
    return (
      <div
        key={elementKey}
        style={{ margin: "8px 0", overflowX: "auto" }}
        dangerouslySetInnerHTML={{ __html: sanitizeKaTeX(html) }}
      />
    );
  } catch {
    return null;
  }
}
