
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ModelSelectorDialog } from "./model-selector-dialog";
import { Button } from "../ui/button";
import type { AIModel } from "@/types/ai-model";
import { getModelIcon } from "@/lib/model-icons";

interface ModelSelectorProps {
  selectedModel: AIModel | null;
  onModelSelect: (model: AIModel) => void;
}

export function ModelSelector({ selectedModel, onModelSelect }: ModelSelectorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const handleModelSelect = (model: AIModel) => {
    onModelSelect(model);
    setIsDialogOpen(false);
  };

  return (
    <>
      <button
        className="group relative inline-flex h-[33px] min-w-[145px] items-center gap-2 rounded-full border border-[#171717] bg-[#171717] px-3 text-white transition-colors hover:bg-[#1f1f1f]"
        onClick={() => setIsDialogOpen(true)}
      >
        <span className="flex h-[27px] w-[27px] items-center justify-center rounded-full bg-white/10">
          <img
            src={getModelIcon(
              selectedModel?.companyName,
              selectedModel?.modelName
            )}
            alt="Model icon"
            className="h-4 w-4"
          />
        </span>
        <span className="text-[16px] leading-tight font-medium whitespace-nowrap">
          {selectedModel ? selectedModel.modelName : "Select model"}
        </span>
        <span className="flex h-[27px] w-[27px] items-center justify-center rounded-full border border-white/20 bg-white/10">
          <ChevronDown className="h-4 w-4 text-white" strokeWidth={2} />
        </span>
      </button>
      <ModelSelectorDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onModelSelect={handleModelSelect}
      />
    </>
  );
}
