"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ModelSelectorDialog } from "./model-selector-dialog";
import { ModelSwitchDialog } from "./model-switch-dialog";
import { ModelSwitchConfirmationDialog } from "./model-switch-confirmation-dialog";
import { Button } from "../ui/button";
import type { AIModel } from "@/types/ai-model";
import { getModelIcon } from "@/lib/model-icons";
import Image from "next/image";

interface ModelSelectorProps {
  selectedModel: AIModel | null;
  onModelSelect: (model: AIModel) => void;
}

export function ModelSelector({
  selectedModel,
  onModelSelect,
}: ModelSelectorProps) {
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
        className="cursor-pointer w-auto h-[33px] text-white bg-[#171717] border border-[#171717] hover:border-[#1f1f1f] rounded-[7px] inline-flex items-center gap-1.5 py-0 px-3 transition-all duration-300"
        onClick={() => setIsDialogOpen(true)}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isDialogOpen}
      >
        {selectedModel && (
          <span className="w-5 h-5 bg-[rgba(255, 255, 255, 0.95)] rounded-[50%] shrink-0 inline-flex items-center justify-center p-0.5">
            <Image
              src={getModelIcon(
                selectedModel?.companyName,
                selectedModel?.modelName
              )}
              alt="Model icon"
            />
          </span>
        )}
        <span className="model-selector-label font-inter font-[400] text-[14px] whitespace-nowrap">
          {selectedModel ? selectedModel.modelName : "Select model"}
        </span>
        <ChevronDown className="w-[16px] h-[16px] text-[white] shrink-0" strokeWidth={2} />
      </button>
      <ModelSelectorDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onModelSelect={handleModelSelect}
      />
      {/* <ModelSwitchDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onModelSelect={handleModelSelect}
      /> */}
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
