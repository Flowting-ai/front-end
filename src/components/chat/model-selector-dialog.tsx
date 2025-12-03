
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
import { Search, Info, Bookmark, Loader2, X } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
            className="flex items-center"
            style={{
              background: '#F5F5F5',
              width: 299,
              height: 35,
              borderRadius: 10,
              padding: 3,
              justifyContent: 'flex-start',
            }}
          >
            <Tabs value={category} onValueChange={(v) => setCategory(v as ModelCategory)}>
              <TabsList className="flex gap-2 h-full">
                {[
                  { key: 'all', label: 'All', icon: <svg width="15" height="15" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" stroke="#A3A3A3" strokeWidth="2"/></svg> },
                  { key: 'text', label: 'Text', icon: <svg width="26" height="26" viewBox="0 0 18 18" fill="none"><rect x="3" y="5" width="12" height="8" rx="2" stroke="#A3A3A3" strokeWidth="2"/><line x1="5" y1="8" x2="13" y2="8" stroke="#A3A3A3" strokeWidth="1.5"/><line x1="5" y1="11" x2="10" y2="11" stroke="#A3A3A3" strokeWidth="1.5"/></svg> },
                  { key: 'image', label: 'Image', icon: <svg width="26" height="26" viewBox="0 0 18 18" fill="none"><rect x="3" y="5" width="12" height="8" rx="2" stroke="#A3A3A3" strokeWidth="2"/><circle cx="7" cy="9" r="1.5" stroke="#A3A3A3" strokeWidth="1.5"/><path d="M6 13L10 9L13 12" stroke="#A3A3A3" strokeWidth="1.5"/></svg> },
                  { key: 'video', label: 'Video', icon: <svg width="26" height="26" viewBox="0 0 18 18" fill="none"><rect x="3" y="5" width="12" height="8" rx="2" stroke="#A3A3A3" strokeWidth="2"/><polygon points="7,8 12,9.5 7,11" fill="#A3A3A3"/></svg> },
                ].map(({ key, label, icon }) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className={
                      `flex items-center gap-2 justify-center px-4 h-[29px] rounded-[8px] text-sm font-medium transition-colors
                      ${category === key
                        ? 'bg-white border border-[#F5F5F5] text-black'
                        : 'bg-[#F5F5F5] border-none text-black'}
                      `
                    }
                    style={{ minWidth: 50 }}
                  >
                    <span className="flex items-center" style={{ width: key === 'all' ? 15 : 26, height: key === 'all' ? 15 : 26 }}>{icon}</span>
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
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
                        <img
                          src={getModelIcon(model.companyName, model.modelName)}
                          alt={`${model.companyName || model.modelName} logo`}
                          className="model-logo"
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
        <div className="dialog-footer">
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
            className="footer-button footer-button-select"
          >
            Select
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
