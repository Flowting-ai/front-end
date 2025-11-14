
"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { ModelSelectorDialog } from "./model-selector-dialog";
import { Button } from "../ui/button";

// Define the model type directly here as the types file is removed.
interface AIModel {
  companyName: string;
  modelName: string;
  version: string;
  modelType: 'free' | 'paid';
  inputLimit: number;
  outputLimit: number;
}

export function ModelSelector() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);

  const handleModelSelect = (model: AIModel) => {
    setSelectedModel(model);
    setIsDialogOpen(false);
  };

  return (
    <>
      <Button variant="outline" className="w-auto gap-2" onClick={() => setIsDialogOpen(true)}>
        <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
        <span>{selectedModel ? selectedModel.modelName : "Select a model"}</span>
      </Button>
      <ModelSelectorDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onModelSelect={handleModelSelect}
      />
    </>
  );
}
