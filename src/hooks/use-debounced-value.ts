"use client";

import { useEffect, useState } from "react";

/**
 * The value, delayed until it has stopped changing for `delayMs`. Keep the input itself instant
 * (bind it to the raw value) and feed only the expensive consumer, such as a search request key,
 * the debounced one. 150-300 ms suits type-ahead search.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
