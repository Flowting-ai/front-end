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

export function useHighlightJs(containerRef: React.RefObject<HTMLElement | null>) {
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
    if (!isReady || !hljsRef.current || !containerRef.current) return;

    const blocks =
      containerRef.current.querySelectorAll<HTMLElement>("pre code[class*='language-']");
    blocks.forEach((block) => {
      if (!block.dataset.highlighted) {
        hljsRef.current!.highlightElement(block);
        block.dataset.highlighted = "true";
      }
    });
  });

  return { isReady, hljs: hljsRef.current };
}
