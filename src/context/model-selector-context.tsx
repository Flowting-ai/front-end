"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { useModelSelection } from "@/hooks/use-model-selection";
import type { AIModel } from "@/types/ai-model";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ModelSelectorContextValue {
  models: AIModel[];
  selectedModel: AIModel | null;
  isLoading: boolean;
  selectModel: (model: AIModel) => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

// ── Context ────────────────────────────────────────────────────────────────────

const ModelSelectorContext = createContext<ModelSelectorContextValue | null>(
  null,
);

// ── Provider ───────────────────────────────────────────────────────────────────

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

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const selectModel = useCallback(
    (model: AIModel) => {
      baseSelectModel(model);
      setIsOpen(false);
    },
    [baseSelectModel],
  );

  return (
    <ModelSelectorContext.Provider
      value={{ models, selectedModel, isLoading, selectModel, isOpen, open, close }}
    >
      {children}
    </ModelSelectorContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useModelSelectorContext(): ModelSelectorContextValue {
  const ctx = useContext(ModelSelectorContext);
  if (!ctx)
    throw new Error(
      "useModelSelectorContext must be used within ModelSelectorProvider",
    );
  return ctx;
}
