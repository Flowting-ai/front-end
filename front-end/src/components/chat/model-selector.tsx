"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ModelSelectorDialog } from "./model-selector-dialog";
import { ModelSwitchDialog, type ModelSwitchConfig } from "./model-switch-dialog";
import { Button } from "../ui/button";
import type { AIModel } from "@/types/ai-model";
import { getModelIcon } from "@/lib/model-icons";
import Image from "next/image";

interface ModelSelectorProps {
  selectedModel: AIModel | null;
  useFramework: boolean;
  onModelSelect: (model: AIModel | null) => void;
  onFrameworkChange: (useFramework: boolean) => void;
  chatBoards?: Array<{ id: string; name: string }>;
}

export function ModelSelector({
  selectedModel,
  onModelSelect,
  useFramework,
  onFrameworkChange,
  chatBoards = [],
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
      onFrameworkChange(false);
      onModelSelect(model);
      setIsDialogOpen(false);
    }
  };

  const handleConfirmSwitch = (config: ModelSwitchConfig) => {
    onFrameworkChange(false);
    onModelSelect(config.model);
    setPendingModel(null);
    // TODO: Handle additional config like chatMemory, includePins, includeFiles if needed
  };

  const handleFrameworkSelect = () => {
    onFrameworkChange(true);
    onModelSelect(null);
    setPendingModel(null);
    setIsDialogOpen(false);
  };

  return (
    <>
      <button
        className="group cursor-pointer w-auto h-[33px] text-[#171717] hover:text-white bg-zinc-100 hover:bg-[#171717] border-2 border-main-border hover:border-zinc-200 rounded-[7px] inline-flex items-center gap-1.5 py-0 px-3 transition-all duration-500"
        onClick={() => setIsDialogOpen(true)}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isDialogOpen}
      >
        {useFramework ? (
          <span className="w-5 h-5 bg-transparent group-hover:bg-white rounded-full shrink-0 inline-flex items-center justify-center p-0.5 transition-all duration-500">
            <Image src="/icons/logo.png" alt="Flowting AI" width={16} height={16}/>
          </span>
        ) : selectedModel ? (
          <span className="w-5 h-5 bg-transparent group-hover:bg-white rounded-full shrink-0 inline-flex items-center justify-center p-0.5 transition-all duration-500">
            <Image
              src={getModelIcon(
                selectedModel?.companyName,
                selectedModel?.modelName,
                selectedModel?.sdkLibrary
              )}
              alt="Model icon"
              width={16}
              height={16}
            />
          </span>
        ) : null}
        <span className="model-selector-label font-inter font-[400] text-[14px] whitespace-nowrap">
          {useFramework
            ? "Flowting AI Framework"
            : selectedModel
            ? selectedModel.modelName
            : "Select model"}
        </span>
        <ChevronDown className="w-[16px] h-[16px] shrink-0" strokeWidth={2} />
      </button>
      <ModelSelectorDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onModelSelect={handleModelSelect}
        onFrameworkSelect={handleFrameworkSelect}
        useFramework={useFramework}
      />
      {/* <ModelSwitchDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onModelSelect={handleModelSelect}
      /> */}
      {selectedModel && pendingModel && (
        <ModelSwitchDialog
          open={isConfirmationOpen}
          onOpenChange={setIsConfirmationOpen}
          currentModel={selectedModel}
          onModelSwitch={handleConfirmSwitch}
          chatBoards={chatBoards}
        />
      )}
    </>
  );
}
