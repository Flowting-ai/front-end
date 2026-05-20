"use client";

import { useEffect, useRef, useState } from "react";

let _hljsPromise: Promise<{
  hljs: typeof import("@/lib/highlight").default;
  ensureLanguage: typeof import("@/lib/highlight").ensureLanguage;
}> | null = null;

function loadHljs() {
  if (!_hljsPromise) {
    _hljsPromise = import("@/lib/highlight").then((mod) => ({
      hljs: mod.default,
      ensureLanguage: mod.ensureLanguage,
    }));
  }
  return _hljsPromise;
}

export function useHighlightJs(
  containerRef: React.RefObject<HTMLElement | null>,
  enabled = true,
) {
  const [isReady, setIsReady] = useState(false);
  const hljsRef = useRef<typeof import("highlight.js/lib/core").default | null>(null);
  const ensureRef = useRef<typeof import("@/lib/highlight").ensureLanguage | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadHljs().then(({ hljs, ensureLanguage }) => {
      if (cancelled) return;
      hljsRef.current = hljs;
      ensureRef.current = ensureLanguage;
      setIsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !isReady || !hljsRef.current || !ensureRef.current || !containerRef.current)
      return;

    const hljs = hljsRef.current;
    const ensureLanguage = ensureRef.current;

    const blocks = containerRef.current.querySelectorAll<HTMLElement>(
      "pre code[class*='language-']",
    );

    if (!blocks.length) return;

    const langs = new Set<string>();
    blocks.forEach((block) => {
      const match = Array.from(block.classList).find((c) => c.startsWith("language-"));
      if (match) langs.add(match.slice("language-".length));
    });

    Promise.all(Array.from(langs).map(ensureLanguage)).then(() => {
      blocks.forEach((block) => {
        block.removeAttribute("data-highlighted");
        hljs.highlightElement(block);
        block.dataset.highlighted = "true";
      });
    });
  }, [isReady, enabled, containerRef]);

  return { isReady, hljs: hljsRef.current };
}
