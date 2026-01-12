const THINK_TAG_PATTERN = /<think>([\s\S]*?)<\/think>/gi;

export interface ThinkingParseResult {
  visibleText: string;
  thinkingText: string | null;
}

export const extractThinkingContent = (
  value: string | null | undefined
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
