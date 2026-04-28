"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import type { JSX } from "react";
import { sanitizeKaTeX } from "@/lib/security";

/**
 * Renders bold / italic / bold-italic / inline-code markers within a text segment.
 * Priority order in the regex prevents false matches (*** before ** before *).
 * Single-underscore italic (_text_) is intentionally excluded to avoid false
 * positives inside snake_case identifiers; LLMs almost always use * for italic.
 *
 * Returns an array of strings and JSX elements so callers can inline it
 * inside other content without wrapping divs.
 */
export const renderBoldInlineContent = (
  text: string,
  keyPrefix: string,
): Array<string | JSX.Element> => {
  // Combined regex — order matters (longest delimiter first):
  //   1. Bold + italic : ***text*** or ___text___
  //   2. Bold          : **text**  or __text__
  //   3. Italic        : *text*  (single *, no _ to avoid snake_case)
  //   4. Inline code   : `text`
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
      // Bold + italic: ***text*** / ___text___
      nodes.push(
        <strong
          key={`${keyPrefix}-bi-${count++}`}
          className="font-semibold text-[#171717]"
        >
          <em>{match[2]}</em>
        </strong>,
      );
    } else if (match[4] !== undefined) {
      // Bold: **text** / __text__
      nodes.push(
        <strong
          key={`${keyPrefix}-bold-${count++}`}
          className="font-semibold text-[#171717]"
        >
          {match[4]}
        </strong>,
      );
    } else if (match[5] !== undefined) {
      // Italic: *text*
      nodes.push(
        <em key={`${keyPrefix}-em-${count++}`}>
          {match[5]}
        </em>,
      );
    } else if (match[6] !== undefined) {
      // Inline code: `text`
      nodes.push(
        <code
          key={`${keyPrefix}-code-${count++}`}
          className="rounded bg-[#F4F4F5] px-1 py-0.5 font-mono text-[0.875em] text-[#171717]"
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

/**
 * Renders inline LaTeX expressions (`$...$`, `\(...\)`) and block LaTeX
 * (`$$...$$`, `\[...\]`) found within a text segment using KaTeX.
 * Bold markers inside non-LaTeX segments are handled via `renderBoldInlineContent`.
 *
 * Returns an array of strings and JSX elements for inline embedding.
 */
export const renderLatexInlineContent = (
  text: string,
  keyPrefix: string,
): Array<string | JSX.Element> => {
  const nodes: Array<string | JSX.Element> = [];
  // Match block: $$...$$ or \[...\], inline: \(...\) or $...$
  const latexRegex =
    /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let latexCount = 0;

  while ((match = latexRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const beforeText = text.slice(lastIndex, match.index);
      nodes.push(
        ...renderBoldInlineContent(
          beforeText,
          `${keyPrefix}-pre-${latexCount}`,
        ),
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
          className={isBlock ? "block my-2" : "inline-block mx-0.5"}
          dangerouslySetInnerHTML={{ __html: sanitizeKaTeX(html) }}
        />,
      );
    } catch {
      // If KaTeX fails, show the raw LaTeX source
      nodes.push(
        <code
          key={`${keyPrefix}-latex-err-${latexCount++}`}
          className="bg-red-100 text-red-800 px-1 rounded"
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

/**
 * Renders a block-level math expression using KaTeX (display mode).
 * Returns `null` when KaTeX fails so the caller can fall through to plain text.
 *
 * The caller is responsible for providing a unique `elementKey` for React
 * reconciliation when the result is pushed into an array of nodes.
 */
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
        className="my-2 overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: sanitizeKaTeX(html) }}
      />
    );
  } catch {
    return null;
  }
}
