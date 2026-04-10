"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronUp,
  MessageSquare,
  CircleCheckBig,
  ChevronRight,
  Loader2,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Image from "next/image";
import type { AIModel } from "@/types/ai-model";
import type { UserPlanType } from "@/lib/api/user";
import { canAccessFramework } from "@/lib/plan-config";
import type { PinType } from "@/components/layout/right-sidebar";
import { getModelIcon } from "@/lib/model-icons";
import { CHAT_MESSAGES_ENDPOINT } from "@/lib/config";
import { fetchModelsWithCache } from "@/lib/ai-models";
import { renderInlineMarkdown, formatPinTitle } from "@/lib/markdown-utils";
import { toast } from "@/lib/toast-helper";
import { apiFetch } from "@/lib/api/client";
import chatStyles from "@/components/chat/chat-interface.module.css";

interface ModelSwitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentModel: AIModel | null;
  pendingModel?: AIModel | null;
  onModelSwitch: (config: ModelSwitchConfig) => void;
  onFrameworkSelect?: (type: "starter" | "pro") => void;
  chatBoards?: Array<{ id: string; name: string }>;
  pins?: PinType[];
  /** The active chat ID, used to fetch real message count for smart memory default */
  activeChatId?: string | null;
  /** Pre-loaded message count (if already known by parent, avoids extra fetch) */
  knownMessageCount?: number;
  frameworkType?: "starter" | "pro";
  userPlanType?: UserPlanType | null;
}

