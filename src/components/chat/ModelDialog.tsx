"use client";

/**
 * ModelDialog — unified model-selection / model-switch dialog.
 *
 * Replaces the two separate files that had ~70% duplicated code:
 *   - model-selector-dialog.tsx  (Choose Your Model — for initial selection)
 *   - model-switch-dialog.tsx    (Switch Model — for mid-chat switching)
 *
 * Both old files are kept as thin re-export shims for backward compatibility.
 *
 * Usage:
 *   <ModelDialog mode="select" open={…} onOpenChange={…} onModelSelect={…} onFrameworkSelect={…} useFramework={…} />
 *   <ModelDialog mode="switch" open={…} onOpenChange={…} currentModel={…} onModelSwitch={…} />
 */

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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  Search,
  Bookmark,
} from "lucide-react";
import Image from "next/image";
import type { AIModel } from "@/types/ai-model";
import type { UserPlanType } from "@/lib/api/user";
import type { PinType } from "@/components/layout/right-sidebar";
import { canAccessFramework } from "@/lib/plan-config";
import { getModelIcon } from "@/lib/model-icons";
import { fetchModelsWithCache } from "@/lib/ai-models";
import { renderInlineMarkdown, formatPinTitle } from "@/lib/markdown-utils";
import { toast } from "@/lib/toast-helper";
import { apiFetch } from "@/lib/api/client";
import { CHAT_MESSAGES_ENDPOINT } from "@/lib/config";
import chatStyles from "@/components/chat/chat-interface.module.css";

// ── Shared public types ──────────────────────────────────────────────────────

export interface ModelSwitchConfig {
  model: AIModel | null;
  /** `null` when a specific model is chosen; `"base"` / `"pro"` for frameworks. */
  algorithm: "base" | "pro" | null;
  memoryPercentage: number; // float 0.0–1.0
  chatMemory: number; // percentage 0–100
  chatMemoryMessages: number; // actual messages included
  totalMessages: number; // total messages in chat
  includePins: string[]; // pin IDs
  includeFiles: boolean;
}

// ── Internal constants ───────────────────────────────────────────────────────

const INPUT_OPTIONS = ["text", "image"] as const;
const OUTPUT_OPTIONS = ["text", "image"] as const;
const DEFAULT_CHAT_MEMORY = 100;
type ModelCategory = "text" | "image" | "video" | "all";

// ── Discriminated-union props ────────────────────────────────────────────────

type BaseProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userPlanType?: UserPlanType | null;
  frameworkType?: "starter" | "pro";
};

type SelectModeProps = BaseProps & {
  mode: "select";
  /** Whether the user currently has auto-routing active. */
  useFramework: boolean;
  onModelSelect: (model: AIModel) => void;
  onFrameworkSelect: (type: "starter" | "pro") => void;
};

type SwitchModeProps = BaseProps & {
  mode: "switch";
  currentModel: AIModel | null;
  pendingModel?: AIModel | null;
  onModelSwitch: (config: ModelSwitchConfig) => void;
  onFrameworkSelect?: (type: "starter" | "pro") => void;
  chatBoards?: Array<{ id: string; name: string }>;
  pins?: PinType[];
  /** Active chat ID, used to fetch real message count for smart memory default. */
  activeChatId?: string | null;
  /** Pre-loaded message count — avoids an extra fetch when the parent already knows it. */
  knownMessageCount?: number;
};

export type ModelDialogProps = SelectModeProps | SwitchModeProps;

// ── Internal: shared FrameworkSelector ──────────────────────────────────────

interface FrameworkSelectorProps {
  starterSelected: boolean;
  proSelected: boolean;
  userPlanType?: UserPlanType | null;
  onStarterToggle: () => void;
  onProToggle: () => void;
}

