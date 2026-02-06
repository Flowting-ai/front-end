"use client";

import React, { useState } from "react";
import { X, Trash2, ArrowRight } from "lucide-react";
import { WorkflowNodeData } from "./types";
import { SelectModelDialog } from "./SelectModelDialog";

interface Model {
  id: string;
  name: string;
  description?: string;
  logo?: string;
}

interface ModelNodeInspectorProps {
  nodeData: WorkflowNodeData;
  onClose: () => void;
  onUpdate: (data: Partial<WorkflowNodeData>) => void;
  onDelete: () => void;
  allModels?: Model[];
}

export function ModelNodeInspector({
  nodeData,
  onClose,
  onUpdate,
  onDelete,
  allModels = [],
}: ModelNodeInspectorProps) {
  const [nodeName, setNodeName] = useState<string>(nodeData.name || "");
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(
    nodeData.selectedModel
  );
  const [showSelectModelDialog, setShowSelectModelDialog] = useState(false);

  const handleSaveAndClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onUpdate({ name: nodeName, selectedModel: selectedModelId });
    onClose();
  };

  const handleSelectModel = (modelId: string) => {
    setSelectedModelId(modelId);
    setShowSelectModelDialog(false);
  };

  const handleRemoveModel = () => {
    setSelectedModelId(undefined);
  };

  const selectedModel = allModels.find((m) => m.id === selectedModelId);

  return (
    <>
      <div
        className="absolute top-4 right-4 w-90 rounded-2xl border border-[#E5E5E5] bg-white shadow-lg p-3 flex flex-col gap-3 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[#2C2C2C] leading-[140%]">
              Model
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="cursor-pointer text-[#757575] hover:text-red-600 transition-colors"
                aria-label="Delete node"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="cursor-pointer text-[#757575] hover:text-black transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Description */}
          <p className="font-normal text-sm text-[#757575]">
            Powers the reasoning engine.
          </p>
        </div>

        {/* Node Name Section */}
        <div className="flex flex-col gap-2">
          <label className="font-geist font-medium text-sm text-[#0A0A0A]">
            Node Name
          </label>
          <input
            type="text"
            value={nodeName}
            onChange={(e) => setNodeName(e.target.value)}
            className="w-full h-8 px-3 py-2 rounded-lg border border-[#E5E5E5] text-sm text-black placeholder-[#9F9F9F] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            placeholder="Enter node name"
          />
        </div>

        {/* Select Model Section */}
        <div className="flex flex-col gap-2">
          <label className="font-geist font-medium text-sm text-[#0A0A0A]">
            Select Model
          </label>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSelectModelDialog(true);
            }}
            className="cursor-pointer w-full h-8 px-3 py-2 rounded-lg border border-[#D4D4D4] bg-white text-sm text-black hover:bg-[#F5F5F5] transition-colors flex items-center justify-between"
          >
            <span className="text-[#757575]">
              {selectedModelId ? "Change Model" : "Add Model"}
            </span>
            <ArrowRight className="h-4 w-4 text-[#757575]" />
          </button>
        </div>

        {/* Selected Model Card */}
        {selectedModel && (
          <div className="relative rounded-lg border border-[#E5E5E5] bg-white p-3">
            {/* X Button - Top Right */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveModel();
              }}
              className="absolute top-2 right-2 text-[#757575] hover:text-red-600 transition-colors cursor-pointer"
              aria-label="Remove model"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Model Content */}
            <div className="flex items-start gap-3">
              {/* Model Logo/Icon */}
              <div className="shrink-0">
                {selectedModel.logo ? (
                  <img
                    src={selectedModel.logo}
                    alt={selectedModel.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-linear-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                    {selectedModel.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Model Info */}
              <div className="flex-1 min-w-0 pr-6">
                <p className="text-sm font-medium text-black truncate">
                  {selectedModel.name}
                </p>
                {selectedModel.description && (
                  <p className="text-xs text-[#757575] truncate">
                    {selectedModel.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSaveAndClose}
          className="cursor-pointer w-full h-9 rounded-lg bg-[#2C2C2C] text-white text-sm font-medium hover:bg-[#1F1F1F] transition-colors mt-2"
        >
          Save & Close
        </button>
      </div>

      {/* Select Model Dialog */}
      {showSelectModelDialog && (
        <SelectModelDialog
          allModels={allModels}
          selectedModelId={selectedModelId}
          onClose={() => setShowSelectModelDialog(false)}
          onSelect={handleSelectModel}
        />
      )}
    </>
  );
}
