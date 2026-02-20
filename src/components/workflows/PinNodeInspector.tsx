"use client";

import React, { useState, useEffect } from "react";
import { X, Trash2, ArrowRight, ChevronRight } from "lucide-react";
import { WorkflowNodeData } from "./types";
import { SelectPinsDialog } from "./SelectPinsDialog";
import { toast } from "@/lib/toast-helper";

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
    Array.isArray(nodeData.selectedPins) ? nodeData.selectedPins : []
  );
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string; pinIds: string[] } | undefined>(
    nodeData.selectedFolder
  );
  const [showSelectPinsDialog, setShowSelectPinsDialog] = useState(false);

  // Update local state when nodeData changes (switching between nodes)
  useEffect(() => {
    setNodeName(nodeData.name || "");
    setSelectedPins(Array.isArray(nodeData.selectedPins) ? nodeData.selectedPins : []);
    setSelectedFolder(nodeData.selectedFolder);
  }, [nodeData]);

  const handleSaveAndClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onUpdate({ 
      name: nodeName, 
      selectedPins,
      selectedFolder
    });
    onClose();
  };

  const handleAddPins = (pinIds: string[]) => {
    setSelectedPins(pinIds);
    setSelectedFolder(undefined); // Clear folder when selecting individual pins
    setShowSelectPinsDialog(false);
    toast.success(`${pinIds.length} pin${pinIds.length !== 1 ? 's' : ''} attached`);
  };

  const handleAddFolder = (folder: { id: string; name: string; pinIds: string[] }) => {
    setSelectedFolder(folder);
    setSelectedPins([]); // Clear individual pins when selecting folder
    setShowSelectPinsDialog(false);
    toast.success(`Folder "${folder.name}" attached with ${folder.pinIds.length} pins`);
  };

  const handleRemovePin = (pinId: string) => {
    setSelectedPins(prev => prev.filter(id => id !== pinId));
    toast.info("Pin removed");
  };

  const handleRemoveFolder = () => {
    setSelectedFolder(undefined);
    toast.info("Folder removed");
  };

  const hasAttachments = selectedPins.length > 0 || selectedFolder !== undefined;

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

        {/* Select Pin Section */}
        <div className="flex flex-col gap-2">
          <label className="font-geist font-medium text-sm text-[#0A0A0A]">
            {selectedFolder 
              ? `${selectedFolder.name} attached with ${selectedFolder.pinIds.length} ${selectedFolder.pinIds.length === 1 ? 'pin' : 'pins'}` 
              : selectedPins.length > 0 
                ? `${selectedPins.length} ${selectedPins.length === 1 ? 'pin' : 'pins'} attached (${selectedPins.length}/10)` 
                : 'No pins attached'}
          </label>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSelectPinsDialog(true);
            }}
            className="cursor-pointer w-full h-8 px-3 py-2 rounded-lg border border-[#D4D4D4] bg-white text-sm text-black hover:bg-[#F5F5F5] transition-colors flex items-center justify-between"
          >
            <span className="text-[#757575]">
              {hasAttachments ? "Change Selection" : "Add Pins or Folder"}
            </span>
            <ChevronRight className="h-4 w-4 text-[#757575]" />
          </button>
        </div>

        {/* Selected Folder Display */}
        {selectedFolder && (
          <div className="flex flex-col gap-2">
            <div className="relative rounded-lg border border-[#E5E5E5] bg-[#E5F2FF] p-2">
              {/* X Button - Top Right */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFolder();
                }}
                className="absolute top-1 right-1 text-[#757575] hover:text-red-600 transition-colors cursor-pointer"
                aria-label="Remove folder"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Folder Info */}
              <div className="flex items-start gap-2 pr-5">
                <ArrowRight className="h-4 w-4 text-[#3C6CFF] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-black">{selectedFolder.name}</p>
                  <p className="text-[10px] text-[#757575] mt-0.5">
                    {selectedFolder.pinIds.length} pin{selectedFolder.pinIds.length !== 1 ? 's' : ''} included
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Selected Pins Display */}
        {selectedPins.length > 0 && !selectedFolder && (
          <div className="flex flex-col gap-2">
            <div className="max-h-40 overflow-y-auto space-y-1">
              {selectedPins.map((pinId) => {
                const pin = allPins.find((p) => p.id === pinId);
                return (
                  <div
                    key={pinId}
                    className="relative rounded-lg border border-[#E5E5E5] bg-white p-2"
                  >
                    {/* X Button */}
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
          </div>
        )}

        {/* No Pins Attached Display */}
        {!selectedFolder && selectedPins.length === 0 && (
          <div className="flex flex-col gap-2">
            <div className="rounded-lg border border-[#E5E5E5] bg-[#F5F5F5] p-3 text-center">
              <p className="text-xs text-[#757575]">No pins attached</p>
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

      {/* Select Pin Dialog */}
      {showSelectPinsDialog && (
        <SelectPinsDialog
          allPins={allPins}
          selectedPinIds={selectedPins}
          selectedFolder={selectedFolder}
          onClose={() => setShowSelectPinsDialog(false)}
          onAddPins={handleAddPins}
          onAddFolder={handleAddFolder}
        />
      )}
    </>
  );
}
