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
} from "lucide-react";
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
import { MODELS_ENDPOINT } from "@/lib/config";
import { getModelIcon } from "@/lib/model-icons";
import Image from "next/image";

interface ModelSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModelSelect: (model: AIModel) => void;
}

type ModelCategory = "text" | "image" | "video" | "all";

export function ModelSelectorDialog({
  open,
  onOpenChange,
  onModelSelect,
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
  // Toggle state for the Flowting AI Framework quick-select button
  const [frameworkSelected, setFrameworkSelected] = useState<boolean>(true);

  // Dummy models fallback used when the backend returns no models or fetch fails.
  // These are purely for local/dev/demo purposes and won't replace real backend data when available.
  const DUMMY_MODELS: AIModel[] = [
    {
      companyName: "OpenAI",
      modelName: "ChatGPT",
      modelType: "paid",
      inputLimit: 8192,
      outputLimit: 8192,
    },
    {
      companyName: "OpenAI",
      modelName: "ChatGPT (Free)",
      modelType: "free",
      inputLimit: 4096,
      outputLimit: 2048,
    },
    {
      companyName: "xAI",
      modelName: "Grok 1",
      modelType: "free",
      inputLimit: 16384,
      outputLimit: 4096,
    },
    {
      companyName: "Anthropic",
      modelName: "Claude 2",
      modelType: "paid",
      inputLimit: 90000,
      outputLimit: 8192,
    },
    {
      companyName: "Mistral",
      modelName: "Mistral-Instruct",
      modelType: "paid",
      inputLimit: 32768,
      outputLimit: 8192,
    },
    {
      companyName: "Imagify",
      modelName: "ImageMaster",
      modelType: "paid",
      inputLimit: 1024,
      outputLimit: 1024,
    },
    {
      companyName: "VidAI",
      modelName: "VideoGen",
      modelType: "paid",
      inputLimit: 0,
      outputLimit: 0,
    },
  ];

  useEffect(() => {
    if (!open) return;

    // If we already have models in state, don't re-fetch
    if (models.length > 0) {
      setIsLoading(false);
      return;
    }

    // Try sessionStorage first
    const cached = sessionStorage.getItem("aiModels");
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as AIModel[];
        setModels(parsed);
        setIsLoading(false);
        return;
      } catch {
        // ignore parse errors and fall through to fetch
      }
    }

    const fetchModels = async () => {
      setIsLoading(true);
      let raw: AIModel[] = [];
      try {
        const response = await fetch(MODELS_ENDPOINT, {
          credentials: "include",
        });
        if (!response.ok) {
          console.warn(
            `Backend not available: ${response.status} ${response.statusText}`
          );
        } else {
          raw = await response.json();
          console.log("Raw models from backend:", raw);
        }
      } catch (fetchError) {
        console.warn("Failed to fetch models from backend:", fetchError);
      }

      // If backend returned no models or fetch failed, use the dummy fallback so UI stays populated
      if (!raw || raw.length === 0) {
        raw = DUMMY_MODELS;
        console.log("Using dummy models fallback:", raw);
      }

      setModels(raw);
      sessionStorage.setItem("aiModels", JSON.stringify(raw));
      setIsLoading(false);
    };

    fetchModels();
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

    // Filter by category (assuming we categorize based on model name or type)
    // This is a placeholder - adjust based on your actual data structure
    if (category !== "all") {
      const modelCategory = model.modelName.toLowerCase().includes("image")
        ? "image"
        : model.modelName.toLowerCase().includes("video")
        ? "video"
        : "text";
      if (modelCategory !== category) return false;
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

  // Prefer sorted/filter results, but fall back to DUMMY_MODELS when no models are available
  const modelsToDisplay = sortedModels.length > 0 ? sortedModels : DUMMY_MODELS;

  const handleSelectModel = () => {
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
          <DialogTitle className="font-clash font-[400] text-[24px] text-tb-dialog-text">
            Choose Your Model
          </DialogTitle>
        </DialogHeader>

        {/* Flowting AI Framework */}
        <div className="font-inter w-full h-[116px] flex px-3 my-3">
          <button
            className={`relative cursor-pointer w-full bg-white hover:bg-[#F5F5F5] border ${frameworkSelected ? "border-[#0A0A0A]" : "border-main-border"} hover:border-[#0A0A0A] rounded-[7px] flex transition-all duration-300`}
            onClick={() => setFrameworkSelected((s) => !s)}
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
              <p className="font-[400] text-[14px] text-left">
                A smart blend of AI models for high-quality results. Flowting
                picks the right model for your task and adapts as you work,
                keeping your context intact and you in control.
              </p>
            </div>
          </button>
        </div>

        {/* Search Bar and Filters Row */}
        <div className="border-b border-main-border flex items-center justify-between gap-3 px-3">
          <div className="relative flex-1">
            <Search className="absolute top-[50%] left-3 -translate-y-1/2 w-4 h-4 text-[#888888]" />
            <Input
              placeholder="Search Models, LLMs"
              className="search-input w-full min-h-[32px] h-[32px] border-0 px-10 py-[5.5px]"
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
              <Label htmlFor="free" className="checkbox-label">
                Free
              </Label>
            </div>
            <div className="checkbox-item">
              <Checkbox
                id="paid"
                checked={showPaid}
                onCheckedChange={(checked) => setShowPaid(checked as boolean)}
                className="h-4 w-4 rounded-[4px] border border-[#D4D4D4] rounded-[5px] data-[state=checked]:bg-black data-[state=checked]:border-black data-[state=checked]:text-white"
              />
              <Label htmlFor="paid" className="checkbox-label">
                Paid
              </Label>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className=" category-tabs-wrapper px-3">
          <div
            className="flex items-center model-category-root"
            style={{
              background: "#F5F5F5",
              width: "299px",
              height: "35px",
              borderRadius: "10px",
              padding: "2px",
              justifyContent: "flex-start",
              transform: "rotate(0deg)",
              opacity: 1,
              boxShadow: "none",
              backgroundImage: "none",
              backgroundBlendMode: "normal",
            }}
          >
            <style>{`
              .model-category-root { background-color: #F5F5F5 !important; }
              .model-category-root .model-category-list { background-color: #F5F5F5 !important; box-shadow: none !important; }
              .model-category-root .tab-trigger { background-color: #F5F5F5 !important; border: none !important; box-shadow: none !important; }
              .model-category-root .tab-trigger[data-state="active"], .model-category-root .tab-trigger[aria-selected="true"] { background-color: #FFFFFF !important; border: 1px solid #E5E5E5 !important; }
              .model-category-root .tab-trigger[data-state="inactive"] { background-color: #F5F5F5 !important; border: none !important; }
              .model-category-root .tab-trigger span { background: transparent !important; }
            `}</style>
            <TabsPrimitive.Root
              value={category}
              onValueChange={(v) => setCategory(v as ModelCategory)}
            >
              <TabsPrimitive.List
                className="flex h-full p-0 rounded-[10px] model-category-list"
                style={{
                  gap: 4,
                  backgroundColor: "#F5F5F5",
                  padding: 0,
                  boxShadow: "none",
                  backgroundImage: "none",
                }}
              >
                {[
                  {
                    key: "all",
                    label: "All",
                    icon: <Circle className="h-5 w-5 text-[#A3A3A3]" />,
                  },
                  {
                    key: "text",
                    label: "Text",
                    icon: <FileSearch2 className="h-5 w-5 text-[#A3A3A3]" />,
                  },
                  {
                    key: "image",
                    label: "Image",
                    icon: <BookImage className="h-5 w-5 text-[#A3A3A3]" />,
                  },
                  {
                    key: "video",
                    label: "Video",
                    icon: <Video className="h-5 w-5 text-[#A3A3A3]" />,
                  },
                ].map(({ key, label, icon }) => (
                  <TabsPrimitive.Trigger
                    key={key}
                    value={key}
                    className={`flex items-center justify-center rounded-[10px] text-sm font-medium transition-colors flex-shrink-0 text-[#171717] tab-trigger`}
                    style={{
                      height: 29,
                      minWidth: 29,
                      minHeight: 29,
                      gap: 4,
                      paddingTop: 1,
                      paddingRight: 5,
                      paddingBottom: 1,
                      paddingLeft: 6,
                      transform: "rotate(0deg)",
                      opacity: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      boxSizing: "border-box",
                      backgroundColor: category === key ? "#FFFFFF" : "#F5F5F5",
                      background: category === key ? "#FFFFFF" : "#F5F5F5",
                      border: category === key ? "1px solid #E5E5E5" : "none",
                      boxShadow:
                        category === key
                          ? "0 0 0 4px rgba(0,0,0,0.04)"
                          : "none",
                      backgroundImage: "none",
                      outline: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span
                      className="flex items-center"
                      style={{ width: 20, height: 20, color: "#A3A3A3" }}
                    >
                      {icon}
                    </span>
                    <span
                      style={{
                        marginLeft: 4,
                        color: "#171717",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </span>
                  </TabsPrimitive.Trigger>
                ))}
              </TabsPrimitive.List>
            </TabsPrimitive.Root>
          </div>
        </div>

        {/* Models List */}
        <ScrollArea className="models-list-container overflow-y-auto">
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
                      onClick={() => setSelectedModel(model)}
                      onMouseEnter={() => setHoveredModel(model.modelName)}
                      onMouseLeave={() => setHoveredModel(null)}
                    >
                      <div className="model-info">
                        <Image
                          src={getModelIcon(model.companyName, model.modelName)}
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
            disabled={!selectedModel}
            className={`cursor-pointer ${
              selectedModel ? " text-white bg-[#1E1E1E] hover:bg-black" : ""
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
