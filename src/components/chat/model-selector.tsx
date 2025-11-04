
"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { ChevronsUpDown } from "lucide-react";
import { ModelSelectorDialog } from "./model-selector-dialog";
import { Button } from "../ui/button";

const models = [
  { name: "Gemini 2.5 Flash", credits: "1M tokens" },
  { name: "Model B", credits: "500K tokens" },
  { name: "Model C", credits: "2M tokens" },
];

export function ModelSelector() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Button variant="outline" className="w-auto gap-2" onClick={() => setIsDialogOpen(true)}>
        <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
        <span>Select a model</span>
      </Button>
      <ModelSelectorDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </>
  );
}
