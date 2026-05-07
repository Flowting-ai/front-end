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
  anchorEl: HTMLElement | null;
  open: (anchor: HTMLElement) => void;
  close: () => void;
  // ── Muse framework ──
  museActive: boolean;
  museAdvanced: boolean;
  activateMuse: () => void;
  deactivateMuse: () => void;
  setMuseAdvanced: (advanced: boolean) => void;
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
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [museActive, setMuseActive] = useState(false);
  const [museAdvanced, setMuseAdvanced] = useState(false);

  const open = useCallback((anchor: HTMLElement) => {
    setIsOpen((prev) => {
      if (prev && anchorEl === anchor) {
        setAnchorEl(null);
        return false;
      }
      setAnchorEl(anchor);
      return true;
    });
  }, [anchorEl]);

  const close = useCallback(() => {
    setIsOpen(false);
    setAnchorEl(null);
  }, []);

  // Selecting a specific model deactivates Muse
  const selectModel = useCallback(
    (model: AIModel) => {
      baseSelectModel(model);
      setMuseActive(false);
      setIsOpen(false);
      setAnchorEl(null);
    },
    [baseSelectModel],
  );

  // Activating Muse closes the selector (mirrors selectModel behaviour)
  const activateMuse = useCallback(() => {
    setMuseActive(true);
    setIsOpen(false);
    setAnchorEl(null);
  }, []);

  const deactivateMuse = useCallback(() => {
    setMuseActive(false);
  }, []);

  // Toggling the advanced switch also activates Muse when it isn't already
  const setMuseAdvancedFn = useCallback((advanced: boolean) => {
    setMuseAdvanced(advanced);
    setMuseActive(true);
  }, []);

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
        museActive,
        museAdvanced,
        activateMuse,
        deactivateMuse,
        setMuseAdvanced: setMuseAdvancedFn,
      }}
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
