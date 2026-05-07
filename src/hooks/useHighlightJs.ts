"use client";

import { useEffect, useRef, useState } from "react";

let _hljsPromise: Promise<typeof import("@/lib/highlight").default> | null =
  null;

function loadHljs() {
  if (!_hljsPromise) {
    _hljsPromise = import("@/lib/highlight").then((mod) => mod.default);
  }
  return _hljsPromise;
}

export function useHighlightJs(
  containerRef: React.RefObject<HTMLElement | null>,
  enabled = true,
) {
  const [isReady, setIsReady] = useState(false);
  const hljsRef = useRef<typeof import("highlight.js/lib/core").default | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    loadHljs().then((hljs) => {
      if (cancelled) return;
      hljsRef.current = hljs;
      setIsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !isReady || !hljsRef.current || !containerRef.current) return;

    // Clear stale flags: React overwrites hljs's DOM mutations during streaming,
    // leaving data-highlighted=true on plain-text nodes that were never re-highlighted.
    const blocks =
      containerRef.current.querySelectorAll<HTMLElement>("pre code[class*='language-']");
    blocks.forEach((block) => {
      block.removeAttribute("data-highlighted");
      hljsRef.current!.highlightElement(block);
      block.dataset.highlighted = "true";
    });
  }, [isReady, enabled, containerRef]);

  return { isReady, hljs: hljsRef.current };
}
