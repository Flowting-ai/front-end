"use client";

/**
 * useModelSelection — manages all model-selection, framework-mode, and
 * compare-modal state that was previously embedded inside `AppLayout`.
 *
 * Responsibilities:
 *   - Selected AI model (`selectedModel`, `setSelectedModel`).
 *   - Framework toggle and tier (`useFramework`, `frameworkType`).
 *   - Memory percentage slider (`memoryPercentage`).
 *   - Compare-models dialog state (`isCompareModalOpen`).
 *   - Pending model / model-switch confirmation dialog.
 *   - `selectedPinIdsForNextMessage` — pins attached to the next outgoing
 *     message (logically part of message composition; lives here until a
 *     dedicated useMessageComposer hook is extracted in Phase 4).
 *   - `referencesSources` — citation list rendered in the References right-
 *     sidebar panel (no dedicated hook yet; lives here as a neutral home).
 *
 * NOT in scope:
 *   - Sidebar visibility state  → stays in AppLayout UI layer.
 *   - Pin CRUD operations        → `usePinOperations` (next Phase 3 task).
 *   - Chat board management      → `useChatHistory`.
 *   - Persona loading            → stays in AppLayout until Phase 4.
 *
 * Cross-hook dependency:
 *   `handleModelSelectFromCompare` must know whether the active chat already
 *   has messages (to prompt the user before switching mid-conversation). The
 *   caller passes `activeChatMessages` — the already-loaded message array for
 *   the active chat — avoiding a direct dependency on the `chatHistory` map or
 *   `useChatHistory` internals.
 */

import { useState, useEffect } from "react";
import type { Message, MessageSource } from "@/components/chat/chat-message";
import type { AIModel } from "@/types/ai-model";
import type { ModelSwitchConfig } from "@/components/chat/model-switch-dialog";
import { canAccessFramework } from "@/lib/plan-config";

// ─── Hook params ────────────────────────────────────────────────────────────────

export interface UseModelSelectionParams {
  /**
   * The currently loaded messages for the active chat. Used by
   * `handleModelSelectFromCompare` to detect whether the user is switching
   * models mid-conversation (which requires a confirmation step).
   */
  activeChatMessages: Message[];

  /**
   * The current user's plan type (from `useAuth`). Used to default the
   * framework tier to "pro" for Pro/Power plan subscribers on initial load.
   */
  userPlanType?: "starter" | "pro" | "power" | null;
}

// ─── Hook implementation ─────────────────────────────────────────────────────────

export function useModelSelection({
  activeChatMessages,
  userPlanType,
}: UseModelSelectionParams) {
  // ── Core model state ─────────────────────────────────────────────────────────

  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [useFramework, setUseFramework] = useState(true);
  const [frameworkType, setFrameworkType] = useState<"starter" | "pro">("starter");
  const [memoryPercentage, setMemoryPercentage] = useState<number>(0.2);

  // ── Compare / confirm-switch dialog state ────────────────────────────────────

  /**
   * Controlled open state for the Compare Models dialog.
   * The dialog itself is rendered by AppLayout but its state lives here.
   */
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  /**
   * The model chosen in the Compare dialog that is pending user confirmation
   * before it replaces the active model. Non-null only when a model switch
   * requires a confirmation step (i.e. the active chat already has messages).
   */
  const [pendingModelFromCompare, setPendingModelFromCompare] =
    useState<AIModel | null>(null);

  /**
   * Controlled open state for the ModelSwitchDialog confirmation dialog.
   * Opened automatically after the Compare dialog closes and a pending model
   * exists (see effect below).
   */
  const [isModelSwitchConfirmOpen, setIsModelSwitchConfirmOpen] =
    useState(false);

  // ── Message-composition helpers ──────────────────────────────────────────────

  /**
   * IDs of pins the user has selected to include with the next outgoing
   * message. Surfaced in the Topbar pin picker and read by ChatInterface when
   * building the request payload.
   */
  const [selectedPinIdsForNextMessage, setSelectedPinIdsForNextMessage] =
    useState<string[]>([]);

  /**
   * Citation/source objects shown in the References right-sidebar panel.
   * Written by the streaming hook when the AI response includes sources and
   * read by the RightSidebar References tab.
   */
  const [referencesSources, setReferencesSources] = useState<MessageSource[]>([]);

  // ── Effects ─────────────────────────────────────────────────────────────────

  /**
   * On initial load, default the framework tier to "pro" for users on plans
   * that can access the advanced framework. This is a one-time initialisation;
   * subsequent changes are driven by explicit user interaction.
   */
  useEffect(() => {
    if (userPlanType && canAccessFramework(userPlanType, "advanced")) {
      setFrameworkType("pro");
    }
    // Only run when the plan type becomes known for the first time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPlanType]);

  /**
   * After the Compare dialog fully closes and a pending model exists, open
   * the ModelSwitchDialog with a brief delay so the two dialogs don't overlap.
   */
  useEffect(() => {
    if (pendingModelFromCompare && !isCompareModalOpen) {
      const timer = setTimeout(() => setIsModelSwitchConfirmOpen(true), 100);
      return () => clearTimeout(timer);
    }
  }, [pendingModelFromCompare, isCompareModalOpen]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  /**
   * Called when the user selects a model from the Compare Models page.
   *
   * If the active chat has messages and the selected model differs from the
   * current one, the switch is staged as a "pending" model and requires an
   * explicit confirmation step via `ModelSwitchDialog`. Otherwise the switch
   * is applied immediately.
   */
  const handleModelSelectFromCompare = (model: AIModel) => {
    const hasMessages = activeChatMessages.length > 0;
    const isDifferentModel =
      selectedModel !== null && selectedModel.modelName !== model.modelName;

    if (hasMessages && isDifferentModel) {
      // Stage the switch — `ModelSwitchDialog` will be opened by the effect above.
      setPendingModelFromCompare(model);
      setIsCompareModalOpen(false);
    } else {
      // No existing messages, or same model — switch immediately.
      setUseFramework(false);
      setSelectedModel(model);
      setIsCompareModalOpen(false);
    }
  };

  /**
   * Called when the user confirms (or modifies) the model switch inside
   * `ModelSwitchDialog`. Applies the chosen configuration and clears the
   * pending model.
   */
  const handleConfirmModelSwitch = (config: ModelSwitchConfig) => {
    if (config.algorithm) {
      setUseFramework(true);
      setFrameworkType(config.algorithm === "base" ? "starter" : "pro");
      setSelectedModel(null);
    } else {
      setUseFramework(false);
      setSelectedModel(config.model);
    }
    setMemoryPercentage(config.memoryPercentage);
    setPendingModelFromCompare(null);
  };

  // ── Return value ──────────────────────────────────────────────────────────────

  return {
    // Model state
    selectedModel,
    setSelectedModel,
    useFramework,
    setUseFramework,
    frameworkType,
    setFrameworkType,
    memoryPercentage,
    setMemoryPercentage,
    // Compare / confirm-switch dialog state
    isCompareModalOpen,
    setIsCompareModalOpen,
    pendingModelFromCompare,
    isModelSwitchConfirmOpen,
    setIsModelSwitchConfirmOpen,
    // Handlers
    handleModelSelectFromCompare,
    handleConfirmModelSwitch,
    // Message composition helpers
    selectedPinIdsForNextMessage,
    setSelectedPinIdsForNextMessage,
    // References panel data
    referencesSources,
    setReferencesSources,
  };
}

/** Convenience type alias for consumers who want the full return type. */
export type ModelSelectionReturn = ReturnType<typeof useModelSelection>;