function FrameworkSelector({
  starterSelected,
  proSelected,
  userPlanType,
  onStarterToggle,
  onProToggle,
}: FrameworkSelectorProps) {
  const advancedLocked = !canAccessFramework(userPlanType, "advanced");

  const handleProClick = () => {
    if (advancedLocked) {
      toast.info("Upgrade to Pro or Power", {
        description: "Advanced Framework is available on Pro and Power plans.",
      });
      return;
    }
    onProToggle();
  };

  return (
    <div className="space-y-1">
      {/* Basic Framework row */}
      <div
        role="button"
        tabIndex={0}
        className={`cursor-pointer w-full rounded-[8px] flex transition-all duration-300 h-[36px] items-center border px-2 ${
          starterSelected
            ? "border-[#0A0A0A] bg-[#F5F5F5]"
            : "border-transparent hover:bg-[#F5F5F5]"
        }`}
        onClick={onStarterToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onStarterToggle();
          }
        }}
        aria-pressed={starterSelected}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Image
            src="/new-logos/souvenirBasicFrameworkLogo.svg"
            width={20}
            height={20}
            alt="Basic Framework logo"
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
                aria-label="Basic framework information"
              >
                <Info className="h-3.5 w-3.5 text-[#666666]" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[280px] text-xs leading-5">
              Cost-optimized routing for daily tasks. Starter prioritizes speed
              and efficiency while keeping reliable quality for common prompts.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Advanced Framework row */}
      <div
        role="button"
        tabIndex={0}
        className={`cursor-pointer w-full rounded-[8px] flex transition-all duration-300 h-[36px] items-center border px-2 ${
          !advancedLocked && proSelected
            ? "border-[#0A0A0A] bg-[#F5F5F5]"
            : "border-transparent hover:bg-[#F5F5F5]"
        }`}
        style={{ opacity: advancedLocked ? 0.45 : 1 }}
        onClick={handleProClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleProClick();
          }
        }}
        aria-pressed={!advancedLocked && proSelected}
        aria-disabled={advancedLocked}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Image
            src="/new-logos/souvenirAdvFrameworkLogo.svg"
            width={20}
            height={20}
            alt="Advanced Framework logo"
            className="w-5 h-5 object-contain"
            style={{ opacity: advancedLocked ? 0.45 : 1 }}
          />
          <span
            className="font-geist text-sm text-[#171717] truncate"
            style={{ opacity: advancedLocked ? 0.7 : 1 }}
          >
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
                aria-label="Advanced framework information"
              >
                <Info className="h-3.5 w-3.5 text-[#666666]" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[280px] text-xs leading-5">
              {advancedLocked
                ? "Upgrade to Pro or Power to unlock Advanced Framework — quality-first routing for complex work."
                : "Quality-first routing for complex work. Pro chooses stronger models more aggressively for deeper reasoning and richer outputs."}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

// ── Internal: shared ModalityFilters ────────────────────────────────────────

interface ModalityFiltersProps {
  inputFilters: Set<string>;
  outputFilters: Set<string>;
  onInputChange: (next: Set<string>) => void;
  onOutputChange: (next: Set<string>) => void;
}

