/**
 * React hooks for memory management and cleanup
 */

import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to automatically cleanup sensitive data on unmount
 */
export function useSensitiveDataCleanup<T extends Record<string, unknown>>(data: T) {
  const dataRef = useRef(data);
  
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      const currentData = dataRef.current;
      if (currentData && typeof currentData === 'object') {
        for (const key in currentData) {
          if (Object.prototype.hasOwnProperty.call(currentData, key)) {
            const value = currentData[key];
            if (typeof value === 'string') {
              // Overwrite with zeros
              (currentData as Record<string, unknown>)[key] = '\0'.repeat(value.length);
            }
            (currentData as Record<string, unknown>)[key] = null;
          }
        }
      }
    };
  }, []);
}

/**
 * Hook to cleanup intervals and timeouts
 */
export function useCleanupTimers() {
  const timers = useRef<Array<NodeJS.Timeout>>([]);
  
  const addTimeout = useCallback((callback: () => void, delay: number) => {
    const id = setTimeout(callback, delay);
    timers.current.push(id);
    return id;
  }, []);
  
  const addInterval = useCallback((callback: () => void, delay: number) => {
    const id = setInterval(callback, delay);
    timers.current.push(id);
    return id;
  }, []);
  
  const clearTimer = useCallback((id: NodeJS.Timeout) => {
    clearTimeout(id);
    clearInterval(id);
    timers.current = timers.current.filter((t) => t !== id);
  }, []);
  
  useEffect(() => {
    return () => {
      // Cleanup all timers on unmount
      timers.current.forEach((id) => {
        clearTimeout(id);
        clearInterval(id);
      });
      timers.current = [];
    };
  }, []);
  
  return { addTimeout, addInterval, clearTimer };
}

/**
 * Hook to cleanup event listeners
 */
export function useCleanupEventListeners() {
  const listeners = useRef<Array<{
    element: EventTarget;
    event: string;
    handler: EventListener;
  }>>([]);
  
  const addEventListener = useCallback(
    (element: EventTarget, event: string, handler: EventListener) => {
      element.addEventListener(event, handler);
      listeners.current.push({ element, event, handler });
    },
    []
  );
  
  const removeEventListener = useCallback(
    (element: EventTarget, event: string, handler: EventListener) => {
      element.removeEventListener(event, handler);
      listeners.current = listeners.current.filter(
        (l) => !(l.element === element && l.event === event && l.handler === handler)
      );
    },
    []
  );
  
  useEffect(() => {
    return () => {
      // Cleanup all event listeners on unmount
      listeners.current.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
      listeners.current = [];
    };
  }, []);
  
  return { addEventListener, removeEventListener };
}

/**
 * Hook to prevent memory leaks from async operations
 */
export function useSafeAsync() {
  const isMounted = useRef(true);
  
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  const safeAsync = useCallback(async <T>(promise: Promise<T>): Promise<T | null> => {
    try {
      const result = await promise;
      if (!isMounted.current) {
        return null;
      }
      return result;
    } catch (error) {
      if (!isMounted.current) {
        return null;
      }
      throw error;
    }
  }, []);
  
  return { safeAsync, isMounted: () => isMounted.current };
}

/**
 * Hook to cleanup AbortControllers
 */
export function useAbortController() {
  const controllers = useRef<AbortController[]>([]);
  
  const createController = useCallback(() => {
    const controller = new AbortController();
    controllers.current.push(controller);
    return controller;
  }, []);
  
  const abortAll = useCallback(() => {
    controllers.current.forEach((controller) => controller.abort());
    controllers.current = [];
  }, []);
  
  useEffect(() => {
    return () => {
      // Abort all controllers on unmount
      abortAll();
    };
  }, [abortAll]);
  
  return { createController, abortAll };
}

/**
 * Hook for debounced state updates to reduce re-renders
 */
export function useDebouncedState<T>(
  initialValue: T,
  delay: number
): [T, T, (value: T) => void] {
  const [value, setValue] = React.useState<T>(initialValue);
  const [debouncedValue, setDebouncedValue] = React.useState<T>(initialValue);
  const timerRef = useRef<NodeJS.Timeout>();
  
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [value, delay]);
  
  return [value, debouncedValue, setValue];
}

/**
 * Hook to track and limit component re-renders
 */
export function useRenderCount(componentName: string) {
  const renderCount = useRef(0);
  const maxRenders = 100;
  
  useEffect(() => {
    renderCount.current += 1;
    
    if (process.env.NODE_ENV === 'development') {
      if (renderCount.current > maxRenders) {
        console.warn(
          `${componentName} has rendered ${renderCount.current} times. ` +
          'This may indicate a performance issue.'
        );
      }
    }
  });
  
  return renderCount.current;
}

// Re-export React for the hook
import React from 'react';
