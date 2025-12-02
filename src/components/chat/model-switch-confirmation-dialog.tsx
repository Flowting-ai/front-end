"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AIModel } from "@/types/ai-model";
import { getModelIcon } from "@/lib/model-icons";
import { AlertCircle } from "lucide-react";

interface ModelSwitchConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentModel: AIModel;
  newModel: AIModel;
  onConfirm: () => void;
}

export function ModelSwitchConfirmationDialog({
  open,
  onOpenChange,
  currentModel,
  newModel,
  onConfirm,
}: ModelSwitchConfirmationDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="bg-white p-0" 
        style={{ 
          width: "440px", 
          maxWidth: "440px", 
          borderRadius: "12px", 
          border: "1px solid #e6e6e6",
          overflow: "hidden"
        }}
      >
        {/* Header Section with Icon and Title */}
        <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF4E6]">
            <AlertCircle className="h-6 w-6 text-[#F97316]" strokeWidth={2} />
          </div>
          <DialogHeader className="text-center space-y-2">
            <DialogTitle className="text-[#171717] text-lg font-semibold">
              Switch Model?
            </DialogTitle>
            <DialogDescription className="text-[#737373] text-sm leading-relaxed">
              Switching models will start a new conversation. Your current chat history will not be carried over to the new model.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Model Comparison Section */}
        <div className="px-6 pb-6 space-y-3">
          {/* Current Model */}
          <div className="flex items-center gap-3 rounded-lg border border-[#e6e6e6] bg-[#fafafa] px-4 py-3">
            <div className="flex-shrink-0">
              <img
                src={getModelIcon(currentModel.companyName, currentModel.modelName)}
                alt={currentModel.companyName}
                className="h-8 w-8 rounded"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[#737373] font-medium">Current Model</div>
              <div className="text-sm text-[#171717] font-semibold truncate">
                {currentModel.modelName}
              </div>
            </div>
          </div>

          {/* Arrow Separator */}
          <div className="flex justify-center">
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 16 16" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              className="text-[#a3a3a3]"
            >
              <path 
                d="M8 2L8 14M8 14L12 10M8 14L4 10" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* New Model */}
          <div className="flex items-center gap-3 rounded-lg border border-[#e6e6e6] bg-white px-4 py-3">
            <div className="flex-shrink-0">
              <img
                src={getModelIcon(newModel.companyName, newModel.modelName)}
                alt={newModel.companyName}
                className="h-8 w-8 rounded"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[#737373] font-medium">New Model</div>
              <div className="text-sm text-[#171717] font-semibold truncate">
                {newModel.modelName}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-[#e6e6e6] bg-[#fafafa] px-6 py-4">
          <Button
            variant="ghost"
            onClick={handleCancel}
            className="rounded-lg px-4 h-9 text-sm font-medium text-[#171717] hover:bg-[#e6e6e6]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="rounded-lg px-4 h-9 text-sm font-medium bg-[#171717] text-white hover:bg-[#2c2c2c]"
          >
            Switch Model
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
