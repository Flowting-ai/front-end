"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useModelSelection } from "@/hooks/use-model-selection";
import { useAuth } from "@/context/auth-context";
import { canAccessFramework } from "@/lib/plan-config";
import type { AIModel } from "@/types/ai-model";

// ── localStorage persistence ───────────────────────────────────────────────────

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
  // ── Adaptive thinking ──
  enableReasoning: boolean;
  setEnableReasoning: (v: boolean) => void;
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
  const { user } = useAuth();
  const {
    models,
    selectedModel,
    isLoading,
    selectModel: baseSelectModel,
  } = useModelSelection();

  const [isOpen, setIsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  // SSR-safe defaults; client-side preferences are restored in useEffect below
  const [museActive, setMuseActive] = useState(true);
  const [museAdvanced, setMuseAdvanced] = useState(false);
  const [enableReasoning, setEnableReasoning] = useState(true);

  // Restore from localStorage after hydration (client-only, avoids SSR mismatch)
  useEffect(() => {
    const pref = readStoredPref();
    if (pref !== null) {
      setMuseActive(pref.type === "muse");
      setMuseAdvanced(pref.type === "muse" ? (pref.museAdvanced ?? false) : false);
    }
  }, []); // mount only

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
