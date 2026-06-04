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
import { useAuth } from "@/context/auth-context";
import { canAccessFramework } from "@/lib/plan-config";
import type { AIModel } from "@/types/ai-model";

// â”€â”€ localStorage persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STORAGE_KEY = "souvenir_model_pref";

interface StoredModelPref {
  type: "muse" | "model";
  museAdvanced?: boolean;
}

function readStoredPref(): StoredModelPref | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "type" in (parsed as object) &&
      ((parsed as StoredModelPref).type === "muse" ||
        (parsed as StoredModelPref).type === "model")
    ) {
      return parsed as StoredModelPref;
    }
  } catch {}
  return null;
}

function writeStoredPref(pref: StoredModelPref): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
  } catch {}
}

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ModelSelectorContextValue {
  models: AIModel[];
  selectedModel: AIModel | null;
  isLoading: boolean;
  selectModel: (model: AIModel) => void;
  isOpen: boolean;
  anchorEl: HTMLElement | null;
  open: (anchor: HTMLElement) => void;
  close: () => void;
  // â”€â”€ Muse framework â”€â”€
  museActive: boolean;
  museAdvanced: boolean;
  activateMuse: () => void;
  deactivateMuse: () => void;
  setMuseAdvanced: (advanced: boolean) => void;
  // â”€â”€ Adaptive thinking â”€â”€
  enableReasoning: boolean;
  setEnableReasoning: (v: boolean) => void;
  // ── Persona lock ──
  /** True while a persona chip is active. Blocks open() and auto-closes the dialog. */
  personaActive: boolean;
  /** Called by the chat page to push persona-active state into the context. */
  setPersonaActive: (active: boolean) => void;
}

// â”€â”€ Context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ModelSelectorContext = createContext<ModelSelectorContextValue | null>(
  null,
);

// â”€â”€ Provider â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function ModelSelectorProvider({
  children,
}: {
  children: React.ReactNode;
// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
}) {
  const { user } = useAuth();
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
  // Start with server-safe defaults so SSR and client first render match.
  // localStorage is read in a useEffect after mount to avoid hydration mismatches.
  const [museActive, setMuseActive] = useState<boolean>(true);
  const [museAdvanced, setMuseAdvanced] = useState<boolean>(false);
  const [enableReasoning, setEnableReasoning] = useState(true);

  // Sync museActive/museAdvanced from localStorage after mount
  useEffect(() => {
    const pref = readStoredPref();
    if (pref !== null) {
      setMuseActive(pref.type === "muse");
      setMuseAdvanced(pref.type === "muse" ? (pref.museAdvanced ?? false) : false);
    }
  }, []);

  // Apply plan-based defaults once user loads, only when no stored preference exists
  const planDefaultApplied = useRef(false);
  useEffect(() => {
    if (planDefaultApplied.current) return;
    if (readStoredPref() !== null) {
      planDefaultApplied.current = true;
      return;
    }
    if (!user?.planType) return;
    planDefaultApplied.current = true;
    const hasAdvanced = canAccessFramework(user.planType, "advanced");
    setMuseActive(true);
    setMuseAdvanced(hasAdvanced);
  }, [user?.planType]);

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

  // Selecting a specific model deactivates Muse and persists the choice
  const selectModel = useCallback(
    (model: AIModel) => {
      baseSelectModel(model);
      setMuseActive(false);
      writeStoredPref({ type: "model" });
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
    writeStoredPref({ type: "model" });
  }, []);

  // Toggling the advanced switch also activates Muse and persists the choice
  const setMuseAdvancedFn = useCallback((advanced: boolean) => {
    setMuseAdvanced(advanced);
    setMuseActive(true);
    writeStoredPref({ type: "muse", museAdvanced: advanced });
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

// â”€â”€ Hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function useModelSelectorContext(): ModelSelectorContextValue {
  const ctx = use(ModelSelectorContext);
  if (!ctx)
    throw new Error(
      "useModelSelectorContext must be used within ModelSelectorProvider",
    );
  return ctx;
}
