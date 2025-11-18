
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Search, Info, Bookmark, Loader2 } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
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


const getIconForCompany = (companyName: string) => {
    switch (companyName.toLowerCase()) {
        case 'openai':
            return '/open.svg';
        case 'anthropic':
            return '/claude.svg';
        case 'google':
            return '/gemini.svg';
        case 'mistral ai':
            return '/mistral.svg';
        default:
            return '/default-icon.svg'; // A fallback icon
    }
}

interface ModelSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModelSelect: (model: AIModel) => void;
}

export function ModelSelectorDialog({ open, onOpenChange, onModelSelect }: ModelSelectorDialogProps) {
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
useEffect(() => {
  if (!open) return;

  const fetchModels = async () => {
    setIsLoading(true);

    try {
      // NOTE: removed leading space and you can add slash if your URL expects it
      const response = await fetch("http://127.0.0.1:8000/get_models");

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }

      const raw: AIModel[] = await response.json();
      console.log("Raw models from backend:", raw);

      
      setModels(raw);
    } catch (error) {
      console.error("Error fetching models:", error);
      setModels([]);
    } finally {
      setIsLoading(false);
    }
  };

  fetchModels();
}, [open]);

 const filteredModels = models.filter((model) => {

  const matchesType =
    filter === "all" || model.modelType.toLowerCase() === filter.toLowerCase();


  const matchesSearch = model.modelName
    .toLowerCase()
    .includes(searchTerm.toLowerCase());

  return matchesType && matchesSearch;
});


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-4">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold">Select Model</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <RadioGroup
            value={filter}
            onValueChange={setFilter}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all">All</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="free" id="free" />
              <Label htmlFor="free">Free Model</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="paid" id="paid" />
              <Label htmlFor="paid">Paid Model</Label>
            </div>
          </RadioGroup>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search models"
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <ScrollArea className="h-64">
            <div className="space-y-2 pr-4">
              {isLoading ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                filteredModels.length > 0 ? filteredModels.map((model, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer"
                    onClick={() => onModelSelect(model)}
                  >
                    <div className="flex items-center gap-3">
                      <img src={getIconForCompany(model.companyName)} alt={`${model.companyName} logo`} className="h-5 w-5" />
                      <span className="text-sm">{model.modelName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                        <Info className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                        <Bookmark className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )) : <div className="text-center text-sm text-muted-foreground py-10">No models found.</div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
