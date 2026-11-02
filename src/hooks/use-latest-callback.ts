import { useCallback, useEffect, useRef } from "react";

/**
 * A function with a stable identity that always calls the latest `fn`.
 * `fn` is stored in a ref, refreshed in an effect after every render (not
 * during render, which is unsafe under Strict Mode / concurrent rendering), so
 * call it only from event handlers, timers or effects — never while rendering.
 *
 * For callbacks handed to memoized children that compare only their
 * presence (e.g. ChatMessageMemo's onRegenerate/onEdit), so a plain function
 * would otherwise be frozen at whatever it closed over when first passed.
 */
export function useLatestCallback<Args extends unknown[], R>(fn: (...args: Args) => R): (...args: Args) => R {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: Args) => ref.current(...args), []);
}
