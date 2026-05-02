"use client";

import { useState, useEffect, useRef } from "react";
import { listPins, type Pin } from "@/lib/api/pins";
import { logger } from "@/lib/logger";

interface UsePinOperationsResult {
  pins: Pin[];
  isLoading: boolean;
  searchPins: (query: string) => Promise<Pin[]>;
  refreshPins: () => Promise<void>;
}

export function usePinOperations(): UsePinOperationsResult {
  const [pins, setPins] = useState<Pin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const loadedRef = useRef(false);

  const loadPins = async () => {
    if (loadedRef.current) return;
    setIsLoading(true);
    try {
      const result = await listPins();
      setPins(result.pins);
      loadedRef.current = true;
    } catch (err) {
      logger.error("[usePinOperations] Failed to load pins", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPins();
  }, []);

  const searchPins = async (query: string): Promise<Pin[]> => {
    if (!query) return pins;
    try {
      const result = await listPins(query);
      return result.pins;
    } catch (err) {
      logger.error("[usePinOperations] Search failed", err);
      return pins.filter(
        (p) =>
          p.title.toLowerCase().includes(query.toLowerCase()) ||
          p.content.toLowerCase().includes(query.toLowerCase()),
      );
    }
  };

  const refreshPins = async () => {
    loadedRef.current = false;
    await loadPins();
  };

  return { pins, isLoading, searchPins, refreshPins };
}
