"use client";

import React, { useState } from "react";
import { X, Trash2, ArrowRight, ChevronRight } from "lucide-react";
import Image from "next/image";
import { WorkflowNodeData } from "./types";
import { SelectChatsDialog } from "./SelectChatsDialog";
import { AddPersonaDialog } from "./AddPersonaDialog";

interface Persona {
  id: string;
  name: string;
  description?: string;
  image?: string;
}

interface ChatNodeInspectorProps {
  nodeData: WorkflowNodeData;
  onClose: () => void;
  onUpdate: (data: Partial<WorkflowNodeData>) => void;
  onDelete: () => void;
  allChats?: Array<{ id: string; name: string; pinnedDate?: string }>;
  allPersonas?: Persona[];
}

export function ChatNodeInspector({
  nodeData,
  onClose,
  onUpdate,
  onDelete,
  allChats = [],
  allPersonas = [],
}: ChatNodeInspectorProps) {
  const [nodeName, setNodeName] = useState<string>(nodeData.name || nodeData.personaData?.name || "");
  const [selectedChats, setSelectedChats] = useState<string[]>(
    (nodeData.selectedChats as string[]) || []
  );
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | undefined>(
    nodeData.selectedPersona
  );
  const [showSelectChatsDialog, setShowSelectChatsDialog] = useState(false);
  const [showAddPersonaDialog, setShowAddPersonaDialog] = useState(false);

  const handleSaveAndClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    // Preserve existing personaData if selection hasn't changed
    const updateData: Partial<WorkflowNodeData> = { 
      name: nodeName, 
      selectedChats,
      selectedPersona: selectedPersonaId 
    };
    if (nodeData.personaData && selectedPersonaId === nodeData.selectedPersona) {
      updateData.personaData = nodeData.personaData;
    }
    onUpdate(updateData);
    onClose();
  };

  const handleAddChats = (chatIds: string[]) => {
    setSelectedChats(chatIds);
    setShowSelectChatsDialog(false);
  };

  const handleRemoveChat = (chatId: string) => {
    setSelectedChats((prev) => prev.filter((id) => id !== chatId));
  };

  const handleSelectPersona = (personaId: string) => {
    setSelectedPersonaId(personaId);
    const persona = allPersonas.find((p) => p.id === personaId);
    if (persona) {
      // Update node immediately with persona name and data
      setNodeName(persona.name);
      onUpdate({ 
        name: persona.name,
        selectedPersona: personaId,
        personaData: {
          name: persona.name,
          image: persona.image,
          description: persona.description,
        }
      });
    }
    setShowAddPersonaDialog(false);
  };

  const handleRemovePersona = () => {
    setSelectedPersonaId(undefined);
    onUpdate({ 
      selectedPersona: undefined,
      personaData: undefined,
    });
  };

  const selectedPersona = allPersonas.find((p) => p.id === selectedPersonaId);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
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

        {/* Select Persona Section */}
        <div className="flex flex-col gap-2">
          <label className="font-geist font-medium text-sm text-[#0A0A0A]">
            Select Persona
          </label>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAddPersonaDialog(true);
            }}
            className="cursor-pointer w-full h-8 px-3 py-2 rounded-[8px] border border-[#D4D4D4] bg-white text-sm text-black hover:bg-[#F5F5F5] transition-colors flex items-center justify-between"
          >
            <span className="text-[#757575]">
              {selectedPersonaId ? "Change Persona" : "Add Persona"}
            </span>
            <ChevronRight className="h-4 w-4 text-[#757575]" />
          </button>
        </div>

        {/* Selected Persona Card */}
        {selectedPersona && (
          <div className="relative rounded-lg border border-[#E5E5E5] bg-white p-3">
            {/* X Button - Top Right */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemovePersona();
              }}
              className="absolute top-2 right-2 text-[#757575] hover:text-red-600 transition-colors cursor-pointer"
              aria-label="Remove persona"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Persona Content */}
            <div className="flex items-start gap-3">
              {/* Persona Image or Initials */}
              <div className="flex-shrink-0">
                {selectedPersona.image ? (
                  <Image
                    src={selectedPersona.image}
                    alt={selectedPersona.name}
                    width={48}
                    height={48}
                    className="rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                    {getInitials(selectedPersona.name)}
                  </div>
                )}
              </div>

              {/* Persona Info */}
              <div className="flex-1 min-w-0 pr-6">
                <p className="text-sm font-medium text-black truncate">
                  {selectedPersona.name}
                </p>
                {selectedPersona.description && (
                  <p className="text-xs text-[#757575] line-clamp-2">
                    {selectedPersona.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Manage Chats Section */}
        <div className="flex flex-col gap-2">
          <label className="font-geist font-medium text-sm text-[#0A0A0A]">
            Manage Chats
          </label>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSelectChatsDialog(true);
            }}
            className="cursor-pointer w-full h-8 px-3 py-2 rounded-[8px] border border-[#D4D4D4] bg-white text-sm text-black hover:bg-[#F5F5F5] transition-colors flex items-center justify-between"
          >
            <span className="text-[#757575]">
              {selectedChats.length > 0
                ? `${selectedChats.length} chat${selectedChats.length !== 1 ? "s" : ""} selected`
                : "Select Chats"}
            </span>
            <ChevronRight className="h-4 w-4 text-[#757575]" />
          </button>
        </div>

        {/* Selected Chats Grid */}
        {selectedChats.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {selectedChats.map((chatId) => {
              const chat = allChats.find((c) => c.id === chatId);
              return (
                <div
                  key={chatId}
                  className="relative rounded-lg border border-[#E5E5E5] bg-white p-2"
                >
                  {/* X Button - Top Right */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveChat(chatId);
                    }}
                    className="absolute top-1 right-1 text-[#757575] hover:text-red-600 transition-colors cursor-pointer"
                    aria-label="Remove chat"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  {/* Chat Name */}
                  <p className="text-xs font-medium text-black truncate pr-5">
                    {chat?.name || chatId}
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

      {/* Select Chats Dialog */}
      {showSelectChatsDialog && (
        <SelectChatsDialog
          allChats={allChats}
          selectedChatIds={selectedChats}
          onClose={() => setShowSelectChatsDialog(false)}
          onAdd={handleAddChats}
        />
      )}

      {/* Add Persona Dialog */}
      {showAddPersonaDialog && (
        <AddPersonaDialog
          allPersonas={allPersonas}
          selectedPersonaId={selectedPersonaId}
          onClose={() => setShowAddPersonaDialog(false)}
          onSelect={handleSelectPersona}
        />
      )}
    </>
  );
}
