"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { createPin, deletePin, listPins } from "@/lib/api/pins";

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
  tags?: string[];
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

  // ── Load pins from API on mount ─────────────────────────────────────────
  useEffect(() => {
    listPins()
      .then((apiPins) => {
        const items: PinItem[] = apiPins.map((p) => ({
          id: p.id,
          content: p.content,
          title: p.title,
          category: (p.category as PinCategory) ?? "Quote",
          tags: p.tags,
          messageId: p.message_id ?? p.id,
          createdAt: p.created_at,
        }));
        setPins(items);
      })
      .catch((err) => console.error("[PinboardContext] Failed to load pins", err));
  }, []);

  // ── addPin — optimistic, persisted to backend ───────────────────────────
  const addPin = useCallback(async (pin: Omit<PinItem, "id" | "createdAt">) => {
    // Capture tempId inside the setState callback so it's synchronous
    let tempId: string | null = null;
    setPins((prev) => {
      if (prev.some((p) => p.messageId === pin.messageId)) return prev;
      const id = `pin-temp-${Date.now()}`;
      tempId = id;
      return [{ ...pin, id, createdAt: new Date().toISOString() }, ...prev];
    });

    if (!tempId) return; // already pinned

    try {
      const backendPin = await createPin(pin.messageId);
      setPins((prev) =>
        prev.map((p) =>
          p.id === tempId
            ? {
                ...p,
                id: backendPin.id,
                tags: backendPin.tags?.length ? backendPin.tags : p.tags,
                createdAt: backendPin.created_at ?? p.createdAt,
              }
            : p,
        ),
      );
    } catch (err) {
      console.error("[PinboardContext] Failed to save pin", err);
      setPins((prev) => prev.filter((p) => p.id !== tempId));
      toast.error("Failed to save pin");
    }
  }, []);

  // ── removePin — optimistic, persisted to backend ────────────────────────
  const removePin = useCallback((id: string) => {
    setPins((prev) => prev.filter((p) => p.id !== id));
    if (!id.startsWith("pin-temp-")) {
      deletePin(id).catch((err) =>
        console.error("[PinboardContext] Failed to delete pin", err),
      );
    }
  }, []);

  // ── removePinByMessage ──────────────────────────────────────────────────
  const removePinByMessage = useCallback((messageId: string) => {
    let targetId: string | undefined;
    setPins((prev) => {
      const pin = prev.find((p) => p.messageId === messageId);
      targetId = pin?.id;
      return prev.filter((p) => p.messageId !== messageId);
    });
    if (targetId && !targetId.startsWith("pin-temp-")) {
      deletePin(targetId).catch((err) =>
        console.error("[PinboardContext] Failed to delete pin", err),
      );
    }
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
