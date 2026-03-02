import { useEffect } from "react";
import hljs from "@/lib/highlight";

export function useHighlightJs(dependency?: any) {
  useEffect(() => {
    // Highlight all code blocks
    document.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block as HTMLElement);
    });
  }, [dependency]);
}