export interface ModelSwitchConfig {
  model: AIModel | null;
  algorithm: 'base' | 'pro' | null; // 'base' for Basic Framework, 'pro' for Advanced Framework, null for specific model
  memoryPercentage: number; // float 0.0–1.0
  chatMemory: number;       // percentage 0–100
  chatMemoryMessages: number; // actual number of messages to include
  totalMessages: number;    // total messages in chat (for backend context)
  includePins: string[];    // Array of pin IDs
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
  activeChatId,
  knownMessageCount,
  frameworkType = "starter",
  userPlanType,
}: ModelSwitchDialogProps) {
  const DEFAULT_CHAT_MEMORY = 20;
  const chatMemoryInitialized = useRef(false);

  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(
    pendingModel || currentModel,
  );
  const [showFree, setShowFree] = useState(true);
  const [showPaid, setShowPaid] = useState(true);
  // Total messages fetched from backend for the active chat
  const [totalMessages, setTotalMessages] = useState<number>(0);
  const [isFetchingMessages, setIsFetchingMessages] = useState(false);
  // Chat memory slider value — driven by smart default once message count is known
  const [chatMemory, setChatMemory] = useState(DEFAULT_CHAT_MEMORY);
  const [selectedPinIds, setSelectedPinIds] = useState<string[]>([]);
  const [expandedChatIds, setExpandedChatIds] = useState<string[]>([]);
  const [includeFiles, setIncludeFiles] = useState(true);
  // Auto-routing framework toggles
  // Default to Advanced Framework for Pro/Power, Basic for Starter
  const hasAdvanced = canAccessFramework(userPlanType, "advanced");
  const [starterFrameworkSelected, setStarterFrameworkSelected] =
    useState<boolean>(!hasAdvanced);
  const [proFrameworkSelected, setProFrameworkSelected] =
    useState<boolean>(hasAdvanced);
  // Input/Output modality filters (lowercase for matching)
  // const INPUT_OPTIONS = ["text", "image", "file", "audio", "video"] as const;
  // const OUTPUT_OPTIONS = ["text", "image", "embeddings", "audio"] as const;
  // removed input/output options to just text and image for the model switch dialog
  const INPUT_OPTIONS = ["text", "image"] as const;
  const OUTPUT_OPTIONS = ["text", "image"] as const;
  const [inputFilters, setInputFilters] = useState<Set<string>>(new Set());
  const [outputFilters, setOutputFilters] = useState<Set<string>>(new Set());
  const [inputDropdownOpen, setInputDropdownOpen] = useState(false);
  const [outputDropdownOpen, setOutputDropdownOpen] = useState(false);

  /** Compute smart default % based on how many messages exist in this chat */
  const computeSmartDefault = (count: number): number => {
    if (count === 0) return 0;
    if (count <= 2) return 5;
    if (count <= 5) return 10;
    return DEFAULT_CHAT_MEMORY; // 6+ messages: standard default
  };

  /** How many messages will actually be sent as context at the current slider value */
  const includedMessages = useMemo(
    () => Math.round((chatMemory / 100) * totalMessages),
    [chatMemory, totalMessages],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setIsLoading(true);
    fetchModelsWithCache().then((result) => {
      if (!cancelled) {
        setModels(result);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [open]);

  // Fetch real message count for the active chat to drive the smart default
  useEffect(() => {
    if (!open) {
      chatMemoryInitialized.current = false;
      return;
    }

    // Only initialise chatMemory once per dialog open so the user's
    // slider changes are never overwritten by re-running effects.
    if (chatMemoryInitialized.current) return;
    chatMemoryInitialized.current = true;

    // Use pre-supplied count when parent already knows it
    if (knownMessageCount !== undefined) {
      setTotalMessages(knownMessageCount);
      setChatMemory(computeSmartDefault(knownMessageCount));
      return;
    }

    if (!activeChatId) {
      // No chat context — use the standard default
      setTotalMessages(0);
      setChatMemory(DEFAULT_CHAT_MEMORY);
      return;
    }

    const fetchMessageCount = async () => {
      setIsFetchingMessages(true);
      try {
        const res = await apiFetch(CHAT_MESSAGES_ENDPOINT(activeChatId), { method: "GET" });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        // Backend may return { results: [...] } or a bare array
        const msgs: unknown[] = Array.isArray(data)
          ? data
          : Array.isArray((data as { results?: unknown[] }).results)
          ? (data as { results: unknown[] }).results
          : [];
        const count = msgs.length;
        setTotalMessages(count);
        setChatMemory(computeSmartDefault(count));
      } catch {
        // Fallback: keep default — no disruption to UX
        setTotalMessages(0);
        setChatMemory(DEFAULT_CHAT_MEMORY);
      } finally {
        setIsFetchingMessages(false);
      }
    };

    fetchMessageCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeChatId, knownMessageCount]);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      const modelToSelect = pendingModel || currentModel;
      setSelectedModel(modelToSelect);
      // If a specific model is selected, deselect frameworks
      // Otherwise default to Advanced for Pro/Power, Basic for Starter
      if (modelToSelect) {
        setStarterFrameworkSelected(false);
        setProFrameworkSelected(false);
      } else {
        setStarterFrameworkSelected(!hasAdvanced);
        setProFrameworkSelected(hasAdvanced);
      }
      // chatMemory & totalMessages are reset by the fetch effect above
      setSelectedPinIds([]);
      setExpandedChatIds([]);
      setIncludeFiles(false);
      setInputFilters(new Set());
      setOutputFilters(new Set());
    }
  }, [open, currentModel, pendingModel, hasAdvanced]);

  const filteredModels = models.filter((model) => {
    if (!showFree && model.modelType === "free") return false;
    if (!showPaid && model.modelType === "paid") return false;

    // Filter by input modalities (if any selected)
    if (inputFilters.size > 0) {
      const inputMods = (model.inputModalities || []).map((m) =>
        m.toLowerCase()
      );
      const hasMatch = [...inputFilters].some((f) => inputMods.includes(f));
      if (!hasMatch) return false;
    }

    // Filter by output modalities (if any selected)
    if (outputFilters.size > 0) {
      const outputMods = (model.outputModalities || []).map((m) =>
        m.toLowerCase()
      );
      const hasMatch = [...outputFilters].some((f) => outputMods.includes(f));
      if (!hasMatch) return false;
    }

    return true;
  });

  const handleSelect = () => {
    if ((starterFrameworkSelected || proFrameworkSelected) && onFrameworkSelect) {
      const algo = starterFrameworkSelected ? "base" : "pro";
      onFrameworkSelect(starterFrameworkSelected ? "starter" : "pro");
      onModelSwitch({
        model: null,
        algorithm: algo,
        memoryPercentage: chatMemory / 100,
        chatMemory,
        chatMemoryMessages: includedMessages,
        totalMessages,
        includePins: selectedPinIds,
        includeFiles,
      });
      onOpenChange(false);
      return;
    }

    if (!selectedModel) return;

    onModelSwitch({
      model: selectedModel,
      algorithm: null,
      memoryPercentage: chatMemory / 100,
      chatMemory,
      chatMemoryMessages: includedMessages,
      totalMessages,
      includePins: selectedPinIds,
      includeFiles,
    });

    onOpenChange(false);
  };

  // Group pins by chat
  const pinsByChat = pins.reduce(
    (acc, pin) => {
      const chatId = pin.chatId || pin.sourceChatId || "unknown";
      if (!acc[chatId]) {
        acc[chatId] = [];
      }
      acc[chatId].push(pin);
      return acc;
    },
    {} as Record<string, PinType[]>,
  );

  // Filter to only show chats with pins
  const chatsWithPins = chatBoards.filter(
    (chat) => pinsByChat[chat.id]?.length > 0,
  );

  const handleToggleChat = (chatId: string) => {
    setExpandedChatIds((prev) =>
      prev.includes(chatId)
        ? prev.filter((id) => id !== chatId)
        : [...prev, chatId],
    );
  };

  const handleTogglePin = (pinId: string) => {
    setSelectedPinIds((prev) =>
      prev.includes(pinId)
        ? prev.filter((id) => id !== pinId)
        : [...prev, pinId],
    );
  };

  const handleToggleAllPinsInChat = (chatId: string) => {
    const chatPins = pinsByChat[chatId] || [];
    const chatPinIds = chatPins.map((p) => p.id);
    const allSelected = chatPinIds.every((id) => selectedPinIds.includes(id));

    if (allSelected) {
      // Deselect all pins in this chat
      setSelectedPinIds((prev) =>
        prev.filter((id) => !chatPinIds.includes(id)),
      );
    } else {
      // Select all pins in this chat
      setSelectedPinIds((prev) => [...new Set([...prev, ...chatPinIds])]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-white px-3 py-2"
        style={{
          width: "521px",
          maxWidth: "521px",
          height: "auto",
          maxHeight: "500px",
          borderRadius: "12px",
          border: "1px solid #e6e6e6",
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-clash font-normal text-[24px] text-tb-dialog-text">
            Switch Model
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Auto Routing */}
          <div className="w-full">
            <div className="mb-2">
              <h3 className="font-geist text-sm text-[#737373]">Auto Routing</h3>
            </div>
            <div className="space-y-1">
              <div
                role="button"
                tabIndex={0}
                className={`cursor-pointer w-full rounded-[8px] flex transition-all duration-300 h-[36px] items-center border px-2 ${
                  starterFrameworkSelected
                    ? "border-[#0A0A0A] bg-[#F5F5F5]"
                    : "border-transparent hover:bg-[#F5F5F5]"
                }`}
                onClick={() => {
                  setStarterFrameworkSelected((prev) => {
                    const next = !prev;
                    if (next) setProFrameworkSelected(false);
                    return next;
                  });
                  setSelectedModel(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setStarterFrameworkSelected((prev) => {
                      const next = !prev;
                      if (next) setProFrameworkSelected(false);
                      return next;
                    });
                    setSelectedModel(null);
                  }
                }}
                aria-pressed={starterFrameworkSelected}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Image
                    src="/new-logos/souvenir-logo.svg"
                    width={20}
                    height={20}
                    alt="souvenir ai logo"
                    className="w-5 h-5 object-contain"
                  />
                  <span className="font-geist text-sm text-[#171717] truncate">
                    SouvenirAI: Basic Framework
                  </span>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Starter framework information"
                      >
                        <Info className="h-3.5 w-3.5 text-[#666666]" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[280px] text-xs leading-5">
                      Cost-optimized routing for daily tasks. Starter
                      prioritizes speed and efficiency while keeping reliable
                      quality for common prompts.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {(() => {
                const advancedLocked = !canAccessFramework(userPlanType, "advanced");
                return (
              <div
                role="button"
                tabIndex={0}
                className={`cursor-pointer w-full rounded-[8px] flex transition-all duration-300 h-[36px] items-center border px-2 ${
                  !advancedLocked && proFrameworkSelected
                    ? "border-[#0A0A0A] bg-[#F5F5F5]"
                    : "border-transparent hover:bg-[#F5F5F5]"
                }`}
                style={{ opacity: advancedLocked ? 0.45 : 1 }}
                onClick={() => {
                  if (advancedLocked) {
                    toast.info("Upgrade to Pro or Power", {
                      description: "Advanced Framework is available on Pro and Power plans.",
                    });
                    return;
                  }
                  setProFrameworkSelected((prev) => {
                    const next = !prev;
                    if (next) setStarterFrameworkSelected(false);
                    return next;
                  });
                  setSelectedModel(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (advancedLocked) {
                      toast.info("Upgrade to Pro or Power", {
                        description: "Advanced Framework is available on Pro and Power plans.",
                      });
                      return;
                    }
                    setProFrameworkSelected((prev) => {
                      const next = !prev;
                      if (next) setStarterFrameworkSelected(false);
                      return next;
                    });
                    setSelectedModel(null);
                  }
                }}
                aria-pressed={!advancedLocked && proFrameworkSelected}
                aria-disabled={advancedLocked}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Image
                    src="/new-logos/souvenirAdvancedFramework.svg"
                    width={30}
                    height={30}
                    alt="souvenir ai logo"
                    className="w-5 h-5 object-contain"
                    style={{ opacity: advancedLocked ? 0.45 : 1 }}
                  />
                  <span className="font-geist text-sm text-[#171717] truncate" style={{ opacity: advancedLocked ? 0.7 : 1 }}>
                    SouvenirAI: Advanced Framework
                  </span>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Pro framework information"
                      >
                        <Info className="h-3.5 w-3.5 text-[#666666]" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[280px] text-xs leading-5">
                      {advancedLocked
                        ? "Upgrade to Pro or Power to unlock Advanced Framework \u2014 quality-first routing for complex work."
                        : "Quality-first routing for complex work. Pro chooses stronger models more aggressively for deeper reasoning and richer outputs."}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
                );
              })()}
            </div>
          </div>

          <div className="w-full">
            <h3 className="font-geist text-sm text-[#737373]">Models</h3>
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
                            selectedModel.sdkLibrary,
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
                    className={`w-full min-w-[351px] border border-[#e6e6e6] p-2 pr-0 overflow-hidden`}
                  >
                    <ScrollArea className={`max-h-[310px] overflow-y-auto pr-2 ${chatStyles.customScrollbar}`}>
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
                            key={String(model.modelId ?? model.id ?? `${model.companyName}-${model.modelName}`)}
                            onClick={() => {
                              setSelectedModel(model);
                              setStarterFrameworkSelected(false);
                              setProFrameworkSelected(false);
                            }}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md hover:bg-[#f5f5f5]"
                          >
                            <Image
                              src={getModelIcon(
                                model.companyName,
                                model.modelName,
                                model.sdkLibrary,
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
                            {/* commenting paid label on paid models in modelSelector */}
                            {/* {model.modelType === "paid" && (
                              <span className="text-xs text-[#8a8a8a] bg-[#f5f5f5] px-2 py-0.5 rounded">
                                Paid
                              </span>
                            )} */}
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
                  {/* changing free to base and now to starter- modelSelector*/}
                  <Label
                    htmlFor="free"
                    className="text-sm text-[#171717] cursor-pointer"
                  >
                    Starter
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
                  {/* changing paid to plus and now to pro - modelSwitch*/}
                  <Label
                    htmlFor="paid"
                    className="text-sm text-[#171717] cursor-pointer"
                  >
                    Pro
                  </Label>
                </div>
              </div>
            </div>
          </div>

          {/* Input Output Clear */}
          <div className="flex items-center gap-2">
            <DropdownMenu
              open={inputDropdownOpen}
              onOpenChange={setInputDropdownOpen}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`font-medium text-[12px] rounded-[8px] transition-all duration-300 flex items-center gap-1 px-2.5 py-1.5 cursor-pointer ${
                    inputFilters.size > 0
                      ? "text-[#FFFFFF] bg-[#000000]"
                      : "text-[#171717] bg-[#F5F5F5] hover:bg-zinc-300"
                  }`}
                >
                  Input
                  {inputDropdownOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="text-[#0A0A0A] text-sm rounded-[8px] min-w-[8rem]"
                align="start"
              >
                {INPUT_OPTIONS.map((opt) => (
                  <DropdownMenuCheckboxItem
                    key={opt}
                    className="cursor-pointer [&>span]:border [&>span]:border-[#0A0A0A] [&>span]:rounded [&>span]:rounded-xs"
                    checked={inputFilters.has(opt)}
                    onCheckedChange={(checked) => {
                      setInputFilters((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(opt);
                        else next.delete(opt);
                        return next;
                      });
                    }}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu
              open={outputDropdownOpen}
              onOpenChange={setOutputDropdownOpen}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`font-medium text-[12px] rounded-[8px] transition-all duration-300 flex items-center gap-1 px-2.5 py-1.5 cursor-pointer ${
                    outputFilters.size > 0
                      ? "text-[#FFFFFF] bg-[#000000]"
                      : "text-[#171717] bg-[#F5F5F5] hover:bg-zinc-300"
                  }`}
                >
                  Output
                  {outputDropdownOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="text-[#0A0A0A] text-sm rounded-[8px] min-w-[8rem]"
                align="start"
              >
                {OUTPUT_OPTIONS.map((opt) => (
                  <DropdownMenuCheckboxItem
                    key={opt}
                    className="cursor-pointer [&>span]:border [&>span]:border-[#0A0A0A] [&>span]:rounded [&>span]:rounded-xs"
                    checked={outputFilters.has(opt)}
                    onCheckedChange={(checked) => {
                      setOutputFilters((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(opt);
                        else next.delete(opt);
                        return next;
                      });
                    }}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {(inputFilters.size > 0 || outputFilters.size > 0) && (
              <button
                type="button"
                onClick={() => {
                  setInputFilters(new Set());
                  setOutputFilters(new Set());
                }}
                className="font-medium text-[12px] text-[#171717] bg-[#F5F5F5] hover:bg-zinc-300 rounded-[8px] transition-all duration-300 px-2.5 py-1.5 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Chat Memory (split layout) */}
          <div className="w-full h-[77px] flex items-center gap-4">
            <div className="w-1/2">
              <div className="font-geist font-medium text-sm text-[#171717]">
                Chat Memory
              </div>
              <div className="font-geist font-normal text-balance text-[10px] text-[#8a8a8a] mt-1">
                Select how many messages from the last chat to include as
                context.
              </div>
            </div>
            <div className="w-1/2 flex flex-col justify-center">
              <div className="flex justify-end items-center mb-2 gap-2">
                {isFetchingMessages ? (
                  <Loader2 className="h-3 w-3 animate-spin text-[#8a8a8a]" />
                ) : totalMessages > 0 ? (
                  <span className="text-xs text-[#8a8a8a]">
                    ~{includedMessages} of {totalMessages} msgs
                  </span>
                ) : (
                  <span className="text-xs text-[#8a8a8a]">
                    {chatMemory === 0 ? "No context" : "New chat"}
                  </span>
                )}
                <span className="text-sm text-[#8a8a8a]">{chatMemory}%</span>
              </div>
              <Slider
                value={[chatMemory]}
                onValueChange={(value) => setChatMemory(value[0])}
                min={0}
                max={100}
                step={1}
                disabled={isFetchingMessages}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[#8a8a8a] mt-1">
                <span>0</span>
                <span>100</span>
              </div>
            </div>
          </div>

          {/* Include Pins (split row) - commented out for now, might use in future */}
          {/* <div className="w-full flex items-center justify-between gap-4">
            <div className="w-1/2">
              <div className="font-geist font-medium text-sm text-[#171717]">
                Include Pins
              </div>
              <div className="font-geist font-normal text-balance text-[10px] text-[#8a8a8a] mt-1">
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
                        const chatPinIds = chatPins.map((p) => p.id);
                        const allPinsSelected =
                          chatPinIds.length > 0 &&
                          chatPinIds.every((id) => selectedPinIds.includes(id));
                        const somePinsSelected =
                          chatPinIds.some((id) =>
                            selectedPinIds.includes(id),
                          ) && !allPinsSelected;
                        const displayName =
                          chat.name.length > 25
                            ? `${chat.name.slice(0, 25)}...`
                            : chat.name;

                        return (
                          <div key={chat.id} className="mb-1">
                            // Chat Header
                            <div className="flex items-center gap-2 px-3 py-2 hover:bg-[#f5f5f5] rounded-md">
                              <button
                                onClick={() => handleToggleChat(chat.id)}
                                className="flex items-center gap-1.5 flex-1 text-left min-w-0 overflow-hidden"
                              >
                                <ChevronRight
                                  className={`h-3.5 w-3.5 shrink-0 text-[#8a8a8a] transition-transform ${isExpanded ? "rotate-90" : ""}`}
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
                                onCheckedChange={() =>
                                  handleToggleAllPinsInChat(chat.id)
                                }
                                className={`h-4 w-4 shrink-0 rounded border-[#d4d4d4] ${somePinsSelected ? "data-[state=checked]:bg-[#8a8a8a]" : ""}`}
                              />
                            </div>

                            {/* // Nested Pins *\/}
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
                                      onCheckedChange={() =>
                                        handleTogglePin(pin.id)
                                      }
                                      className="h-4 w-4 rounded border-[#d4d4d4] mt-0.5 shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-[#171717] line-clamp-2">
                                        {renderInlineMarkdown(
                                          formatPinTitle(
                                            pin.text ||
                                              pin.title ||
                                              pin.formattedContent ||
                                              "Untitled pin",
                                          ),
                                        )}
                                      </p>
                                      {pin.tags && pin.tags.length > 0 && (
                                        <div className="flex gap-1 mt-1 flex-wrap">
                                          {pin.tags
                                            .slice(0, 2)
                                            .map((tag, idx) => (
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
          </div> */}
        </div>

        {/* <Separator className="text-main-border py-0 my-0"/> */}

        <DialogFooter className="max-h-[40px] h-[40px] border-t border-main-border flex items-center justify-between gap-2 pt-1">
          {/* // Include Files Toggle */}
          {/* <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="font-geist font-medium text-sm text-[#171717]">
                Include Files
              </div>
              <Switch
                id="include-files"
                checked={includeFiles}
                onCheckedChange={setIncludeFiles}
                className="cursor-pointer"
              />
            </div>
          </div> */}

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
              disabled={
                !starterFrameworkSelected &&
                !proFrameworkSelected &&
                !selectedModel
              }
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
