"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search,
  Info,
  Bookmark,
  Loader2,
  X,
  Circle,
  FileSearch2,
  BookImage,
  Video,
  CircleCheckBig,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { Checkbox } from "@/components/ui/checkbox";
// Using Radix primitives directly for tight style control
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AIModel } from "@/types/ai-model";
import type { UserPlanType } from "@/lib/api/user";
import { canAccessFramework } from "@/lib/plan-config";
import { getModelIcon } from "@/lib/model-icons";
import { toast } from "@/lib/toast-helper";
import { fetchModelsWithCache } from "@/lib/ai-models";
import Image from "next/image";

interface ModelSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModelSelect: (model: AIModel) => void;
  onFrameworkSelect: (type: "starter" | "pro") => void;
  useFramework: boolean;
  frameworkType?: "starter" | "pro";
  userPlanType?: UserPlanType | null;
}

type ModelCategory = "text" | "image" | "video" | "all";

export function ModelSelectorDialog({
  open,
  onOpenChange,
  onModelSelect,
  onFrameworkSelect,
  useFramework,
  frameworkType = "starter",
  userPlanType,
}: ModelSelectorDialogProps) {
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFree, setShowFree] = useState(true);
  const [showPaid, setShowPaid] = useState(true);
  const [category, setCategory] = useState<ModelCategory>("all");
  const [bookmarkedModels, setBookmarkedModels] = useState<Set<string>>(
    new Set()
  );
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const [hoveredFramework, setHoveredFramework] = useState<
    "starter" | "pro" | null
  >(null);
  // Auto-routing framework toggles
  // Default to Advanced Framework for Pro/Power, Basic for Starter
  const hasAdvanced = canAccessFramework(userPlanType, "advanced");
  const [starterFrameworkSelected, setStarterFrameworkSelected] =
    useState<boolean>(
      useFramework
        ? frameworkType === "starter"
        : !hasAdvanced,
    );
  const [proFrameworkSelected, setProFrameworkSelected] =
    useState<boolean>(
      useFramework
        ? frameworkType === "pro"
        : hasAdvanced,
    );
  // Input/Output modality filters (lowercase for matching)
  // const INPUT_OPTIONS = ["text", "image", "file", "audio", "video"] as const;
  // const OUTPUT_OPTIONS = ["text", "image", "embeddings", "audio"] as const;
  // commented out the full set of input/output options and reduced to just text/image for now
  const INPUT_OPTIONS = ["text", "image"] as const;
  const OUTPUT_OPTIONS = ["text", "image"] as const;
  const [inputFilters, setInputFilters] = useState<Set<string>>(new Set());
  const [outputFilters, setOutputFilters] = useState<Set<string>>(new Set());
  const [inputDropdownOpen, setInputDropdownOpen] = useState(false);
  const [outputDropdownOpen, setOutputDropdownOpen] = useState(false);

  // Reset framework defaults when dialog opens
  useEffect(() => {
    if (open) {
      if (useFramework) {
        setStarterFrameworkSelected(frameworkType === "starter");
        setProFrameworkSelected(frameworkType === "pro");
      } else {
        setStarterFrameworkSelected(!hasAdvanced);
        setProFrameworkSelected(hasAdvanced);
      }
      setSelectedModel(null);
    }
  }, [open, useFramework, frameworkType, hasAdvanced]);

  useEffect(() => {
    if (!open) return;
    if (models.length > 0) {
      return;
    }
    let cancelled = false;
    fetchModelsWithCache().then((result) => {
      if (!cancelled) {
        setModels(result);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [open, models.length]);

  const toggleBookmark = (modelName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarkedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelName)) {
        next.delete(modelName);
      } else {
        next.add(modelName);
      }
      return next;
    });
  };

  const filteredModels = models.filter((model) => {
    // Filter by free/paid checkboxes
    const matchesType =
      (showFree && model.modelType === "free") ||
      (showPaid && model.modelType === "paid");

    if (!matchesType) return false;

    // Filter by search term
    const matchesSearch =
      model.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.companyName.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (category !== "all") {
      const modalities = (model.inputModalities || []).map((item) =>
        item.toLowerCase()
      );
      if (category === "text" && !modalities.includes("text")) return false;
      if (category === "image" && !modalities.includes("image")) return false;
      if (category === "video" && !modalities.includes("video")) return false;
    }

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

  // Sort: bookmarked models first
  const sortedModels = [...filteredModels].sort((a, b) => {
    const aBookmarked = bookmarkedModels.has(a.modelName);
    const bBookmarked = bookmarkedModels.has(b.modelName);
    if (aBookmarked && !bBookmarked) return -1;
    if (!aBookmarked && bBookmarked) return 1;
    return 0;
  });

  const modelsToDisplay = sortedModels;
  const hasFrameworkSelected =
    starterFrameworkSelected || proFrameworkSelected;

  const handleSelectModel = () => {
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

  return (
    //box dimensions: 580x420
    //new box dimensions: 501 x 398
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[501px] w-[501px] max-h-[542px] h-[542px] text-[#171717] bg-white border border-[#E5E5E5] rounded-[10px] flex flex-col gap-1 px-0 py-2">
        <DialogHeader className="w-full max-h-[34px] h-[34px] flex items-start justify-center px-3">
          <DialogTitle className="font-clash font-normal text-[24px] text-tb-dialog-text">
            Choose Your Model
          </DialogTitle>
        </DialogHeader>

        {/* Search Bar and Filters Row */}
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
            <div className="checkbox-item">
              <Checkbox
                id="free"
                checked={showFree}
                onCheckedChange={(checked) => setShowFree(checked as boolean)}
                className="h-4 w-4 rounded-[4px] border border-[#D4D4D4] rounded-[5px] data-[state=checked]:bg-black data-[state=checked]:border-black data-[state=checked]:text-white"
              />
              {/* changing free to base and now to starter - modelSelector*/}
              <Label htmlFor="free" className="checkbox-label">
                Starter
              </Label>
            </div>
            <div className="checkbox-item">
              <Checkbox
                id="paid"
                checked={showPaid}
                onCheckedChange={(checked) => setShowPaid(checked as boolean)}
                className="h-4 w-4 rounded-[4px] border border-[#D4D4D4] rounded-[5px] data-[state=checked]:bg-black data-[state=checked]:border-black data-[state=checked]:text-white"
              />
              {/* changing paid to plus and now to pro- modelSwitch*/}
              <Label htmlFor="paid" className="checkbox-label">
                Pro
              </Label>
            </div>
          </div>
        </div>

        {/* Input Output Clear */}
        <div className="flex items-center gap-2 px-3 py-1 border-t border-b border-main-border">
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

        {/* Auto Routing */}
        <div className="px-3 mb-2 mt-1">
          <h3 className="font-geist text-sm text-[#737373] my-2">
            Auto Routing
          </h3>
          <div className="space-y-1">
            <div
              className="model-item"
              role="button"
              tabIndex={0}
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
                borderColor: starterFrameworkSelected ? "#1E1E1E" : "transparent",
                backgroundColor:
                  hoveredFramework === "starter" ? "#F5F5F5" : "transparent",
              }}
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
              onMouseEnter={() => setHoveredFramework("starter")}
              onMouseLeave={() => setHoveredFramework(null)}
              aria-pressed={starterFrameworkSelected}
            >
              <div className="model-info">
                <Image
                  src="/new-logos/souvenirBasicFrameworkLogo.svg"
                  width={20}
                  height={20}
                  alt="souvenir ai logo"
                  className="model-logo"
                />
                <span className="model-name">SouvenirAI: Basic Framework</span>
              </div>
              <div className="model-actions">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="action-button"
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
            </div>

            {(() => {
              const advancedLocked = !canAccessFramework(userPlanType, "advanced");
              return (
            <div
              className="model-item"
              role="button"
              tabIndex={0}
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
                borderColor: !advancedLocked && proFrameworkSelected ? "#1E1E1E" : "transparent",
                backgroundColor: advancedLocked
                  ? "transparent"
                  : hoveredFramework === "pro" ? "#F5F5F5" : "transparent",
                opacity: advancedLocked ? 0.45 : 1,
              }}
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
              onMouseEnter={() => setHoveredFramework(advancedLocked ? null : "pro")}
              onMouseLeave={() => setHoveredFramework(null)}
              aria-pressed={!advancedLocked && proFrameworkSelected}
              aria-disabled={advancedLocked}
            >
              <div className="model-info flex items-center">
                <Image
                  src="/new-logos/souvenirAdvFrameworkLogo.svg"
                  width={20}
                  height={20}
                  alt="souvenir ai logo"
                  className="object-contain"
                  // className="object-contain flex items-center justify-center pt-[6px]"
                  // className="model-logo"
                  // style={{ opacity: advancedLocked ? 0.7 : 1, width: '35px', height: '35px' }}
                />
                <span className="model-name" style={{ opacity: advancedLocked ? 0.8 : 1 }}>SouvenirAI: Advanced Framework</span>
              </div>
              <div className="model-actions">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="action-button"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Pro framework information"
                      >
                        <Info className="h-3.5 w-3.5 text-[#666666]" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[280px] text-xs leading-5">
                      {advancedLocked
                        ? "Upgrade to a Pro or Power Plan to unlock Advanced Framework - a quality-first routing for complex work."
                        : "Quality-first routing for complex work. Pro chooses stronger models more aggressively for deeper reasoning and richer outputs."}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
              );
            })()}
          </div>
        </div>

        {/* Models */}
        <div className="px-3 pt-1 mb-2">
          <h3 className="font-geist text-sm text-[#737373]">Models</h3>
        </div>

        {/* Models List */}
        <ScrollArea className="models-list-container overflow-y-auto px-3">
          <div className="models-list">
            {isLoading ? (
              <div className="loading-state">
                <Loader2 className="h-6 w-6 animate-spin text-[#888888]" />
              </div>
            ) : modelsToDisplay.length > 0 ? (
              modelsToDisplay.map((model, index) => {
                const isBookmarked = bookmarkedModels.has(model.modelName);
                const isSelected = selectedModel?.modelName === model.modelName;
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
                            model.sdkLibrary
                          )}
                          alt={`${model.companyName || model.modelName} logo`}
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
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
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
                            stroke={isBookmarked ? "#000000" : "currentColor"}
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

        {/* Action Buttons */}
        <div className="dialog-footer px-3">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="footer-button cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSelectModel}
            disabled={!hasFrameworkSelected && !selectedModel}
            className={`cursor-pointer ${
              hasFrameworkSelected || selectedModel
                ? " text-white bg-[#1E1E1E] hover:bg-black"
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
