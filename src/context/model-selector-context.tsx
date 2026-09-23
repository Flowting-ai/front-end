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

// ── Types ────────────────────────────────────────────────────────────────────

/** Souvenir's own auto-routing tiers — the backend picks the underlying
 *  model itself. Mutually exclusive with a direct `selectedModel` pick (see
 *  `selectAlgorithm`/`selectModel` below): choosing one clears the other. */
export type ModelAlgorithm = "base" | "pro";

interface ModelSelectorContextValue {
  models: AIModel[];
  /** `null` whenever `algorithm` is set — the two selections are mutually exclusive. */
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
  // ── Auto routing ──
  /** `null` whenever a direct model is selected instead. */
  algorithm: ModelAlgorithm | null;
  selectAlgorithm: (value: ModelAlgorithm) => void;
  // ── Persona lock ──
  /** True while a persona chip is active. Blocks open() and auto-closes the dialog. */
  personaActive: boolean;
  /** Called by the chat page to push persona-active state into the context. */
  setPersonaActive: (active: boolean) => void;
}

// ── Context ──────────────────────────────────────────────────────────────────

const ModelSelectorContext = createContext<ModelSelectorContextValue | null>(
  null,
);

// ── Auto-routing persistence ────────────────────────────────────────────────
// Separate key from useModelSelection's own `souvenir_selected_model` — the
// two selections are independent in storage; which one wins on load is
// decided by getInitialAlgorithm below (an explicit algorithm choice always
// wins, so a stale leftover model key from a mode someone switched away from
// can't resurrect itself).

const ALGORITHM_STORAGE_KEY = "souvenir_selected_algorithm";
const MODEL_STORAGE_KEY = "souvenir_selected_model";

function isModelAlgorithm(value: string | null): value is ModelAlgorithm {
  return value === "base" || value === "pro";
}

/**
 * Resolves the mode/value to open on: an explicit stored algorithm choice
 * wins outright; otherwise a previously-stored direct model pick (from
 * before this feature existed, or a user who deliberately switched to
 * "Select a Model") keeps that mode instead of being silently overridden;
 * only a genuinely fresh browser (neither key set) defaults to Auto Routing
 * → Souvenir Standard ('base').
 */
function getInitialAlgorithm(): ModelAlgorithm | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(ALGORITHM_STORAGE_KEY);
    if (isModelAlgorithm(stored)) return stored;
    const hasStoredModel = !!localStorage.getItem(MODEL_STORAGE_KEY);
    return hasStoredModel ? null : "base";
  } catch {
    return "base";
  }
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function ModelSelectorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    models,
    selectedModel: rawSelectedModel,
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
  // Starts `null` (not `getInitialAlgorithm()`) on both server and client's
  // first render, then resolves from localStorage in a mount-only effect —
  // same SSR-hydration-safe pattern useModelSelection uses for its own
  // cached selectedModel (see getInitialModelFromStorage there). Reading
  // localStorage inside the useState initializer would return different
  // values on the server (undefined `window`) vs. the client, mismatching
  // the hydrated markup.
  const [algorithm, setAlgorithm] = useState<ModelAlgorithm | null>(null);
  useEffect(() => {
    setAlgorithm(getInitialAlgorithm());
  }, []);
  // The two selections are mutually exclusive — mask the hook's own
  // `selectedModel` to null while an algorithm tier is active, rather than
  // making every consumer (ChatInterface, useModelButtonLabel, ModelMenu's
  // checkmarks) re-derive that themselves.
  const selectedModel = algorithm ? null : rawSelectedModel;

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
      setAlgorithm(null);
      try {
        localStorage.removeItem(ALGORITHM_STORAGE_KEY);
      } catch {
        /* ignore quota/availability errors */
      }
      setIsOpen(false);
      setAnchorEl(null);
    },
    [baseSelectModel],
  );

  const selectAlgorithm = useCallback((value: ModelAlgorithm) => {
    setAlgorithm(value);
    try {
      localStorage.setItem(ALGORITHM_STORAGE_KEY, value);
    } catch {
      /* ignore quota/availability errors */
    }
    setIsOpen(false);
    setAnchorEl(null);
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
        enableReasoning,
        setEnableReasoning,
        algorithm,
        selectAlgorithm,
        personaActive,
        setPersonaActive,
      }}
    >
      {children}
    </ModelSelectorContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useModelSelectorContext(): ModelSelectorContextValue {
  const ctx = use(ModelSelectorContext);
  if (!ctx)
    throw new Error(
      "useModelSelectorContext must be used within ModelSelectorProvider",
    );
  return ctx;
}
