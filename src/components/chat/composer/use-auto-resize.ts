import { useEffect, type RefObject } from "react";

/** Auto-grow the textarea to fit `value` (its max-height caps it, then it scrolls). */
export function useAutoResize(textareaRef: RefObject<HTMLTextAreaElement | null>, value: string) {
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, textareaRef]);
}
