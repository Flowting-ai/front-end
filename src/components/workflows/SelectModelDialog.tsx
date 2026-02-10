"use client";

import React, { useState, useMemo, useEffect } from "react";
import { X, Search, Info, Bookmark, Loader2, Circle, FileSearch2, BookImage, Video } from "lucide-react";
import { workflowAPI } from "./workflow-api";
import { getModelIcon } from "@/lib/model-icons";
import Image from "next/image";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Model {
  id: string;
  modelId?: string;
  name: string;
  companyName: string;
  description?: string;
  logo?: string;
  modelType?: "free" | "paid";
  sdkLibrary?: string;
  inputModalities?: string[];
  outputModalities?: string[];
  inputLimit?: number;
  outputLimit?: number;
}

type ModelCategory = "text" | "image" | "video" | "all";

interface SelectModelDialogProps {
  allModels: Model[];
  selectedModelId: string | undefined;
  onClose: () => void;
  onSelect: (modelId: string) => void;
}

export function SelectModelDialog({
  allModels: propModels,
  selectedModelId,
  onClose,
  onSelect,
}: SelectModelDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [models, setModels] = useState<Model[]>(propModels);
  const [isLoading, setIsLoading] = useState(true);
  const [showFree, setShowFree] = useState(true);
  const [showPaid, setShowPaid] = useState(true);
  const [category, setCategory] = useState<ModelCategory>("all");
  const [bookmarkedModels, setBookmarkedModels] = useState<Set<string>>(new Set());
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);

  useEffect(() => {
    // Always try to fetch fresh data when dialog opens
    const fetchModelData = async () => {
      setIsLoading(true);
      
      // Use provided models if available
      if (propModels.length > 0) {
        console.log('Using provided models:', propModels);
        setModels(propModels);
        setIsLoading(false);
        return;
      }

      // Check sessionStorage cache
      const cached = sessionStorage.getItem("allModels");
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Model[];
          console.log('Using cached models:', parsed);
          if (parsed.length > 0) {
            setModels(parsed);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.error('Failed to parse cached models:', e);
        }
      }

      // Fetch from API
      try {
        console.log('Fetching models from API...');
        const data = await workflowAPI.fetchModels();
        console.log('Fetched models:', data);
        setModels(data);
        if (data.length > 0) {
          sessionStorage.setItem("allModels", JSON.stringify(data));
        }
      } catch (error) {
        console.error("Failed to fetch models:", error);
        setModels([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModelData();
  }, [propModels]);

  const toggleBookmark = (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarkedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  };

  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      if (!model || !model.name) return false;
      
      // Filter by free/paid
      const matchesType =
        (showFree && model.modelType === "free") ||
        (showPaid && model.modelType === "paid");
      if (!matchesType) return false;

      // Filter by search term
      const searchLower = searchQuery.toLowerCase();
      const nameMatch = model.name.toLowerCase().includes(searchLower);
      const companyMatch = model.companyName ? model.companyName.toLowerCase().includes(searchLower) : false;
      const matchesSearch = nameMatch || companyMatch;
      if (!matchesSearch) return false;

      // Filter by category
      if (category !== "all") {
        const modalities = (model.inputModalities || []).map((item) =>
          item.toLowerCase()
        );
        if (category === "text" && !modalities.includes("text")) return false;
        if (category === "image" && !modalities.includes("image")) return false;
        if (category === "video" && !modalities.includes("video")) return false;
      }

      return true;
    });
  }, [models, searchQuery, showFree, showPaid, category]);

  // Sort: bookmarked models first
  const sortedModels = useMemo(() => {
    return [...filteredModels].sort((a, b) => {
      const aBookmarked = bookmarkedModels.has(a.id);
      const bBookmarked = bookmarkedModels.has(b.id);
      if (aBookmarked && !bBookmarked) return -1;
      if (!aBookmarked && bBookmarked) return 1;
      return 0;
    });
  }, [filteredModels, bookmarkedModels]);

  const handleSelectModel = (modelId: string) => {
    onSelect(modelId);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[10px] border border-[#E5E5E5] shadow-lg flex flex-col px-0 py-2"
        style={{
          width: "501px",
          height: "542px",
          maxHeight: "542px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="w-full h-[34px] flex items-center justify-between px-3 flex-shrink-0">
          <h2 className="font-clash font-normal text-[24px] text-[#0A0A0A]">
            Select Model
          </h2>
          <button
            onClick={onClose}
            className="cursor-pointer text-[#757575] hover:text-black transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Bar and Filters */}
        <div className="border-b border-[#E5E5E5] flex items-center justify-between gap-3 px-3 pb-2 flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute top-[50%] left-3 -translate-y-1/2 w-4 h-4 text-[#888888]" />
            <input
              type="text"
              placeholder="Search Models, LLMs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[32px] h-[32px] border-0 bg-transparent px-10 py-[5.5px] font-geist font-normal text-sm text-[#0A0A0A] placeholder-[#737373] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="free"
                checked={showFree}
                onCheckedChange={(checked) => setShowFree(checked as boolean)}
                className="h-4 w-4 rounded-[4px] border border-[#D4D4D4] data-[state=checked]:bg-black data-[state=checked]:border-black data-[state=checked]:text-white"
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
                className="h-4 w-4 rounded-[4px] border border-[#D4D4D4] data-[state=checked]:bg-black data-[state=checked]:border-black data-[state=checked]:text-white"
              />
              <Label htmlFor="paid" className="text-sm text-[#171717] cursor-pointer">
                Paid
              </Label>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-3 py-2 flex-shrink-0">
          <div
            className="flex items-center"
            style={{
              background: "#F5F5F5",
              width: "299px",
              height: "35px",
              borderRadius: "10px",
              padding: "2px",
            }}
          >
            <style>{`
              .workflow-model-category-root { background-color: #F5F5F5 !important; }
              .workflow-model-category-root .workflow-model-category-list { background-color: #F5F5F5 !important; box-shadow: none !important; }
              .workflow-model-category-root .workflow-tab-trigger { background-color: #F5F5F5 !important; border: none !important; box-shadow: none !important; }
              .workflow-model-category-root .workflow-tab-trigger[data-state="active"], .workflow-model-category-root .workflow-tab-trigger[aria-selected="true"] { background-color: #FFFFFF !important; border: 1px solid #E5E5E5 !important; }
              .workflow-model-category-root .workflow-tab-trigger[data-state="inactive"] { background-color: #F5F5F5 !important; border: none !important; }
            `}</style>
            <TabsPrimitive.Root
              value={category}
              onValueChange={(v) => setCategory(v as ModelCategory)}
              className="workflow-model-category-root"
            >
              <TabsPrimitive.List
                className="flex h-full p-0 rounded-[10px] workflow-model-category-list"
                style={{ gap: 4, backgroundColor: "#F5F5F5", padding: 0 }}
              >
                {[
                  { key: "all", label: "All", icon: <Circle className="h-5 w-5 text-[#A3A3A3]" /> },
                  { key: "text", label: "Text", icon: <FileSearch2 className="h-5 w-5 text-[#A3A3A3]" /> },
                  { key: "image", label: "Image", icon: <BookImage className="h-5 w-5 text-[#A3A3A3]" /> },
                  { key: "video", label: "Video", icon: <Video className="h-5 w-5 text-[#A3A3A3]" /> },
                ].map(({ key, label, icon }) => (
                  <TabsPrimitive.Trigger
                    key={key}
                    value={key}
                    className="flex items-center justify-center rounded-[10px] text-sm font-medium transition-colors flex-shrink-0 text-[#171717] workflow-tab-trigger"
                    style={{
                      height: 29,
                      minWidth: 29,
                      gap: 4,
                      paddingTop: 1,
                      paddingRight: 5,
                      paddingBottom: 1,
                      paddingLeft: 6,
                      backgroundColor: category === key ? "#FFFFFF" : "#F5F5F5",
                      border: category === key ? "1px solid #E5E5E5" : "none",
                      boxShadow: category === key ? "0 0 0 4px rgba(0,0,0,0.04)" : "none",
                    }}
                  >
                    <span className="flex items-center" style={{ width: 20, height: 20 }}>
                      {icon}
                    </span>
                    <span style={{ marginLeft: 4, color: "#171717", whiteSpace: "nowrap" }}>
                      {label}
                    </span>
                  </TabsPrimitive.Trigger>
                ))}
              </TabsPrimitive.List>
            </TabsPrimitive.Root>
          </div>
        </div>

        {/* Models List */}
        <div className="flex-1 min-h-0 overflow-hidden px-3">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-[#888888]" />
              </div>
            ) : sortedModels.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[#757575] text-sm gap-2">
              <div className="font-medium">No models found</div>
              {searchQuery ? (
                <div className="text-xs">Try a different search term</div>
              ) : models.length === 0 ? (
                <div className="text-xs text-center">
                  No models available. Check your backend connection.
                </div>
              ) : (
                <div className="text-xs">Try adjusting the filters</div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 pb-2">
              {sortedModels.map((model) => {
                const isBookmarked = bookmarkedModels.has(model.id);
                const isSelected = selectedModelId === model.id;
                const isHovered = hoveredModel === model.id;

                return (
                  <TooltipProvider key={model.id}>
                    <div
                      className="flex items-center gap-2 w-full min-h-[32px] h-[32px] rounded-[6px] px-2 py-1 cursor-pointer transition-all duration-200"
                      style={{
                        borderWidth: "1px",
                        borderStyle: "solid",
                        borderColor: isSelected ? "#1E1E1E" : "transparent",
                        backgroundColor: isHovered ? "#F5F5F5" : "transparent",
                      }}
                      onClick={() => {
                        handleSelectModel(model.id);
                        onClose();
                      }}
                      onMouseEnter={() => setHoveredModel(model.id)}
                      onMouseLeave={() => setHoveredModel(null)}
                    >
                      {/* Model Icon and Name */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Image
                          src={getModelIcon(model.companyName, model.name, model.sdkLibrary)}
                          alt={`${model.companyName || model.name} logo`}
                          width={20}
                          height={20}
                          className="shrink-0"
                        />
                        <span className="text-sm font-medium text-[#171717] truncate">
                          {model.name}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="p-0.5 hover:bg-black/5 rounded transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Info className="h-3.5 w-3.5 text-[#666666]" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <div className="space-y-1">
                              <p><strong>Model:</strong> {model.name}</p>
                              <p><strong>Company:</strong> {model.companyName}</p>
                              <p><strong>Type:</strong> {model.modelType || "N/A"}</p>
                              {model.inputLimit && (
                                <p><strong>Input Limit:</strong> {model.inputLimit.toLocaleString()} tokens</p>
                              )}
                              {model.outputLimit && (
                                <p><strong>Output Limit:</strong> {model.outputLimit.toLocaleString()} tokens</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                        <button
                          className="p-0.5 hover:bg-black/5 rounded transition-colors"
                          onClick={(e) => toggleBookmark(model.id, e)}
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
              })}
            </div>
          )}
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-[#E5E5E5] flex-shrink-0">
          <button
            onClick={onClose}
            className="cursor-pointer h-8 rounded-lg px-4 bg-white border border-[#D4D4D4] text-sm font-medium text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedModelId) {
                onClose();
              }
            }}
            disabled={!selectedModelId}
            className="cursor-pointer h-8 rounded-lg px-4 bg-[#2C2C2C] text-white text-sm font-medium hover:bg-[#1F1F1F] transition-colors disabled:bg-[#D4D4D4] disabled:text-[#757575] disabled:cursor-not-allowed"
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
}
