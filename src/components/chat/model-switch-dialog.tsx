"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import type { AIModel } from "@/types/ai-model";
import { getModelIcon } from "@/lib/model-icons";
import { MODELS_ENDPOINT } from "@/lib/config";

interface ModelSwitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentModel: AIModel | null;
  onModelSwitch: (config: ModelSwitchConfig) => void;
  chatBoards?: Array<{ id: string; name: string }>;
}

export interface ModelSwitchConfig {
  model: AIModel;
  chatMemory: number;
  includePins: string[]; // Array of chat IDs
  includeFiles: boolean;
}

export function ModelSwitchDialog({
  open,
  onOpenChange,
  currentModel,
  onModelSwitch,
  chatBoards = [],
}: ModelSwitchDialogProps) {
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(currentModel);
  const [showFree, setShowFree] = useState(true);
  const [showPaid, setShowPaid] = useState(true);
  const [chatMemory, setChatMemory] = useState(50);
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [includeFiles, setIncludeFiles] = useState(false);

  useEffect(() => {
    if (!open) return;

    const cached = sessionStorage.getItem("aiModels");
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as AIModel[];
        setModels(parsed);
        setIsLoading(false);
        return;
      } catch {
        // ignore
      }
    }

    const fetchModels = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(MODELS_ENDPOINT, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status}`);
        }
        const raw: AIModel[] = await response.json();

        // Add dummy models for testing
        const dummyModels: AIModel[] = [
          {
            companyName: "OpenAI",
            modelName: "GPT-4",
            version: "turbo",
            modelType: "paid",
            inputLimit: 128000,
            outputLimit: 4096,
          },
          {
            companyName: "Anthropic",
            modelName: "Claude 3.5 Sonnet",
            version: "latest",
            modelType: "paid",
            inputLimit: 200000,
            outputLimit: 8192,
          },
          {
            companyName: "Google",
            modelName: "Gemini Pro",
            version: "1.5",
            modelType: "free",
            inputLimit: 32000,
            outputLimit: 8192,
          },
          {
            companyName: "Meta",
            modelName: "Llama 3.1 70B",
            version: "instruct",
            modelType: "free",
            inputLimit: 128000,
            outputLimit: 4096,
          },
          {
            companyName: "Mistral AI",
            modelName: "Mistral Large",
            version: "2",
            modelType: "paid",
            inputLimit: 128000,
            outputLimit: 8192,
          },
          {
            companyName: "Cohere",
            modelName: "Command R+",
            version: "latest",
            modelType: "paid",
            inputLimit: 128000,
            outputLimit: 4096,
          },
          {
            companyName: "OpenAI",
            modelName: "GPT-3.5 Turbo",
            version: "latest",
            modelType: "free",
            inputLimit: 16385,
            outputLimit: 4096,
          },
          {
            companyName: "Google",
            modelName: "PaLM 2",
            version: "chat-bison",
            modelType: "free",
            inputLimit: 8192,
            outputLimit: 2048,
          },
          {
            companyName: "Anthropic",
            modelName: "Claude 3 Haiku",
            version: "latest",
            modelType: "paid",
            inputLimit: 200000,
            outputLimit: 4096,
          },
        ];

        const allModels = [...raw, ...dummyModels];
        setModels(allModels);
        sessionStorage.setItem("aiModels", JSON.stringify(allModels));
      } catch (error) {
        console.error("Error fetching models:", error);
        // Use dummy models as fallback
        const fallbackModels: AIModel[] = [
          {
            companyName: "OpenAI",
            modelName: "GPT-4",
            version: "turbo",
            modelType: "paid",
            inputLimit: 128000,
            outputLimit: 4096,
          },
          {
            companyName: "Anthropic",
            modelName: "Claude 3.5 Sonnet",
            version: "latest",
            modelType: "paid",
            inputLimit: 200000,
            outputLimit: 8192,
          },
          {
            companyName: "Google",
            modelName: "Gemini Pro",
            version: "1.5",
            modelType: "free",
            inputLimit: 32000,
            outputLimit: 8192,
          },
          {
            companyName: "Meta",
            modelName: "Llama 3.1 70B",
            version: "instruct",
            modelType: "free",
            inputLimit: 128000,
            outputLimit: 4096,
          },
        ];
        setModels(fallbackModels);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModels();
  }, [open]);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedModel(currentModel);
      setChatMemory(50);
      setSelectedChats([]);
      setIncludeFiles(false);
    }
  }, [open, currentModel]);

  const filteredModels = models.filter((model) => {
    if (!showFree && model.modelType === "free") return false;
    if (!showPaid && model.modelType === "paid") return false;
    return true;
  });

  const handleSelect = () => {
    if (!selectedModel) return;
    
    onModelSwitch({
      model: selectedModel,
      chatMemory,
      includePins: selectedChats,
      includeFiles,
    });
    
    onOpenChange(false);
  };

  const handleToggleChat = (chatId: string) => {
    setSelectedChats((prev) =>
      prev.includes(chatId)
        ? prev.filter((id) => id !== chatId)
        : [...prev, chatId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white p-6" style={{ width: "min(500px, 95vw)", maxWidth: "500px", borderRadius: "12px", border: "1px solid #e6e6e6" }}>
        <DialogHeader>
          <DialogTitle className="text-[#171717] text-lg font-semibold">Switch Model</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Model Selection Dropdown with Free/Paid Checkboxes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-10 px-3 rounded-lg border-[#d4d4d4] hover:bg-[#f5f5f5]"
                  >
                    {selectedModel ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={getModelIcon(selectedModel.companyName)}
                          alt=""
                          className="model-logo"
                        />
                        <span className="text-[#171717] text-sm">
                          {selectedModel.modelName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[#8a8a8a] text-sm">Select a model</span>
                    )}
                    <ChevronDown className="h-4 w-4 text-[#8a8a8a]" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[300px] border border-[#e6e6e6] bg-white p-2">
                  <ScrollArea className="max-h-[300px]">
                    {isLoading ? (
                      <div className="py-8 text-center text-[#8a8a8a] text-sm">Loading models...</div>
                    ) : filteredModels.length === 0 ? (
                      <div className="py-8 text-center text-[#8a8a8a] text-sm">No models available</div>
                    ) : (
                      filteredModels.map((model) => (
                        <DropdownMenuItem
                          key={`${model.companyName}-${model.modelName}`}
                          onClick={() => setSelectedModel(model)}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md hover:bg-[#f5f5f5]"
                        >
                          <img
                            src={getModelIcon(model.companyName)}
                            alt=""
                            className="model-logo"
                          />
                          <div className="flex-1">
                            <div className="text-[#171717] text-sm font-medium">{model.modelName}</div>
                            <div className="text-[#8a8a8a] text-xs">{model.companyName}</div>
                          </div>
                          {model.modelType === "paid" && (
                            <span className="text-xs text-[#8a8a8a] bg-[#f5f5f5] px-2 py-0.5 rounded">Paid</span>
                          )}
                        </DropdownMenuItem>
                      ))
                    )}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="free"
                    checked={showFree}
                    onCheckedChange={(checked) => setShowFree(checked as boolean)}
                    className="h-4 w-4 rounded border-[#d4d4d4]"
                  />
                  <Label htmlFor="free" className="text-sm text-[#171717] cursor-pointer">
                    Free
                  </Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="paid"
                    checked={showPaid}
                    onCheckedChange={(checked) => setShowPaid(checked as boolean)}
                    className="h-4 w-4 rounded border-[#d4d4d4]"
                  />
                  <Label htmlFor="paid" className="text-sm text-[#171717] cursor-pointer">
                    Paid
                  </Label>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Memory Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-[#171717]">Chat Memory</Label>
              <span className="text-sm text-[#8a8a8a]">{chatMemory}%</span>
            </div>
            <Slider
              value={[chatMemory]}
              onValueChange={(value) => setChatMemory(value[0])}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          {/* Include Pins - Filter by Chats Dropdown */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-[#171717]">Include Pins</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between h-10 px-3 rounded-lg border-[#d4d4d4] hover:bg-[#f5f5f5]"
                >
                  <span className="text-[#171717] text-sm">
                    {selectedChats.length === 0
                      ? "Filter by chats"
                      : `${selectedChats.length} chat${selectedChats.length === 1 ? "" : "s"} selected`}
                  </span>
                  <ChevronDown className="h-4 w-4 text-[#8a8a8a]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[300px] border border-[#e6e6e6] bg-white p-2">
                <ScrollArea className="max-h-[200px]">
                  {chatBoards.length === 0 ? (
                    <div className="py-4 text-center text-[#8a8a8a] text-sm">No chats available</div>
                  ) : (
                    chatBoards.map((chat) => (
                      <div
                        key={chat.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-[#f5f5f5] rounded-md cursor-pointer"
                        onClick={() => handleToggleChat(chat.id)}
                      >
                        <Checkbox
                          checked={selectedChats.includes(chat.id)}
                          onCheckedChange={() => handleToggleChat(chat.id)}
                          className="h-4 w-4 rounded border-[#d4d4d4]"
                        />
                        <span className="text-sm text-[#171717]">{chat.name}</span>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Separator className="bg-[#e6e6e6]" />

          {/* Include Files Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="include-files" className="text-sm font-medium text-[#171717]">
              Include Files
            </Label>
            <Switch
              id="include-files"
              checked={includeFiles}
              onCheckedChange={setIncludeFiles}
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-lg px-4 text-[#171717] hover:bg-[#f5f5f5]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSelect}
            disabled={!selectedModel}
            className="rounded-lg px-4 bg-[#2c2c2c] text-white hover:bg-[#1f1f1f] disabled:bg-[#d4d4d4] disabled:text-[#8a8a8a]"
          >
            Select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
