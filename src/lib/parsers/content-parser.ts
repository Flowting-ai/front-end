/**
 * content-parser.ts
 *
 * Shared parsers for AI message content:
 *   - `extractThinkingContent` — strips `<think>…</think>` reasoning blocks
 *     from a streaming or final assistant message, returning both the visible
 *     text and the captured reasoning.
 *   - `extractSources` — mines Markdown link syntax and bare URLs out of
 *     assistant message text for use as citation sources.
 *
 * These are pure, side-effect-free functions; they never mutate their input.
 *
 * Consumers:
 *   - extractThinkingContent → app-layout.tsx, chat-interface.tsx,
 *                              WorkflowChatInterface.tsx, WorkflowChatFullPage.tsx,
 *                              PersonaChatFullPage.tsx
 *   - extractSources         → chat-interface.tsx
 *
 * Note:
 *   `src/lib/thinking.ts` is kept as a backward-compatibility re-export shim
 *   so that any external references are not silently broken.
 */

// ---------------------------------------------------------------------------
// extractThinkingContent
// ---------------------------------------------------------------------------

/**
 * Pattern that matches a complete `<think>…</think>` block (case-insensitive,
 * spanning multiple lines). All occurrences are stripped from the visible text.
 * @internal
 */
const THINK_TAG_PATTERN = /<think>([\s\S]*?)<\/think>/gi;

/** Result of parsing an assistant message that may contain reasoning blocks. */
export interface ThinkingParseResult {
  /** The message text after all `<think>` blocks have been removed. */
  visibleText: string;
  /**
   * All captured reasoning blocks joined with a blank line, or `null` when
   * no `<think>` tags were present.
   */
  thinkingText: string | null;
}

/**
 * Strips `<think>…</think>` reasoning blocks from an assistant message,
 * returning the cleaned visible text and the aggregated reasoning content.
 *
 * Behaviour:
 * - Multiple `<think>` blocks are all captured and joined with `"\n\n"`.
 * - After stripping, any leading dash/em-dash separator left by some models
 *   is also removed (e.g. `"— Here is the answer"` → `"Here is the answer"`).
 * - Returns `{ visibleText: "", thinkingText: null }` for falsy input.
 *
 * @param value - Raw assistant message content (may be streaming/partial).
 * @returns `{ visibleText, thinkingText }`.
 *
 * @example
 *   extractThinkingContent("<think>Let me reason…</think>The answer is 42.")
 *   // → { visibleText: "The answer is 42.", thinkingText: "Let me reason…" }
 *
 *   extractThinkingContent("No reasoning here.")
 *   // → { visibleText: "No reasoning here.", thinkingText: null }
 *
 *   extractThinkingContent(null)
 *   // → { visibleText: "", thinkingText: null }
 */
export const extractThinkingContent = (
  value: string | null | undefined,
): ThinkingParseResult => {
  if (!value) {
    return { visibleText: "", thinkingText: null };
  }

  const capturedThoughts: string[] = [];
  let hasThoughts = false;

  const stripped = value.replace(THINK_TAG_PATTERN, (_match, inner) => {
    hasThoughts = true;
    const trimmed = typeof inner === "string" ? inner.trim() : "";
    if (trimmed) {
      capturedThoughts.push(trimmed);
    }
    return "";
  });

  // Remove a leading separator that some models emit right after </think>
  const cleaned = hasThoughts
    ? stripped.replace(/^\s*(?:[-–—]+\s*)?/, "").trim()
    : stripped.trim();

  return {
    visibleText: cleaned,
    thinkingText: hasThoughts
      ? capturedThoughts.filter(Boolean).join("\n\n")
      : null,
  };
};

// ---------------------------------------------------------------------------
// extractSources
// ---------------------------------------------------------------------------

/** A source URL entry extracted from assistant message content. */
export interface ContentSource {
  /** The source URL. Always present. */
  url: string;
  /**
   * Link text from Markdown syntax (`[title](url)`), if available.
   * `undefined` for bare URLs that have no surrounding bracket syntax.
   */
  title?: string;
}

/**
 * Extracts HTTP/HTTPS source URLs from raw Markdown assistant content.
 *
 * Two passes are made in order:
 * 1. **Markdown links** — `[title](url)` syntax; the link text is captured
 *    as the `title`.
 * 2. **Bare URLs** — any remaining `http://` / `https://` URLs not already
 *    captured in pass 1. Trailing punctuation (`.`, `)`) is trimmed.
 *
 * Duplicates are eliminated using the raw URL as the dedup key.
 *
 * @param content - Raw Markdown string from the assistant message.
 * @returns An array of `{ url, title? }` objects in order of first appearance.
 *          Returns `[]` for empty or non-string input.
 *
 * @example
 *   extractSources("See [OpenAI](https://openai.com) and https://anthropic.com.")
 *   // → [
 *   //     { url: "https://openai.com", title: "OpenAI" },
 *   //     { url: "https://anthropic.com" },
 *   //   ]
 *
 *   extractSources("No links here.")
 *   // → []
 */
export function extractSources(content: string): ContentSource[] {
  if (!content || typeof content !== "string") return [];

  const seen = new Set<string>();
  const out: ContentSource[] = [];

  // Pass 1: Markdown links — [text](url)
  const linkRegex = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(content)) !== null) {
    const url = m[2].trim();
    if (seen.has(url)) continue;
    seen.add(url);
    const title = m[1].trim();
    out.push({ url, title: title || undefined });
  }

  // Pass 2: Bare URLs not already captured in pass 1
  const urlRegex = /https?:\/\/[^\s)\]">]+/g;
  while ((m = urlRegex.exec(content)) !== null) {
    const raw = m[0];
    const url = raw.replace(/[.)]+$/, ""); // trim trailing punctuation
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url });
  }

  return out;
}
