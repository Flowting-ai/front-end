"use client";

import { createContext, useCallback, useContext, useState } from "react";

// ── Pin Data Shape ────────────────────────────────────────────────────────────

export type PinCategory =
  | "Code"
  | "Research"
  | "Creative"
  | "Planning"
  | "Tasks"
  | "Quote"
  | "Workflow";

export interface PinItem {
  id: string;
  content: string;
  title: string;
  category: PinCategory;
  chatId?: string;
  chatName?: string;
  messageId: string;
  modelName?: string;
  createdAt: string;
}

// ── Context ───────────────────────────────────────────────────────────────────

interface PinboardContextValue {
  pins: PinItem[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  addPin: (pin: Omit<PinItem, "id" | "createdAt">) => void;
  removePin: (id: string) => void;
  removePinByMessage: (messageId: string) => void;
  isPinned: (messageId: string) => boolean;
  updatePinCategory: (id: string, category: PinCategory) => void;
}

const PinboardContext = createContext<PinboardContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function PinboardProvider({ children }: { children: React.ReactNode }) {
  const [pins, setPins] = useState<PinItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const addPin = useCallback((pin: Omit<PinItem, "id" | "createdAt">) => {
    setPins((prev) => {
      // Don't double-pin the same message
      if (prev.some((p) => p.messageId === pin.messageId)) return prev;
      const newPin: PinItem = {
        ...pin,
        id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
      };
      return [newPin, ...prev];
    });
  }, []);

  const removePin = useCallback((id: string) => {
    setPins((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const removePinByMessage = useCallback((messageId: string) => {
    setPins((prev) => prev.filter((p) => p.messageId !== messageId));
  }, []);

  const updatePinCategory = useCallback((id: string, category: PinCategory) => {
    setPins((prev) => prev.map((p) => p.id === id ? { ...p, category } : p));
  }, []);

  const isPinned = useCallback(
    (messageId: string) => pins.some((p) => p.messageId === messageId),
    [pins],
  );

  return (
    <PinboardContext.Provider
      value={{ pins, isOpen, open, close, toggle, addPin, removePin, removePinByMessage, isPinned, updatePinCategory }}
    >
      {children}
    </PinboardContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePinboard(): PinboardContextValue {
  const ctx = useContext(PinboardContext);
  if (!ctx) {
    throw new Error("usePinboard must be used within PinboardProvider");
  }
  return ctx;
}
