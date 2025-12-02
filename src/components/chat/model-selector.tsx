
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ModelSelectorDialog } from "./model-selector-dialog";
import { ModelSwitchConfirmationDialog } from "./model-switch-confirmation-dialog";
import { Button } from "../ui/button";
import type { AIModel } from "@/types/ai-model";
import { getModelIcon } from "@/lib/model-icons";

interface ModelSelectorProps {
  selectedModel: AIModel | null;
  onModelSelect: (model: AIModel) => void;
}

export function ModelSelector({ selectedModel, onModelSelect }: ModelSelectorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [pendingModel, setPendingModel] = useState<AIModel | null>(null);

  const handleModelSelect = (model: AIModel) => {
    // If there's already a selected model and it's different from the new one, show confirmation
    if (selectedModel && selectedModel.modelName !== model.modelName) {
      setPendingModel(model);
      setIsDialogOpen(false);
      setIsConfirmationOpen(true);
    } else {
      // No current model or same model selected, proceed directly
      onModelSelect(model);
      setIsDialogOpen(false);
    }
  };

  const handleConfirmSwitch = () => {
    if (pendingModel) {
      onModelSelect(pendingModel);
      setPendingModel(null);
    }
  };

  return (
    <>
      <button
        className="model-selector-trigger"
        onClick={() => setIsDialogOpen(true)}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isDialogOpen}
      >
        {selectedModel && (
          <span className="model-selector-icon">
            <img
              src={getModelIcon(
                selectedModel?.companyName,
                selectedModel?.modelName
              )}
              alt="Model icon"
            />
          </span>
        )}
        <span className="model-selector-label">
          {selectedModel ? selectedModel.modelName : "Select model"}
        </span>
        <ChevronDown className="model-selector-caret" strokeWidth={2} />
      </button>
      <ModelSelectorDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onModelSelect={handleModelSelect}
      />
      {selectedModel && pendingModel && (
        <ModelSwitchConfirmationDialog
          open={isConfirmationOpen}
          onOpenChange={setIsConfirmationOpen}
          currentModel={selectedModel}
          newModel={pendingModel}
          onConfirm={handleConfirmSwitch}
        />
      )}
    </>
  );
}
