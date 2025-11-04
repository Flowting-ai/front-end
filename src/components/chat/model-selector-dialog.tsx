
"use client";

import { useState } from "react";
import type { Model } from "./model-selector";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Search, Info, Bookmark } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";

const models: Model[] = [
  { name: "OpenAI: Gpt 5", type: "paid", icon: "/openai.svg" },
  { name: "Claude-color 1", type: "free", icon: "/claude.svg" },
  { name: "Claude-color 2", type: "free", icon: "/claude.svg" },
  { name: "Claude-color 3", type: "free", icon: "/claude.svg" },
  { name: "Claude-color 4", type: "free", icon: "/claude.svg" },
  { name: "Claude-color 5", type: "free", icon: "/claude.svg" },
  { name: "Gemini Pro", type: "paid", icon: "/gemini.svg" },
  { name: "Gemini 2.5 Flash", type: "paid", icon: "/gemini.svg" },
  { name: "Mistral", type: "free", icon: "/mistral.svg" },
];

interface ModelSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModelSelect: (model: Model) => void;
}

export function ModelSelectorDialog({ open, onOpenChange, onModelSelect }: ModelSelectorDialogProps) {
  const [filter, setFilter] = useState("free");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredModels = models.filter(
    (model) =>
      (filter === "all" || model.type === filter) &&
      model.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              {filteredModels.map((model, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer"
                  onClick={() => onModelSelect(model)}
                >
                  <div className="flex items-center gap-3">
                    <img src={model.icon} alt={`${model.name} logo`} className="h-5 w-5" />
                    <span className="text-sm">{model.name}</span>
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
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
