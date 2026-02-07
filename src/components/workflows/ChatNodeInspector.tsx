"use client";

import React, { useState } from "react";
import { X, Trash2, ChevronRight } from "lucide-react";
import { WorkflowNodeData } from "./types";
import { SelectChatsDialog } from "./SelectChatsDialog";

interface ChatNodeInspectorProps {
  nodeData: WorkflowNodeData;
  onClose: () => void;
  onUpdate: (data: Partial<WorkflowNodeData>) => void;
  onDelete: () => void;
  allChats?: Array<{ id: string; name: string; pinnedDate?: string }>;
}

export function ChatNodeInspector({
  nodeData,
  onClose,
  onUpdate,
  onDelete,
  allChats = [],
}: ChatNodeInspectorProps) {
  const [nodeName, setNodeName] = useState<string>(nodeData.name || "");
  const [selectedChat, setSelectedChat] = useState<string | undefined>(
    Array.isArray(nodeData.selectedChats) ? nodeData.selectedChats[0] : (nodeData.selectedChats as string | undefined)
  );
  const [showSelectChatsDialog, setShowSelectChatsDialog] = useState(false);

  const handleSaveAndClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onUpdate({ 
      name: nodeName, 
      selectedChats: selectedChat
    });
    onClose();
  };

  const handleSelectChat = (chatId: string) => {
    setSelectedChat(chatId);
    setShowSelectChatsDialog(false);
  };

  const handleRemoveChat = () => {
    setSelectedChat(undefined);
  };

  const selectedChatData = allChats.find((c) => c.id === selectedChat);

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
              Chats
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
            className="w-full h-8 px-3 py-2 rounded-[8px] border border-[#E5E5E5] text-sm text-black placeholder-[#9F9F9F] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            placeholder="Enter node name"
          />
        </div>

        {/* Select Chat Section */}
        <div className="flex flex-col gap-2">
          <label className="font-geist font-medium text-sm text-[#0A0A0A]">
            Select Chat
          </label>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSelectChatsDialog(true);
            }}
            className="cursor-pointer w-full h-8 px-3 py-2 rounded-[8px] border border-[#D4D4D4] bg-white text-sm text-black hover:bg-[#F5F5F5] transition-colors flex items-center justify-between"
          >
            <span className="text-[#757575]">
              {selectedChat ? "Change Chat" : "Select Chat"}
            </span>
            <ChevronRight className="h-4 w-4 text-[#757575]" />
          </button>
        </div>

        {/* Selected Chat Card */}
        {selectedChatData && (
          <div className="relative rounded-lg border border-[#E5E5E5] bg-white p-3">
            {/* X Button - Top Right */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveChat();
              }}
              className="absolute top-2 right-2 text-[#757575] hover:text-red-600 transition-colors cursor-pointer"
              aria-label="Remove chat"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Chat Content */}
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-black truncate pr-6">
                {selectedChatData.name}
              </p>
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

      {/* Select Chat Dialog */}
      {showSelectChatsDialog && (
        <SelectChatsDialog
          allChats={allChats}
          selectedChatId={selectedChat}
          onClose={() => setShowSelectChatsDialog(false)}
          onSelect={handleSelectChat}
        />
      )}
    </>
  );
}
