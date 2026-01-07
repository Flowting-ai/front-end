
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Info, Bookmark, Loader2, Circle, FileSearch2, BookImage, Video } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { Checkbox } from "@/components/ui/checkbox";
// Using Radix primitives directly for tight style control
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

interface ModelSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModelSelect: (model: AIModel) => void;
}

type ModelCategory = "text" | "image" | "video" | "all";

export function ModelSelectorDialog({ open, onOpenChange, onModelSelect }: ModelSelectorDialogProps) {
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFree, setShowFree] = useState(true);
  const [showPaid, setShowPaid] = useState(true);
  const [category, setCategory] = useState<ModelCategory>("all");
  const [bookmarkedModels, setBookmarkedModels] = useState<Set<string>>(new Set());
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
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
          console.warn(`Backend not available: ${response.status} ${response.statusText}`);
        } else {
          raw = await response.json();
          console.log("Raw models from backend:", raw);
        }
      } catch (fetchError) {
        console.warn("Failed to fetch models from backend:", fetchError);
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
      const modelCategory = model.modelName.toLowerCase().includes("image") ? "image" :
        model.modelName.toLowerCase().includes("video") ? "video" : "text";
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

  const handleSelectModel = () => {
    if (selectedModel) {
      onModelSelect(selectedModel);
      onOpenChange(false);
    }
  };


  return (//box dimensions: 580x420
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-white text-[#171717] p-2 gap-1"
        style={{
          width: "580px",
          maxWidth: "580px",
          height: "420px",
          borderRadius: "10px",
          border: "1px solid #E5E5E5"
        }}
      >
          <DialogHeader className="sr-only">
            <DialogTitle>Choose Your Model</DialogTitle>
          </DialogHeader>
        {/* Title */}
        <div className="dialog-title-wrapper">
          <h2 className="dialog-title">Choose Your Model</h2>
        </div>

        {/* Search Bar and Filters Row */}
        <div className="search-filters-row">
          <div className="search-input-wrapper">
            <Search className="search-icon" />
            <Input
              placeholder="Search Models, LLMs"
              className="search-input"
              style={{
                width: "100%",
                height: "32px",
                minHeight: "32px",
                borderRadius: "8px 8px 0 0",
                gap: "6px",
                paddingTop: "5.5px",
                paddingRight: "2px",
                paddingBottom: "5.5px",
                paddingLeft: "40px",
              }}
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
                className="h-4 w-4 rounded-[4px] border border-[#D4D4D4] data-[state=checked]:bg-black data-[state=checked]:border-black data-[state=checked]:text-white"
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
                className="h-4 w-4 rounded-[4px] border border-[#D4D4D4] data-[state=checked]:bg-black data-[state=checked]:border-black data-[state=checked]:text-white"
              />
              <Label htmlFor="paid" className="checkbox-label">
                Paid
              </Label>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="category-tabs-wrapper">
          <div
            className="flex items-center model-category-root"
            style={{
              background: '#F5F5F5',
              width: '299px',
              height: '35px',
              borderRadius: '10px',
              padding: '2px',
              justifyContent: 'flex-start',
              transform: 'rotate(0deg)',
              opacity: 1,
              boxShadow: 'none',
              backgroundImage: 'none',
              backgroundBlendMode: 'normal',
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
            <TabsPrimitive.Root value={category} onValueChange={(v) => setCategory(v as ModelCategory)}>
              <TabsPrimitive.List
                className="flex h-full p-0 rounded-[10px] model-category-list"
                style={{
                  gap: 4,
                  backgroundColor: '#F5F5F5',
                  padding: 0,
                  boxShadow: 'none',
                  backgroundImage: 'none',
                }}
              >
                {[
                  { key: 'all', label: 'All', icon: <Circle className="h-5 w-5 text-[#A3A3A3]"/> },
                  { key: 'text', label: 'Text', icon: <FileSearch2 className="h-5 w-5 text-[#A3A3A3]"/> },
                  { key: 'image', label: 'Image', icon: <BookImage className="h-5 w-5 text-[#A3A3A3]"/> },
                  { key: 'video', label: 'Video', icon: <Video className="h-5 w-5 text-[#A3A3A3]"/> },
                ].map(({ key, label, icon }) => (
                  <TabsPrimitive.Trigger
                    key={key}
                    value={key}
                    className={
                      `flex items-center justify-center rounded-[10px] text-sm font-medium transition-colors flex-shrink-0 text-[#171717] tab-trigger`
                    }
                    style={{
                      height: 29,
                      minWidth: 29,
                      minHeight: 29,
                      gap: 4,
                      paddingTop: 1,
                      paddingRight: 5,
                      paddingBottom: 1,
                      paddingLeft: 6,
                      transform: 'rotate(0deg)',
                      opacity: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      boxSizing: 'border-box',
                      backgroundColor: category === key ? '#FFFFFF' : '#F5F5F5',
                      background: category === key ? '#FFFFFF' : '#F5F5F5',
                      border: category === key ? '1px solid #E5E5E5' : 'none',
                      boxShadow: category === key ? '0 0 0 4px rgba(0,0,0,0.04)' : 'none',
                      backgroundImage: 'none',
                      outline: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span className="flex items-center" style={{ width: 20, height: 20, color: '#A3A3A3' }}>{icon}</span>
                    <span style={{ marginLeft: 4, color: '#171717', whiteSpace: 'nowrap' }}>{label}</span>
                  </TabsPrimitive.Trigger>
                ))}
              </TabsPrimitive.List>
            </TabsPrimitive.Root>
          </div>
        </div>

        {/* Models List */}
        <ScrollArea className="models-list-container">
          <div className="models-list">
            {isLoading ? (
              <div className="loading-state">
                <Loader2 className="h-6 w-6 animate-spin text-[#888888]" />
              </div>
            ) : sortedModels.length > 0 ? (
              sortedModels.map((model, index) => {
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
                        {/* Use next/image for icon optimization */}
                        <Image
                          src={getModelIcon(model.companyName, model.modelName)}
                          alt={`${model.companyName || model.modelName} logo`}
                          className="model-logo"
                          width={20}
                          height={20}
                        />
                        <span className="model-name">
                          {model.modelName}
                        </span>
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
                          <TooltipContent side="right" className="model-tooltip">
                            <div className="tooltip-content">
                              <p><strong>Model:</strong> {model.modelName}</p>
                              <p><strong>Company:</strong> {model.companyName}</p>
                              <p><strong>Version:</strong> {model.version}</p>
                              <p><strong>Type:</strong> {model.modelType}</p>
                              <p><strong>Input Limit:</strong> {model.inputLimit.toLocaleString()} tokens</p>
                              <p><strong>Output Limit:</strong> {model.outputLimit.toLocaleString()} tokens</p>
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
              <div className="empty-state">
                No models found.
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Action Buttons */}
          <div className="dialog-footer" style={{ padding: '0', margin: '0' }}>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="footer-button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSelectModel}
              disabled={!selectedModel}
              className={
                `footer-button footer-button-select ${selectedModel ? 'bg-[#1E1E1E] text-white hover:bg-black' : ''}`
              }
              style={{ transition: 'background-color 120ms ease' }}
            >
              Select
            </Button>
          </div>
      </DialogContent>
    </Dialog>
  );
}
