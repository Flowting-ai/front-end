"use client";

import React, { useState } from "react";
import { X, Trash2, ArrowRight, ChevronRight } from "lucide-react";
import { WorkflowNodeData } from "./types";
import { SelectPinsDialog } from "./SelectPinsDialog";

interface PinNodeInspectorProps {
  nodeData: WorkflowNodeData;
  onClose: () => void;
  onUpdate: (data: Partial<WorkflowNodeData>) => void;
  onDelete: () => void;
  allPins?: Array<{ id: string; name: string; pinnedDate?: string }>;
}

export function PinNodeInspector({
  nodeData,
  onClose,
  onUpdate,
  onDelete,
  allPins = [],
}: PinNodeInspectorProps) {
  const [nodeName, setNodeName] = useState<string>(nodeData.name || "");
  const [selectedPins, setSelectedPins] = useState<string[]>(
    (nodeData.selectedPins as string[]) || []
  );
  const [showSelectPinsDialog, setShowSelectPinsDialog] = useState(false);

  const handleSaveAndClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onUpdate({ name: nodeName, selectedPins });
    onClose();
  };

  const handleAddPins = (pinIds: string[]) => {
    setSelectedPins(pinIds);
    setShowSelectPinsDialog(false);
  };

  const handleRemovePin = (pinId: string) => {
    setSelectedPins((prev) => prev.filter((id) => id !== pinId));
  };

  return (
    <>
      <div
        className="absolute top-4 right-4 w-[360px] rounded-2xl border border-[#E5E5E5] bg-white shadow-lg p-3 flex flex-col gap-3 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[#2C2C2C] leading-[140%]">
              Pins
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
            Provides context for connected nodes.
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

        {/* Manage Pins Section */}
        <div className="flex flex-col gap-2">
          <label className="font-geist font-medium text-sm text-[#0A0A0A]">
            Manage Pins
          </label>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSelectPinsDialog(true);
            }}
            className="cursor-pointer w-full h-8 px-3 py-2 rounded-lg border border-[#D4D4D4] bg-white text-sm text-black hover:bg-[#F5F5F5] transition-colors flex items-center justify-between"
          >
            <span className="text-[#757575]">
              {selectedPins.length > 0
                ? `${selectedPins.length} pin${selectedPins.length !== 1 ? "s" : ""} selected`
                : "Select Pins"}
            </span>
            <ChevronRight className="h-4 w-4 text-[#757575]" />
          </button>
        </div>

        {/* Selected Pins Grid */}
        {selectedPins.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {selectedPins.map((pinId) => {
              const pin = allPins.find((p) => p.id === pinId);
              return (
                <div
                  key={pinId}
                  className="relative rounded-lg border border-[#E5E5E5] bg-white p-2"
                >
                  {/* X Button - Top Right */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemovePin(pinId);
                    }}
                    className="absolute top-1 right-1 text-[#757575] hover:text-red-600 transition-colors cursor-pointer"
                    aria-label="Remove pin"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  {/* Pin Title */}
                  <p className="text-xs font-medium text-black truncate pr-5" title={pin?.name || pinId}>
                    {pin?.name || pinId}
                  </p>
                </div>
              );
            })}
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

      {/* Select Pins Dialog */}
      {showSelectPinsDialog && (
        <SelectPinsDialog
          allPins={allPins}
          selectedPinIds={selectedPins}
          onClose={() => setShowSelectPinsDialog(false)}
          onAdd={handleAddPins}
        />
      )}
    </>
  );
}
