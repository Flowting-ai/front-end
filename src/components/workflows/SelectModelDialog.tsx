"use client";

import React, { useState, useMemo, useEffect } from "react";
import { X, Search } from "lucide-react";
import { workflowAPI } from "./workflow-api";

interface Model {
  id: string;
  name: string;
  description?: string;
  logo?: string;
}

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
  const [isLoading, setIsLoading] = useState(propModels.length === 0);

  useEffect(() => {
    if (propModels.length > 0) {
      setModels(propModels);
      setIsLoading(false);
      return;
    }

    const cached = sessionStorage.getItem("allModels");
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Model[];
        setModels(parsed);
        setIsLoading(false);
        return;
      } catch {}
    }

    const fetchModels = async () => {
      try {
        const data = await workflowAPI.fetchModels();
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

    fetchModels();
  }, [propModels]);

  const filteredModels = useMemo(() => {
    return models.filter((model) =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [models, searchQuery]);

  const handleSelectModel = (modelId: string) => {
    onSelect(modelId);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[10px] border border-[#E5E5E5] shadow-lg flex flex-col gap-3 p-2"
        style={{
          width: "420px",
          height: "365px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-2">
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

        {/* Search Bar */}
        <div className="relative px-2">
          <Search className="absolute left-4 top-2.5 h-4 w-4 text-[#9F9F9F]" />
          <input
            type="text"
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-9 pr-3 py-1.5 rounded-lg border border-[#E5E5E5] font-geist font-normal text-sm text-[#0A0A0A] placeholder-[#737373] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>

        {/* Models List */}
        <div className="flex-1 overflow-y-auto px-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-[#757575]">Loading models...</div>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[#757575] text-sm">
              No models found
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleSelectModel(model.id)}
                  className={`flex items-start gap-3 p-2 rounded-lg transition-colors duration-300 cursor-pointer ${
                    selectedModelId === model.id
                      ? "bg-blue-50 border border-blue-300"
                      : "border border-[#E5E5E5] hover:bg-[#F5F5F5]"
                  }`}
                >
                  {/* Model Logo/Icon */}
                  <div className="shrink-0 mt-0.5">
                    {model.logo ? (
                      <img
                        src={model.logo}
                        alt={model.name}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-linear-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-semibold text-xs">
                        {model.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Model Name and Description */}
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-black truncate">
                      {model.name}
                    </p>
                    {model.description && (
                      <p className="text-xs text-[#757575] line-clamp-2">
                        {model.description}
                      </p>
                    )}
                  </div>

                  {/* Selection Indicator */}
                  {selectedModelId === model.id && (
                    <div className="shrink-0 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center mt-0.5">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer - Cancel and Select Buttons */}
        <div className="flex items-center justify-end gap-2 px-2 py-1 border-t border-[#E5E5E5]">
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
