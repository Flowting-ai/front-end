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
import { ChevronDown, MessageSquare, CircleCheckBig, ChevronRight } from "lucide-react";
import Image from "next/image";
import type { AIModel } from "@/types/ai-model";
import type { PinType } from "@/components/layout/right-sidebar";
import { getModelIcon } from "@/lib/model-icons";
import { MODELS_ENDPOINT } from "@/lib/config";
import { normalizeModels } from "@/lib/ai-models";

interface ModelSwitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentModel: AIModel | null;
  pendingModel?: AIModel | null;
  onModelSwitch: (config: ModelSwitchConfig) => void;
  onFrameworkSelect?: () => void;
  chatBoards?: Array<{ id: string; name: string }>;
  pins?: PinType[];
}

export interface ModelSwitchConfig {
  model: AIModel;
  chatMemory: number;
  includePins: string[]; // Array of pin IDs
  includeFiles: boolean;
}

export function ModelSwitchDialog({
  open,
  onOpenChange,
  currentModel,
  pendingModel,
  onModelSwitch,
  onFrameworkSelect,
  chatBoards = [],
  pins = [],
}: ModelSwitchDialogProps) {
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(
    currentModel
  );
  const [showFree, setShowFree] = useState(true);
  const [showPaid, setShowPaid] = useState(true);
  const [chatMemory, setChatMemory] = useState(50);
  const [selectedPinIds, setSelectedPinIds] = useState<string[]>([]);
  const [expandedChatIds, setExpandedChatIds] = useState<string[]>([]);
  const [includeFiles, setIncludeFiles] = useState(true);
  // Toggle state for the Flowting AI Framework quick-select button
  const [frameworkSelected, setFrameworkSelected] = useState<boolean>(true);

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
        const data = await response.json();
        const raw = normalizeModels(data);
        setModels(raw);
        sessionStorage.setItem("aiModels", JSON.stringify(raw));
      } catch (error) {
        console.error("Error fetching models:", error);
        setModels([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModels();
  }, [open]);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      const modelToSelect = pendingModel || currentModel;
      setSelectedModel(modelToSelect);
      // If no model is selected, default to framework
      setFrameworkSelected(!modelToSelect);
      setChatMemory(50);
      setSelectedPinIds([]);
      setExpandedChatIds([]);
      setIncludeFiles(false);
    }
  }, [open, currentModel, pendingModel]);

  const filteredModels = models.filter((model) => {
    if (!showFree && model.modelType === "free") return false;
    if (!showPaid && model.modelType === "paid") return false;
    return true;
  });

  const handleSelect = () => {
    if (frameworkSelected && onFrameworkSelect) {
      onFrameworkSelect();
      onOpenChange(false);
      return;
    }

    if (!selectedModel) return;

    onModelSwitch({
      model: selectedModel,
      chatMemory,
      includePins: selectedPinIds,
      includeFiles,
    });

    onOpenChange(false);
  };

  // Group pins by chat
  const pinsByChat = pins.reduce((acc, pin) => {
    const chatId = pin.chatId || pin.sourceChatId || 'unknown';
    if (!acc[chatId]) {
      acc[chatId] = [];
    }
    acc[chatId].push(pin);
    return acc;
  }, {} as Record<string, PinType[]>);

  // Filter to only show chats with pins
  const chatsWithPins = chatBoards.filter(chat => pinsByChat[chat.id]?.length > 0);

  const handleToggleChat = (chatId: string) => {
    setExpandedChatIds(prev => 
      prev.includes(chatId) 
        ? prev.filter(id => id !== chatId)
        : [...prev, chatId]
    );
  };

  const handleTogglePin = (pinId: string) => {
    setSelectedPinIds(prev =>
      prev.includes(pinId)
        ? prev.filter(id => id !== pinId)
        : [...prev, pinId]
    );
  };

  const handleToggleAllPinsInChat = (chatId: string) => {
    const chatPins = pinsByChat[chatId] || [];
    const chatPinIds = chatPins.map(p => p.id);
    const allSelected = chatPinIds.every(id => selectedPinIds.includes(id));
    
    if (allSelected) {
      // Deselect all pins in this chat
      setSelectedPinIds(prev => prev.filter(id => !chatPinIds.includes(id)));
    } else {
      // Select all pins in this chat
      setSelectedPinIds(prev => [...new Set([...prev, ...chatPinIds])]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-white px-3 py-2"
        style={{
          width: "501px",
          maxWidth: "501px",
          height: "auto",
          maxHeight: "500px",
          borderRadius: "12px",
          border: "1px solid #e6e6e6",
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-clash font-[400] text-[24px] text-tb-dialog-text">
            Switch Model
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Flowting AI Framework (quick select) */}
          <div className="w-full">
            <div className="font-inter w-full h-[116px] flex px-0">
              <button
                className={`relative cursor-pointer w-full bg-white hover:bg-[#F5F5F5] rounded-[7px] flex transition-all duration-300 h-[116px] items-start border ${
                  frameworkSelected ? "border-[#0A0A0A]" : "border-[#E6E6E6]"
                }`}
                onClick={() => {
                  setFrameworkSelected((s) => !s);
                  if (!frameworkSelected) {
                    setSelectedModel(null);
                  }
                }}
                aria-pressed={frameworkSelected}
              >
                <div className="p-3">
                  <Image
                    src="/icons/logo.png"
                    width={30}
                    height={30}
                    alt="flowting ai logo"
                    className="w-[30px] h-[30px] object-contain"
                  />
                </div>
                <div className="w-full flex flex-col pl-1 pr-3 py-3">
                  <div className="flex items-center mb-1">
                    <div className="font-[600] text-[16px] flex items-center gap-2">
                      Flowting AI Framework
                      <span className="font-geist font-[500] text-center text-[12px] text-[#FAFAFA] bg-[#171717] rounded-[7px] flex items-center justify-center px-3 py-0.5">
                        {frameworkSelected ? "Default" : "Recommended"}
                      </span>
                    </div>

                    {frameworkSelected && (
                      <CircleCheckBig className="absolute top-3 right-3 w-[20px] h-[20px] text-[#0A0A0A]" />
                    )}
                  </div>
                  <p className="font-geist font-[400] text-[14px] text-left">
                    A smart blend of AI models for high-quality results.
                    Flowting picks the right model for your task and adapts as
                    you work, keeping your context intact and you in control.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Model Dropdown + Free/Paid checkboxes (compact row) */}
          <div className="flex items-center justify-between gap-3 h-[36px]">
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[351px] h-[36px] justify-between px-3 rounded-lg border-[#d4d4d4] hover:bg-[#f5f5f5]"
                  >
                    {selectedModel ? (
                      <div className="flex items-center gap-2">
                        <Image
                          src={getModelIcon(
                            selectedModel.companyName,
                            selectedModel.modelName,
                            selectedModel.sdkLibrary
                          )}
                          alt=""
                          width={20}
                          height={20}
                          className="model-logo"
                        />
                        <span className="text-[#171717] text-sm">
                          {selectedModel.modelName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[#8a8a8a] text-sm">
                        Select a model
                      </span>
                    )}
                    <ChevronDown className="h-4 w-4 text-[#8a8a8a]" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[300px] border border-[#e6e6e6] bg-white p-2"
                >
                  <ScrollArea className="max-h-[300px]">
                    {isLoading ? (
                      <div className="py-8 text-center text-[#8a8a8a] text-sm">
                        Loading models...
                      </div>
                    ) : filteredModels.length === 0 ? (
                      <div className="py-8 text-center text-[#8a8a8a] text-sm">
                        No models available
                      </div>
                    ) : (
                      filteredModels.map((model) => (
                        <DropdownMenuItem
                          key={`${model.companyName}-${model.modelName}`}
                          onClick={() => {
                            setSelectedModel(model);
                            setFrameworkSelected(false);
                          }}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md hover:bg-[#f5f5f5]"
                        >
                          <Image
                            src={getModelIcon(
                              model.companyName,
                              model.modelName,
                              model.sdkLibrary
                            )}
                            alt=""
                            width={20}
                            height={20}
                            className="model-logo"
                          />
                          <div className="flex-1">
                            <div className="text-[#171717] text-sm font-medium">
                              {model.modelName}
                            </div>
                            <div className="text-[#8a8a8a] text-xs">
                              {model.companyName}
                            </div>
                          </div>
                          {model.modelType === "paid" && (
                            <span className="text-xs text-[#8a8a8a] bg-[#f5f5f5] px-2 py-0.5 rounded">
                              Paid
                            </span>
                          )}
                        </DropdownMenuItem>
                      ))
                    )}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="free"
                    checked={showFree}
                    onCheckedChange={(checked) =>
                      setShowFree(checked as boolean)
                    }
                    className="h-4 w-4 rounded-[5px] border-[#d4d4d4]"
                  />
                  <Label
                    htmlFor="free"
                    className="text-sm text-[#171717] cursor-pointer"
                  >
                    Free
                  </Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="paid"
                    checked={showPaid}
                    onCheckedChange={(checked) =>
                      setShowPaid(checked as boolean)
                    }
                    className="h-4 w-4 rounded-[5px] border-[#d4d4d4]"
                  />
                  <Label
                    htmlFor="paid"
                    className="text-sm text-[#171717] cursor-pointer"
                  >
                    Paid
                  </Label>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Memory (split layout) */}
          <div className="w-full h-[77px] flex items-center gap-4">
            <div className="w-1/2">
              <div className="font-geist font-[500] text-[14px] text-[#171717]">
                Chat Memory
              </div>
              <div className="font-geist font-[400] text-balance text-[10px] text-[#8a8a8a] mt-1">
                Select how many messages from the last chat to include as
                context.
              </div>
            </div>
            <div className="w-1/2 flex flex-col justify-center">
              <div className="flex justify-end items-center mb-2 text-sm text-[#8a8a8a]">
                {chatMemory}%
              </div>
              <Slider
                value={[chatMemory]}
                onValueChange={(value) => setChatMemory(value[0])}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[#8a8a8a] mt-1">
                <span>0</span>
                <span>100</span>
              </div>
            </div>
          </div>

          {/* Include Pins (split row) */}
          <div className="w-full flex items-center justify-between gap-4">
            <div className="w-1/2">
              <div className="font-geist font-[500] text-[14px] text-[#171717]">
                Include Pins
              </div>
              <div className="font-geist font-[400] text-balance text-[10px] text-[#8a8a8a] mt-1">
                Keep your pinned messages accessible for model context.
              </div>
            </div>
            <div className="w-1/2 flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[240px] h-[36px] justify-between px-3 rounded-lg border-[#d4d4d4] hover:bg-[#f5f5f5]"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-[#8a8a8a]" />
                      <span className="text-[#171717] text-sm">
                        {selectedPinIds.length === 0
                          ? "Filter by pins"
                          : `${selectedPinIds.length} pin${
                              selectedPinIds.length === 1 ? "" : "s"
                            } selected`}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-[#8a8a8a]" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  side="right"
                  className="w-[300px] border border-[#e6e6e6] bg-white p-2 overflow-x-hidden"
                >
                  <ScrollArea className="max-h-[300px]">
                    {chatsWithPins.length === 0 ? (
                      <div className="py-4 text-center text-[#8a8a8a] text-sm">
                        No pins available
                      </div>
                    ) : (
                      chatsWithPins.map((chat) => {
                        const chatPins = pinsByChat[chat.id] || [];
                        const isExpanded = expandedChatIds.includes(chat.id);
                        const chatPinIds = chatPins.map(p => p.id);
                        const allPinsSelected = chatPinIds.length > 0 && chatPinIds.every(id => selectedPinIds.includes(id));
                        const somePinsSelected = chatPinIds.some(id => selectedPinIds.includes(id)) && !allPinsSelected;
                        const displayName = chat.name.length > 25 ? `${chat.name.slice(0, 25)}...` : chat.name;
                        
                        return (
                          <div key={chat.id} className="mb-1">
                            {/* Chat Header */}
                            <div className="flex items-center gap-2 px-3 py-2 hover:bg-[#f5f5f5] rounded-md">
                              <button
                                onClick={() => handleToggleChat(chat.id)}
                                className="flex items-center gap-1.5 flex-1 text-left min-w-0 overflow-hidden"
                              >
                                <ChevronRight 
                                  className={`h-3.5 w-3.5 shrink-0 text-[#8a8a8a] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                />
                                <span className="text-sm text-[#171717] font-medium">
                                  {displayName}
                                </span>
                              </button>
                              <span className="shrink-0 flex items-center justify-center min-w-[20px] h-[20px] text-[10px] font-medium text-white bg-[#8a8a8a] rounded-full px-1.5">
                                {chatPins.length}
                              </span>
                              <Checkbox
                                checked={allPinsSelected}
                                onCheckedChange={() => handleToggleAllPinsInChat(chat.id)}
                                className={`h-4 w-4 shrink-0 rounded border-[#d4d4d4] ${somePinsSelected ? 'data-[state=checked]:bg-[#8a8a8a]' : ''}`}
                              />
                            </div>
                            
                            {/* Nested Pins */}
                            {isExpanded && (
                              <div className="ml-6 space-y-1">
                                {chatPins.map((pin) => (
                                  <div
                                    key={pin.id}
                                    className="flex items-start gap-2 px-3 py-2 hover:bg-[#f5f5f5] rounded-md cursor-pointer"
                                    onClick={() => handleTogglePin(pin.id)}
                                  >
                                    <Checkbox
                                      checked={selectedPinIds.includes(pin.id)}
                                      onCheckedChange={() => handleTogglePin(pin.id)}
                                      className="h-4 w-4 rounded border-[#d4d4d4] mt-0.5 shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-[#171717] line-clamp-2">
                                        {pin.text || pin.title || pin.formattedContent || 'Untitled pin'}
                                      </p>
                                      {pin.tags && pin.tags.length > 0 && (
                                        <div className="flex gap-1 mt-1 flex-wrap">
                                          {pin.tags.slice(0, 2).map((tag, idx) => (
                                            <span
                                              key={idx}
                                              className="text-xs text-[#8a8a8a] bg-[#f5f5f5] px-1.5 py-0.5 rounded"
                                            >
                                              {tag}
                                            </span>
                                          ))}
                                          {pin.tags.length > 2 && (
                                            <span className="text-xs text-[#8a8a8a]">
                                              +{pin.tags.length - 2}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>   
        </div>

        {/* <Separator className="text-main-border py-0 my-0"/> */}

        <DialogFooter className="max-h-[40px] h-[40px] border-t border-main-border flex items-center justify-between gap-2 pt-1">
          {/* Include Files Toggle */}
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="font-geist font-[500] text-[14px] text-[#171717]">
                Include Files
              </div>
              <Switch
                id="include-files"
                checked={includeFiles}
                onCheckedChange={setIncludeFiles}
                className="cursor-pointer"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="cursor-pointer h-[32px] rounded-[10px] px-4 text-[#171717] hover:bg-[#f5f5f5]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSelect}
              disabled={!frameworkSelected && !selectedModel}
              className="cursor-pointer h-[32px] rounded-[10px] px-4 bg-[#171717] text-white hover:bg-[#171717] disabled:bg-[#d4d4d4] disabled:text-[#8a8a8a]"
            >
              <p>Select</p>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
