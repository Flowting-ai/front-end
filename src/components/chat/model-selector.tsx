"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { ModelSelectorDialog } from "./model-selector-dialog";
import { ModelSwitchDialog, type ModelSwitchConfig } from "./model-switch-dialog";
import type { AIModel } from "@/types/ai-model";
import type { PinType } from "@/components/layout/right-sidebar";
import { getModelIcon } from "@/lib/model-icons";
import Image from "next/image";

interface ModelSelectorProps {
  selectedModel: AIModel | null;
  useFramework: boolean;
  onModelSelect: (model: AIModel | null) => void;
  onFrameworkChange: (useFramework: boolean) => void;
  chatBoards?: Array<{ id: string; name: string }>;
  activeChatId?: string | null;
  hasMessages?: boolean;
  pins?: PinType[];
}

export function ModelSelector({
  selectedModel,
  onModelSelect,
  useFramework,
  onFrameworkChange,
  chatBoards = [],
  activeChatId,
  hasMessages = false,
  pins = [],
}: ModelSelectorProps) {
  const [isSelectorDialogOpen, setIsSelectorDialogOpen] = useState(false);
  const [isSwitchDialogOpen, setIsSwitchDialogOpen] = useState(false);
  const [chatModelHistory, setChatModelHistory] = useState<Record<string, { model: AIModel | null; useFramework: boolean }>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatModelHistory');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });

  // Save chat model history to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatModelHistory', JSON.stringify(chatModelHistory));
    }
  }, [chatModelHistory]);

  // Track current model for active chat
  useEffect(() => {
    if (activeChatId && (selectedModel || useFramework)) {
      setChatModelHistory(prev => ({
        ...prev,
        [activeChatId]: { model: selectedModel, useFramework }
      }));
    } else if (activeChatId && !selectedModel && !useFramework && !chatModelHistory[activeChatId]) {
      // New chat with no selection - default to framework
      onFrameworkChange(true);
      onModelSelect(null);
    }
  }, [activeChatId, selectedModel, useFramework]);

  // Restore model when switching chats (only on mount or when activeChatId changes)
  useEffect(() => {
    if (activeChatId && chatModelHistory[activeChatId]) {
      const history = chatModelHistory[activeChatId];
      const currentlyUsingFramework = useFramework;
      const currentModel = selectedModel;
      
      // Only update if different from current state
      if (history.useFramework && !currentlyUsingFramework) {
        onFrameworkChange(true);
        onModelSelect(null);
      } else if (!history.useFramework && history.model) {
        const isDifferent = !currentModel || currentModel.modelName !== history.model.modelName;
        if (isDifferent) {
          onFrameworkChange(false);
          onModelSelect(history.model);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId]);

  const handleOpenDialog = () => {
    // Show ModelSelectorDialog for new chats or first-time selection
    // Show ModelSwitchDialog for existing chats with messages
    if (hasMessages && (selectedModel || useFramework)) {
      setIsSwitchDialogOpen(true);
    } else {
      setIsSelectorDialogOpen(true);
    }
  };

  const handleModelSelect = (model: AIModel) => {
    onFrameworkChange(false);
    onModelSelect(model);
    setIsSelectorDialogOpen(false);
  };

  const handleModelSwitch = (config: ModelSwitchConfig) => {
    onFrameworkChange(false);
    onModelSelect(config.model);
    // TODO: Handle additional config like chatMemory, includePins, includeFiles if needed
  };

  const handleFrameworkSelect = () => {
    onFrameworkChange(true);
    onModelSelect(null);
    setIsSelectorDialogOpen(false);
    setIsSwitchDialogOpen(false);
  };

  return (
    <>
      <button
        className="group cursor-pointer w-auto h-[33px] text-[#171717] hover:text-white bg-zinc-100 hover:bg-[#171717] border-2 border-main-border hover:border-[#171717] rounded-[7px] inline-flex items-center gap-1.5 py-0 px-3 transition-all duration-300"
        onClick={handleOpenDialog}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isSelectorDialogOpen || isSwitchDialogOpen}
      >
        {useFramework ? (
          <span className="w-5 h-5 bg-zinc-100 group-hover:bg-zinc-100 rounded-full shrink-0 inline-flex items-center justify-center p-0.5 transition-all duration-500">
            <Image src="/icons/logo.png" alt="Flowting AI" width={16} height={16}/>
          </span>
        ) : selectedModel ? (
          <span className="w-5 h-5 bg-zinc-100 group-hover:bg-zinc-100 rounded-full shrink-0 inline-flex items-center justify-center p-0.5 transition-all duration-500">
            <Image
              src={getModelIcon(
                selectedModel?.companyName,
                selectedModel?.modelName,
                selectedModel?.sdkLibrary
              )}
              alt="Model icon"
              width={16}
              height={16}
            />
          </span>
        ) : null}
        <span className="model-selector-label font-inter font-[400] text-[14px] whitespace-nowrap">
          {useFramework
            ? "Flowting AI Framework"
            : selectedModel
            ? selectedModel.modelName
            : "Select model"}
        </span>
        <ChevronDown className="w-[16px] h-[16px] shrink-0" strokeWidth={2} />
      </button>
      <ModelSelectorDialog
        open={isSelectorDialogOpen}
        onOpenChange={setIsSelectorDialogOpen}
        onModelSelect={handleModelSelect}
        onFrameworkSelect={handleFrameworkSelect}
        useFramework={useFramework}
      />
      <ModelSwitchDialog
        open={isSwitchDialogOpen}
        onOpenChange={setIsSwitchDialogOpen}
        currentModel={selectedModel}
        onModelSwitch={handleModelSwitch}
        onFrameworkSelect={handleFrameworkSelect}
        chatBoards={chatBoards}
        pins={pins}
      />
    </>
  );
}
