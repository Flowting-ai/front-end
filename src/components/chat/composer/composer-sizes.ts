// ── Shadow tokens ──────────────────────────────────────────────────────────────

export const SHADOW_DEFAULT = "var(--shadow-chat-input)";
export const SHADOW_HOVER = "var(--shadow-chat-input-hover)";
export const SHADOW_FOCUS = "var(--shadow-chat-input-focus)";

/** Spacing / type sizes of the chat box, normal or compact. */
export function getComposerSizes(compact: boolean) {
  return {
    szPadding:    compact ? "12px 16px"                  : "20px",
    szGap:        compact ? "12px"                       : "24px",
    szRadius:     compact ? "20px"                       : "24px",
    szBtn:        compact ? "sm" as const                : "md" as const,
    szFont:       compact ? "var(--font-size-body)"      : "var(--font-size-body-lg)",
    szLineHeight: compact ? "var(--line-height-body)"    : "var(--line-height-body-lg)",
  };
}

export type ComposerButtonSize = ReturnType<typeof getComposerSizes>["szBtn"];

/** Fine pointers only: on touch screens focusing the box pops the keyboard up. */
export function isCoarsePointer(): boolean {
  return !!window.matchMedia?.("(pointer: coarse)").matches;
}
