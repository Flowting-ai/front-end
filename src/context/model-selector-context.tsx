"use client";

import React, {
  createContext,
  useCallback,
  use,
  useEffect,
  useRef,
  useState,
} from "react";
import { useModelSelection } from "@/hooks/use-model-selection";
import type { AIModel } from "@/types/ai-model";

// ── Types ───────────────────────────────────────────────────────────────────

interface ModelSelectorContextValue {
  models: AIModel[];
  selectedModel: AIModel | null;
  isLoading: boolean;
  selectModel: (model: AIModel) => void;
  isOpen: boolean;
  anchorEl: HTMLElement | null;
  open: (anchor: HTMLElement) => void;
  close: () => void;
  // ── Adaptive thinking ──
  enableReasoning: boolean;
  setEnableReasoning: (v: boolean) => void;
  // ── Persona lock ──
  /** True while a persona chip is active. Blocks open() and auto-closes the dialog. */
  personaActive: boolean;
  /** Called by the chat page to push persona-active state into the context. */
  setPersonaActive: (active: boolean) => void;
}

// ── Context ─────────────────────────────────────────────────────────────────

const ModelSelectorContext = createContext<ModelSelectorContextValue | null>(
  null,
);

// ── Provider ────────────────────────────────────────────────────────────────

export function ModelSelectorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    models,
    selectedModel,
    isLoading,
    selectModel: baseSelectModel,
  } = useModelSelection();

  const [isOpen, setIsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [personaActive, setPersonaActive] = useState(false);
  // Ref so the open() callback always reads the latest value without needing
  // personaActive in its dependency array (keeps the callback stable).
  const personaActiveRef = useRef(false);
  personaActiveRef.current = personaActive;
  const [enableReasoning, setEnableReasoning] = useState(true);

  const open = useCallback((anchor: HTMLElement) => {
    // Blocked while a persona is active — model must stay fixed to the persona's model.
    if (personaActiveRef.current) return;
    setIsOpen((prev) => {
      if (prev && anchorEl === anchor) {
        setAnchorEl(null);
        return false;
      }
      setAnchorEl(anchor);
      return true;
    });
  }, [anchorEl]);

  // If the dialog happens to be open when a persona is activated, close it immediately.
  useEffect(() => {
    if (personaActive && isOpen) {
      setIsOpen(false);
      setAnchorEl(null);
    }
  }, [personaActive, isOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    setAnchorEl(null);
  }, []);

  const selectModel = useCallback(
    (model: AIModel) => {
      baseSelectModel(model);
      setIsOpen(false);
      setAnchorEl(null);
    },
    [baseSelectModel],
  );

  return (
    <ModelSelectorContext.Provider
      value={{
        models,
        selectedModel,
        isLoading,
        selectModel,
        isOpen,
        anchorEl,
        open,
        close,
        enableReasoning,
        setEnableReasoning,
        personaActive,
        setPersonaActive,
      }}
    >
      {children}
    </ModelSelectorContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useModelSelectorContext(): ModelSelectorContextValue {
  const ctx = use(ModelSelectorContext);
  if (!ctx)
    throw new Error(
      "useModelSelectorContext must be used within ModelSelectorProvider",
    );
  return ctx;
}