function ModalityFilters({
  inputFilters,
  outputFilters,
  onInputChange,
  onOutputChange,
}: ModalityFiltersProps) {
  const [inputOpen, setInputOpen] = useState(false);
  const [outputOpen, setOutputOpen] = useState(false);

  const toggleFilter = (
    current: Set<string>,
    key: string,
    checked: boolean,
  ): Set<string> => {
    const next = new Set(current);
    if (checked) next.add(key);
    else next.delete(key);
    return next;
  };

  return (
    <div className="flex items-center gap-2">
      {/* Input modality dropdown */}
      <DropdownMenu open={inputOpen} onOpenChange={setInputOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`font-medium text-[12px] rounded-[8px] transition-all duration-300 flex items-center gap-1 px-2.5 py-1.5 cursor-pointer ${
              inputFilters.size > 0
                ? "text-white bg-black"
                : "text-[#171717] bg-[#F5F5F5] hover:bg-zinc-300"
            }`}
          >
            Input
            {inputOpen ? (
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
              onCheckedChange={(checked) =>
                onInputChange(toggleFilter(inputFilters, opt, checked))
              }
              onSelect={(e) => e.preventDefault()}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Output modality dropdown */}
      <DropdownMenu open={outputOpen} onOpenChange={setOutputOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`font-medium text-[12px] rounded-[8px] transition-all duration-300 flex items-center gap-1 px-2.5 py-1.5 cursor-pointer ${
              outputFilters.size > 0
                ? "text-white bg-black"
                : "text-[#171717] bg-[#F5F5F5] hover:bg-zinc-300"
            }`}
          >
            Output
            {outputOpen ? (
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
              onCheckedChange={(checked) =>
                onOutputChange(toggleFilter(outputFilters, opt, checked))
              }
              onSelect={(e) => e.preventDefault()}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear active filters */}
      {(inputFilters.size > 0 || outputFilters.size > 0) && (
        <button
          type="button"
          onClick={() => {
            onInputChange(new Set());
            onOutputChange(new Set());
          }}
          className="font-medium text-[12px] text-[#171717] bg-[#F5F5F5] hover:bg-zinc-300 rounded-[8px] transition-all duration-300 px-2.5 py-1.5 cursor-pointer"
        >
          Clear
        </button>
      )}
    </div>
  );
}

// ── Main ModelDialog component ───────────────────────────────────────────────

export function ModelDialog(props: ModelDialogProps) {
  const { open, onOpenChange, userPlanType, frameworkType = "starter" } = props;

  // ── Shared state ──────────────────────────────────────────────────────────
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFree, setShowFree] = useState(true);
  const [showPaid, setShowPaid] = useState(true);
  const [inputFilters, setInputFilters] = useState<Set<string>>(new Set());
  const [outputFilters, setOutputFilters] = useState<Set<string>>(new Set());
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const hasAdvanced = canAccessFramework(userPlanType, "advanced");
  const [starterFrameworkSelected, setStarterFrameworkSelected] =
    useState<boolean>(!hasAdvanced);
  const [proFrameworkSelected, setProFrameworkSelected] =
    useState<boolean>(hasAdvanced);

  // ── Select-mode state ─────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [bookmarkedModels, setBookmarkedModels] = useState<Set<string>>(
    new Set(),
  );
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  // category is retained in state so filtering logic is preserved for future tabs UI
  const [category] = useState<ModelCategory>("all");

  // ── Switch-mode state ─────────────────────────────────────────────────────
  const chatMemoryInitialized = useRef(false);
  const [totalMessages, setTotalMessages] = useState<number>(0);
  const [isFetchingMessages, setIsFetchingMessages] = useState(false);
  const [chatMemory, setChatMemory] = useState(DEFAULT_CHAT_MEMORY);
  // Include-pins and include-files are currently commented out in the UI
  // but state is kept so future re-activation is a one-liner.
  const [selectedPinIds, setSelectedPinIds] = useState<string[]>([]);
  const [expandedChatIds, setExpandedChatIds] = useState<string[]>([]);
  const [includeFiles, setIncludeFiles] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const includedMessages = useMemo(
    () => Math.round((chatMemory / 100) * totalMessages),
    [chatMemory, totalMessages],
  );

  // ── Shared effects ────────────────────────────────────────────────────────

  // Load model list once per open
  useEffect(() => {
    if (!open) return;
    // In select mode, don't re-fetch if already loaded
    if (props.mode === "select" && models.length > 0) return;
    let cancelled = false;
    setIsLoading(true);
    fetchModelsWithCache().then((result) => {
      if (!cancelled) {
        setModels(result);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Select-mode effects ───────────────────────────────────────────────────

  useEffect(() => {
    if (props.mode !== "select") return;
    if (!open) return;
    const { useFramework } = props;
    if (useFramework) {
      setStarterFrameworkSelected(frameworkType === "starter");
      setProFrameworkSelected(frameworkType === "pro");
    } else {
      setStarterFrameworkSelected(!hasAdvanced);
      setProFrameworkSelected(hasAdvanced);
    }
    setSelectedModel(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Switch-mode effects ───────────────────────────────────────────────────

  // Reset dialog state each time it opens
  useEffect(() => {
    if (props.mode !== "switch") return;
    if (!open) return;
    const { currentModel, pendingModel } = props;
    const modelToSelect = pendingModel ?? currentModel;
    setSelectedModel(modelToSelect);
    if (modelToSelect) {
      setStarterFrameworkSelected(false);
      setProFrameworkSelected(false);
    } else {
      setStarterFrameworkSelected(!hasAdvanced);
      setProFrameworkSelected(hasAdvanced);
    }
    setSelectedPinIds([]);
    setExpandedChatIds([]);
    setIncludeFiles(false);
    setInputFilters(new Set());
    setOutputFilters(new Set());
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch real message count for smart memory default
  useEffect(() => {
    if (props.mode !== "switch") return;
    if (!open) {
      chatMemoryInitialized.current = false;
      return;
    }
    if (chatMemoryInitialized.current) return;
    chatMemoryInitialized.current = true;

    const { activeChatId, knownMessageCount } = props;

    if (knownMessageCount !== undefined) {
      setTotalMessages(knownMessageCount);
      setChatMemory(DEFAULT_CHAT_MEMORY);
      return;
    }
    if (!activeChatId) {
      setTotalMessages(0);
      setChatMemory(DEFAULT_CHAT_MEMORY);
      return;
    }

    const fetch = async () => {
      setIsFetchingMessages(true);
      try {
        const res = await apiFetch(CHAT_MESSAGES_ENDPOINT(activeChatId), {
          method: "GET",
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        const msgs: unknown[] = Array.isArray(data)
          ? data
          : Array.isArray((data as { results?: unknown[] }).results)
            ? (data as { results: unknown[] }).results
            : [];
        setTotalMessages(msgs.length);
        setChatMemory(DEFAULT_CHAT_MEMORY);
      } catch {
        setTotalMessages(0);
        setChatMemory(DEFAULT_CHAT_MEMORY);
      } finally {
        setIsFetchingMessages(false);
      }
    };
    void fetch();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shared filtering ──────────────────────────────────────────────────────

  const filteredModels = models.filter((model) => {
    if (!showFree && model.modelType === "free") return false;
    if (!showPaid && model.modelType === "paid") return false;

    // Search (select mode only — always passes in switch mode)
    if (
      props.mode === "select" &&
      searchTerm &&
      !model.modelName.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !model.companyName.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }

    // Category tab filter (select mode; always "all" until tabs UI is re-added)
    if (props.mode === "select" && category !== "all") {
      const mods = (model.inputModalities ?? []).map((m) => m.toLowerCase());
      if (category === "text" && !mods.includes("text")) return false;
      if (category === "image" && !mods.includes("image")) return false;
      if (category === "video" && !mods.includes("video")) return false;
    }

    if (inputFilters.size > 0) {
      const mods = (model.inputModalities ?? []).map((m) => m.toLowerCase());
      if (![...inputFilters].some((f) => mods.includes(f))) return false;
    }
    if (outputFilters.size > 0) {
      const mods = (model.outputModalities ?? []).map((m) => m.toLowerCase());
      if (![...outputFilters].some((f) => mods.includes(f))) return false;
    }

    return true;
  });

  // Select mode: sort bookmarked models first
  const modelsToDisplay =
    props.mode === "select"
      ? [...filteredModels].sort((a, b) => {
          const aB = bookmarkedModels.has(a.modelName);
          const bB = bookmarkedModels.has(b.modelName);
          return aB === bB ? 0 : aB ? -1 : 1;
        })
      : filteredModels;

  // ── Framework toggle helpers (shared logic) ───────────────────────────────

  const toggleStarter = () => {
    setStarterFrameworkSelected((prev) => {
      const next = !prev;
      if (next) setProFrameworkSelected(false);
      return next;
    });
    setSelectedModel(null);
  };

  const togglePro = () => {
    setProFrameworkSelected((prev) => {
      const next = !prev;
      if (next) setStarterFrameworkSelected(false);
      return next;
    });
    setSelectedModel(null);
  };

  // ── Free/Paid checkbox row (shared UI) ────────────────────────────────────

  const FreePaidCheckboxes = () => (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <Checkbox
          id="md-free"
          checked={showFree}
          onCheckedChange={(c) => setShowFree(c as boolean)}
          className="h-4 w-4 rounded-[5px] border-[#d4d4d4] data-[state=checked]:bg-black data-[state=checked]:border-black data-[state=checked]:text-white"
        />
        <Label
          htmlFor="md-free"
          className="text-sm text-[#171717] cursor-pointer"
        >
          Starter
        </Label>
      </div>
      <div className="flex items-center gap-1.5">
        <Checkbox
          id="md-paid"
          checked={showPaid}
          onCheckedChange={(c) => setShowPaid(c as boolean)}
          className="h-4 w-4 rounded-[5px] border-[#d4d4d4] data-[state=checked]:bg-black data-[state=checked]:border-black data-[state=checked]:text-white"
        />
        <Label
          htmlFor="md-paid"
          className="text-sm text-[#171717] cursor-pointer"
        >
          Pro
        </Label>
      </div>
    </div>
  );

  // ── SELECT mode render ────────────────────────────────────────────────────

  if (props.mode === "select") {
    const { onModelSelect, onFrameworkSelect } = props;
    const hasFrameworkSelected = starterFrameworkSelected || proFrameworkSelected;

    const handleSelect = () => {
      if (hasFrameworkSelected) {
        onFrameworkSelect(starterFrameworkSelected ? "starter" : "pro");
        onOpenChange(false);
        return;
      }
      if (selectedModel) {
        onModelSelect(selectedModel);
        onOpenChange(false);
      }
    };

    const toggleBookmark = (modelName: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setBookmarkedModels((prev) => {
        const next = new Set(prev);
        if (next.has(modelName)) next.delete(modelName);
        else next.add(modelName);
        return next;
      });
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[501px] w-[501px] max-h-[542px] h-[542px] text-[#171717] bg-white border border-[#E5E5E5] rounded-[10px] flex flex-col gap-1 px-0 py-2">
          <DialogHeader className="w-full max-h-[34px] h-[34px] flex items-start justify-center px-3">
            <DialogTitle className="font-clash font-normal text-[24px] text-tb-dialog-text">
              Choose Your Model
            </DialogTitle>
          </DialogHeader>

          {/* Search bar + free/paid checkboxes */}
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="relative flex-1">
              <Search className="absolute top-[50%] left-3 -translate-y-1/2 w-4 h-4 text-[#888888]" />
              <Input
                placeholder="Search Models, LLMs"
                className="search-input w-full min-h-[32px] h-[32px] border-0 px-10 py-[5.5px] shadow-none!"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="filter-checkboxes">
              <FreePaidCheckboxes />
            </div>
          </div>

          {/* Modality filters */}
          <div className="flex items-center gap-2 px-3 py-1 border-t border-b border-main-border">
            <ModalityFilters
              inputFilters={inputFilters}
              outputFilters={outputFilters}
              onInputChange={setInputFilters}
              onOutputChange={setOutputFilters}
            />
          </div>

          {/* Auto-routing */}
          <div className="px-3 mb-2 mt-1">
            <h3 className="font-geist text-sm text-[#737373] my-2">
              Auto Routing
            </h3>
            <FrameworkSelector
              starterSelected={starterFrameworkSelected}
              proSelected={proFrameworkSelected}
              userPlanType={userPlanType}
              onStarterToggle={toggleStarter}
              onProToggle={togglePro}
            />
          </div>

          {/* Models heading */}
          <div className="px-3 pt-1 mb-2">
            <h3 className="font-geist text-sm text-[#737373]">Models</h3>
          </div>

          {/* Scrollable model list */}
          <ScrollArea className="models-list-container overflow-y-auto px-3">
            <div className="models-list">
              {isLoading ? (
                <div className="loading-state">
                  <Loader2 className="h-6 w-6 animate-spin text-[#888888]" />
                </div>
              ) : modelsToDisplay.length > 0 ? (
                modelsToDisplay.map((model, index) => {
                  const isBookmarked = bookmarkedModels.has(model.modelName);
                  const isSelected =
                    selectedModel?.modelName === model.modelName;
                  const isHovered = hoveredModel === model.modelName;
                  return (
                    <TooltipProvider key={index}>
                      <div
                        className="model-item"
                        style={{
                          width: "100%",
                          minHeight: "32px",
                          height: "32px",
                          borderRadius: "6px",
                          gap: "8px",
                          paddingTop: "5.5px",
                          paddingRight: "2px",
                          paddingBottom: "5.5px",
                          paddingLeft: "2px",
                          borderColor: isSelected ? "#1E1E1E" : "transparent",
                          backgroundColor: isHovered ? "#F5F5F5" : "transparent",
                        }}
                        onClick={() => {
                          setSelectedModel(model);
                          setStarterFrameworkSelected(false);
                          setProFrameworkSelected(false);
                        }}
                        onMouseEnter={() => setHoveredModel(model.modelName)}
                        onMouseLeave={() => setHoveredModel(null)}
                      >
                        <div className="model-info">
                          <Image
                            src={getModelIcon(
                              model.companyName,
                              model.modelName,
                              model.sdkLibrary,
                            )}
                            alt={`${model.companyName} logo`}
                            className="model-logo"
                            width={20}
                            height={20}
                          />
                          <span className="model-name">{model.modelName}</span>
                        </div>
                        <div className="model-actions">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className="action-button"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Info className="h-3.5 w-3.5 text-[#666666]" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="right"
                              className="model-tooltip"
                            >
                              <div className="tooltip-content">
                                <p>
                                  <strong>Model:</strong> {model.modelName}
                                </p>
                                <p>
                                  <strong>Company:</strong> {model.companyName}
                                </p>
                                <p>
                                  <strong>Type:</strong> {model.modelType}
                                </p>
                                <p>
                                  <strong>Input Limit:</strong>{" "}
                                  {model.inputLimit.toLocaleString()} tokens
                                </p>
                                <p>
                                  <strong>Output Limit:</strong>{" "}
                                  {model.outputLimit.toLocaleString()} tokens
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                          <button
                            className="action-button"
                            onClick={(e) => toggleBookmark(model.modelName, e)}
                          >
                            <Bookmark
                              className="h-3.5 w-3.5 text-[#666666]"
                              fill={isBookmarked ? "#000000" : "none"}
                              stroke={
                                isBookmarked ? "#000000" : "currentColor"
                              }
                            />
                          </button>
                        </div>
                      </div>
                    </TooltipProvider>
                  );
                })
              ) : (
                <div className="empty-state">No models found.</div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="dialog-footer px-3">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="footer-button cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSelect}
              disabled={!hasFrameworkSelected && !selectedModel}
              className={`cursor-pointer ${
                hasFrameworkSelected || selectedModel
                  ? "text-white bg-[#1E1E1E] hover:bg-black"
                  : ""
              }`}
              style={{ transition: "background-color 300ms ease" }}
            >
              Select
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── SWITCH mode render ────────────────────────────────────────────────────

  const {
    onModelSwitch,
    onFrameworkSelect,
    chatBoards = [],
    pins = [],
  } = props;

  const handleSwitch = () => {
    if (
      (starterFrameworkSelected || proFrameworkSelected) &&
      onFrameworkSelect
    ) {
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

  // Pins grouped by chat (kept for when the include-pins UI is re-enabled)
  const pinsByChat = pins.reduce(
    (acc, pin) => {
      const chatId = pin.chatId ?? pin.sourceChatId ?? "unknown";
      if (!acc[chatId]) acc[chatId] = [];
      acc[chatId].push(pin);
      return acc;
    },
    {} as Record<string, PinType[]>,
  );
  const chatsWithPins = chatBoards.filter(
    (chat) => (pinsByChat[chat.id]?.length ?? 0) > 0,
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
    const chatPinIds = (pinsByChat[chatId] ?? []).map((p) => p.id);
    const allSelected = chatPinIds.every((id) => selectedPinIds.includes(id));
    if (allSelected) {
      setSelectedPinIds((prev) => prev.filter((id) => !chatPinIds.includes(id)));
    } else {
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
          {/* Auto Routing section */}
          <div className="w-full">
            <div className="mb-2">
              <h3 className="font-geist text-sm text-[#737373]">
                Auto Routing
              </h3>
            </div>
            <FrameworkSelector
              starterSelected={starterFrameworkSelected}
              proSelected={proFrameworkSelected}
              userPlanType={userPlanType}
              onStarterToggle={toggleStarter}
              onProToggle={togglePro}
            />
          </div>

          <div className="w-full">
            <h3 className="font-geist text-sm text-[#737373]">Models</h3>
          </div>

          {/* Model dropdown + free/paid checkboxes */}
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
                  className="w-full min-w-[351px] border border-[#e6e6e6] p-2 pr-0 overflow-hidden"
                >
                  <ScrollArea
                    className={`max-h-[310px] overflow-y-auto pr-2 ${chatStyles.customScrollbar}`}
                  >
                    {isLoading ? (
                      <div className="py-8 text-center text-[#8a8a8a] text-sm">
                        Loading models…
                      </div>
                    ) : filteredModels.length === 0 ? (
                      <div className="py-8 text-center text-[#8a8a8a] text-sm">
                        No models available
                      </div>
                    ) : (
                      filteredModels.map((model) => (
                        <DropdownMenuItem
                          key={String(
                            model.modelId ??
                              model.id ??
                              `${model.companyName}-${model.modelName}`,
                          )}
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
                        </DropdownMenuItem>
                      ))
                    )}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>

              <FreePaidCheckboxes />
            </div>
          </div>

          {/* Modality filters */}
          <div className="flex items-center gap-2">
            <ModalityFilters
              inputFilters={inputFilters}
              outputFilters={outputFilters}
              onInputChange={setInputFilters}
              onOutputChange={setOutputFilters}
            />
          </div>

          {/* Chat Memory */}
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
              {/* Chat memory slider — kept for future re-activation:
              <Slider value={[chatMemory]} onValueChange={([v]) => setChatMemory(v)} min={0} max={100} step={1} disabled={isFetchingMessages} className="w-full" /> */}
              <div className="flex justify-between text-xs text-[#8a8a8a] mt-1">
                <span>0</span>
                <span>100</span>
              </div>
            </div>
          </div>

          {/* Include Pins — UI commented out pending design decision.
              State (selectedPinIds, expandedChatIds, chatsWithPins, pinsByChat,
              handleTogglePin, handleToggleAllPinsInChat, handleToggleChat)
              is fully wired and ready to restore. */}
        </div>

        <DialogFooter className="max-h-[40px] h-[40px] border-t border-main-border flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="cursor-pointer h-[32px] rounded-[10px] px-4 text-[#171717] hover:bg-[#f5f5f5]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSwitch}
              disabled={
                !starterFrameworkSelected &&
                !proFrameworkSelected &&
                !selectedModel
              }
              className="cursor-pointer h-[32px] rounded-[10px] px-4 bg-[#171717] text-white hover:bg-[#171717] disabled:bg-[#d4d4d4] disabled:text-[#8a8a8a]"
            >
              Select
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
