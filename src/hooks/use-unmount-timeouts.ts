import { useCallback, useEffect, useRef } from "react";

/**
 * `setTimeout` for event handlers whose timers must not outlive the component:
 * every timer still pending is cleared on unmount, so a late callback never
 * sets state on (or acts for) a component that is gone. Stable identity.
 */
export function useUnmountTimeouts(): (fn: () => void, ms: number) => void {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    };
  }, []);
  return useCallback((fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      fn();
    }, ms);
    timers.current.add(timer);
  }, []);
}
