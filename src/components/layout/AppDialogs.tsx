"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CompareModelsPage from "../compare/compare-models";
import { ModelDialog } from "../chat/ModelDialog";
import type { ModelSwitchConfig } from "../chat/ModelDialog";
import { UpgradePlanDialog } from "@/components/pricing/upgrade-plan-dialog";
import type { AIModel } from "@/types/ai-model";
import type { UserPlanType } from "@/lib/api/user";
import type { ChatBoard } from "./app-layout";

interface AppDialogsProps {
  // ── Compare Models overlay ──────────────────────────────────────────────
  isCompareModalOpen: boolean;
  setIsCompareModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedModel: AIModel | null;
  onModelSelectFromCompare: (model: AIModel) => void;

  // ── Model-switch confirmation dialog ────────────────────────────────────
  isModelSwitchConfirmOpen: boolean;
  setIsModelSwitchConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** The model the user wants to switch to (null when no switch is pending). */
  pendingModelFromCompare: AIModel | null;
  onConfirmModelSwitch: (config: ModelSwitchConfig) => void;
  chatBoards: ChatBoard[];

  // ── Pin plan-limit upgrade dialog ───────────────────────────────────────
  showPinUpgradeDialog: boolean;
  setShowPinUpgradeDialog: React.Dispatch<React.SetStateAction<boolean>>;
  /** The user's current plan, or `undefined` when not yet loaded. */
  userPlanType: UserPlanType | undefined;
  pinsCount: number;
}

/**
 * Groups all app-level overlay dialogs that are not part of the layout shell
 * structure: the Compare Models modal, the Model Switch confirmation, and the
 * Pin Plan Upgrade dialog.
 *
 * Rendering all three in one component keeps `AppLayout` free of dialog
 * wiring and makes each dialog individually testable via its props.
 */
export function AppDialogs({
  isCompareModalOpen,
  setIsCompareModalOpen,
  selectedModel,
  onModelSelectFromCompare,
  isModelSwitchConfirmOpen,
  setIsModelSwitchConfirmOpen,
  pendingModelFromCompare,
  onConfirmModelSwitch,
  chatBoards,
  showPinUpgradeDialog,
  setShowPinUpgradeDialog,
  userPlanType,
  pinsCount,
}: AppDialogsProps) {
  return (
    <>
      {/* Compare Models full-screen dialog */}
      <Dialog open={isCompareModalOpen} onOpenChange={setIsCompareModalOpen}>
        <DialogContent
          id="compare-models-parent"
          className="min-w-[1006px] w-auto max-h-full h-auto flex items-center justify-center overflow-x-hidden overflow-y-hidden px-0"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Compare Models</DialogTitle>
          </DialogHeader>
          <CompareModelsPage
            selectedModel={selectedModel}
            onModelSelect={onModelSelectFromCompare}
            onClose={() => setIsCompareModalOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Model switch confirmation — only mounted when a pending switch exists */}
      {selectedModel && pendingModelFromCompare && (
        <ModelDialog
          mode="switch"
          open={isModelSwitchConfirmOpen}
          onOpenChange={setIsModelSwitchConfirmOpen}
          currentModel={selectedModel}
          pendingModel={pendingModelFromCompare}
          onModelSwitch={onConfirmModelSwitch}
          chatBoards={chatBoards}
        />
      )}

      {/* Pin plan-limit upgrade prompt */}
      {userPlanType && (
        <UpgradePlanDialog
          open={showPinUpgradeDialog}
          onOpenChange={setShowPinUpgradeDialog}
          currentPlan={userPlanType}
          resource="pins"
          currentCount={pinsCount}
        />
      )}
    </>
  );
}
