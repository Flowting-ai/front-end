"use client";

import { Copy } from "lucide-react";
import chatStyles from "./chat-interface.module.css";

interface CodeBlockProps {
  /** The programming language identifier extracted from the fenced code block. */
  language?: string;
  /** The raw source code to display. */
  value: string;
  /** Callback invoked when the user clicks the Copy button. */
  onCopy: (content: string) => void;
  /** Stable React key passed by the parent list renderer. */
  elementKey: string;
}

/**
 * Renders a syntax-highlighted fenced code block with a copy button.
 *
 * Syntax highlighting is applied externally by the `useHighlightJs` hook that
 * runs at the `ChatMessage` level after mount — this component intentionally
 * does not call `hljs` directly so it stays a pure presentational component.
 *
 * The outer container uses the same scrollbar style as the rest of the chat
 * panel via `chatStyles.customScrollbar`.
 */
export function CodeBlock({ language, value, onCopy, elementKey }: CodeBlockProps) {
  return (
    <div
      key={elementKey}
      className="relative border border-zinc-100 rounded-2xl bg-[#F5F5F5] py-2 overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/70 px-4">
        {language && (
          <span className="text-black">{language}</span>
        )}
        <button
          type="button"
          onClick={() => onCopy(value)}
          className="cursor-pointer inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium border border-main-border text-black transition hover:text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          <Copy className="h-3 w-3" />
          Copy
        </button>
      </div>
      <pre
        className={`overflow-x-auto rounded-2xl bg-transparent p-2 font-normal text-sm leading-relaxed ${chatStyles.customScrollbar}`}
      >
        <code className={`language-${language || "ts"}`}>
          {value.trimEnd()}
        </code>
      </pre>
    </div>
  );
}
