
"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { ModelSelectorDialog } from "./model-selector-dialog";
import { Button } from "../ui/button";

export type Model = {
  name: string;
  credits?: string;
  type: "free" | "paid";
  icon: string;
};

export function ModelSelector() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>({
    name: "Gemini 2.5 Flash",
    credits: "1M tokens",
    type: "paid",
    icon: "/gemini.svg"
  });

  const handleModelSelect = (model: Model) => {
    setSelectedModel(model);
    setIsDialogOpen(false);
  };

  return (
    <>
      <Button variant="outline" className="w-auto gap-2" onClick={() => setIsDialogOpen(true)}>
        <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
        <span>{selectedModel ? selectedModel.name : "Select a model"}</span>
      </Button>
      <ModelSelectorDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onModelSelect={handleModelSelect}
      />
    </>
  );
}
