"use client";

import React, { memo, useState } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "reactflow";
import Image from "next/image";
import {
  Files,
  MessagesSquare,
  Pin,
  SquareUser,
  BrainCircuit,
  Edit2,
  Copy,
  Plus,
  Play,
  Flag,
  Check,
  MoreVertical,
} from "lucide-react";
import { WorkflowNodeData, NodeType } from "./types";
import { getModelIcon } from "@/lib/model-icons";

let id = 0;
const getId = () => `node_${id++}`;

const iconMap = {
  start: Play,
  end: Flag,
  document: Files,
  chat: MessagesSquare,
  pin: Pin,
  persona: SquareUser,
  model: BrainCircuit,
};

const statusColors = {
  idle: "bg-zinc-100 text-zinc-600 border-zinc-300",
  running: "bg-blue-100 text-blue-600 border-blue-300",
  success: "bg-green-100 text-green-600 border-green-300",
  error: "bg-red-100 text-red-600 border-red-300",
};

const nodeTypeColors = {
  start: "text-[#00812F] bg-[#D8FDE4] border-[#00812F]/30",
  end: "text-[#00812F] bg-[#D8FDE4] border-[#00812F]/30",
  document: "text-[#B47800] bg-[#FBEEB1] border-[#B47800]/30",
  chat: "text-[#B47800] bg-[#FBEEB1] border-[#B47800]/30",
  pin: "text-[#B47800] bg-[#FBEEB1] border-[#B47800]/30",
  persona: "text-[#3C6CFF] bg-[#E5EBFD] border-[#3C6CFF]/30",
  model: "text-[#3C6CFF] bg-[#E5EBFD] border-[#3C6CFF]/30",
};

function CustomNode({
  data,
  selected,
  id: nodeId,
}: NodeProps<WorkflowNodeData>) {
  const Icon = (iconMap as any)[data.type as NodeType] || null;
  const statusColor = statusColors[data.status];
  const [isHovered, setIsHovered] = useState(false);
  const { setNodes, getNodes } = useReactFlow();

  // Check if this node type is highlighted
  const isHighlighted = data.isHighlighted && !selected;

  const handleInstructionsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onOpenInstructions) {
      data.onOpenInstructions();
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Clicking edit willllll select the noooooode, triggering the inspector to open
    // This is handled by the parent component
  };

  // const handleDuplicate = (e: React.MouseEvent) => {
  //   e.stopPropagation();
  //   const currentNodes = getNodes();
  //   const currentNode = currentNodes.find(n => n.id === nodeId);
  //   if (!currentNode) return;

  //   const newNode = {
  //     ...currentNode,
  //     id: getId(),
  //     position: {
  //       x: currentNode.position.x + 50,
  //       y: currentNode.position.y + 50,
  //     },
  //     selected: false,
  //   };

  //   setNodes((nds) => [...nds, newNode]);
  // };

  if (data.type === 'phantom') {
    return (
      <div
        className="relative w-[256px] h-24 text-center text-[#757575] bg-[#F2F2F2] border-2 border-dashed dash border-[#8B8B8B] rounded-[16px] flex items-center justify-center gap-4 p-4 transition-all"
      >
        {/* Phantom handles - hidden but allow connections */}
        <Handle
          type="target"
          position={Position.Left}
          className="invisible w-3! h-3!"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="invisible w-3! h-3!"
        />

        <div className="flex flex-col items-center justify-center gap-1">
          <h3 className="font-semibold leading-[140%] text-base text-[#757575]">
            {data.label || 'Add a node'}
          </h3>
          <p className="leading-[140%] text-center text-sm text-[#757575]">
            {data.description || 'Drag and drop a reasoning node from the top left menu to start.'}
          </p>
        </div>
      </div>
    );
  }

  // Context nodes (document, chat, pin) are source-only and cannot receive connections
  const isContextNode = data.type === 'document' || data.type === 'chat' || data.type === 'pin';

  return (
    <div
      className="relative bg-transparent transition-all"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ width: '280px' }}
    >
      {/* Input Handle - Disabled for context nodes (document, chat, pin) and start node */}
      {!isContextNode && data.type !== 'start' && (
        <Handle
          type="target"
          position={Position.Left}
          className="z-3 w-3! h-3! bg-blue-500! border-2! border-white!"
        />
      )}

      {/* Node Type Badge - Top of the card */}
      <div 
        className={`absolute -top-7 left-0 flex items-center rounded-tl-[16px] rounded-tr-[16px] ${nodeTypeColors[data.type as NodeType]}`}
        style={{
          width: 'auto',
          height: '28px',
          padding: '4px 16px',
          gap: '4px',
          opacity: 1
        }}
      >
        {Icon ? <Icon className="w-4 h-4" /> : null}
        <span className="capitalize font-semibold text-xs truncate">
          {data.type}
        </span>
      </div>

      {/* Node Type Filler - Top of the card */}
      <div className={`absolute top-0 left-0 max-w-[130px] w-full h-full rounded-b-[16px] ${nodeTypeColors[data.type as NodeType]}`}></div>

      {/* Node Content */}
      <div 
        className={`relative bg-white rounded-[16px] shadow-sm shadow-zinc-400 flex flex-col border transition-all ${nodeTypeColors[data.type as NodeType]} ${
          selected
            ? "border-blue-500 shadow-lg ring-2 ring-blue-200"
            : isHighlighted
              ? "border-blue-300 shadow-md ring-2 ring-blue-100"
              : "border-[#E5E5E5]"
        }`}
        style={{ 
          width: '280px',
          minHeight: '88px',
          gap: '8px',
          padding: '16px',
          opacity: 1
        }}
      >
        {/* Header with Label and Actions - justify-between */}
        <div className="flex items-center justify-between w-full">
          <h3 className="font-semibold text-sm text-[#1E1E1E] capitalize truncate flex-1">
            {data.label || `${data.type} Node`}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-xs px-2 py-0.5 border rounded-full ${statusColor}`}
            >
              {data.status}
            </span>
            {data.type !== 'start' && data.type !== 'phantom' && data.type !== 'end' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Implement node menu
                }}
                className="cursor-pointer p-0.5 hover:bg-[#F5F5F5] rounded transition-colors"
              >
                <MoreVertical size={16} className="text-[#757575]" />
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-[#757575] line-clamp-2">
          {data.description || `Configure ${data.type} node settings`}
        </p>

        {/* Persona Display - Show selected persona */}
        {data.type === 'persona' && (
          data.personaData ? (
            <div className="flex items-center gap-2 mt-1 p-2 bg-[#F5F5F5] rounded-lg">
              {data.personaData.image ? (
                <Image
                  src={data.personaData.image}
                  alt={data.personaData.name}
                  width={32}
                  height={32}
                  className="rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                  {data.personaData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-black truncate">
                  {data.personaData.name}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-xs text-[#9F9F9F] italic mt-1">
              No persona selected
            </div>
          )
        )}

        {/* Persona Display for Chat Nodes - Same rendering as Persona nodes */}
        {data.type === 'chat' && data.personaData && (
          <div className="flex items-center gap-2 mt-1 p-2 bg-[#F5F5F5] rounded-lg">
            {data.personaData.image ? (
              <Image
                src={data.personaData.image}
                alt={data.personaData.name}
                width={32}
                height={32}
                className="rounded object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                {data.personaData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-black truncate">
                {data.personaData.name}
              </p>
            </div>
          </div>
        )}

        {/* Model Display - Show selected model */}
        {data.type === 'model' && (
          data.modelData ? (
            <div className="flex items-center gap-2 mt-1 p-2 bg-[#F5F5F5] rounded-lg">
              <Image
                src={getModelIcon(data.modelData.companyName || '', data.modelData.name, data.modelData.sdkLibrary)}
                alt={`${data.modelData.name} logo`}
                width={32}
                height={32}
                className="shrink-0 rounded object-cover"
                style={{ borderRadius: '4px' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-black truncate">
                  {data.modelData.name}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-xs text-[#9F9F9F] italic mt-1">
              No model selected
            </div>
          )
        )}

        {/* File count for document nodes */}
        {data.type === 'document' && data.files && data.files.length > 0 && (
          <div className="text-xs text-[#5B5B5B] mt-1">
            {data.files.length} file{data.files.length !== 1 ? 's' : ''} attached
          </div>
        )}

        {/* Chat count for chat nodes */}
        {data.type === 'chat' && data.selectedChats && (data.selectedChats as string[]).length > 0 && (
          <div className="text-xs text-[#5B5B5B] mt-1">
            {(data.selectedChats as string[]).length} chat{(data.selectedChats as string[]).length !== 1 ? 's' : ''} attached
          </div>
        )}

        {/* Pin count for pin nodes */}
        {data.type === 'pin' && data.selectedPins && (data.selectedPins as string[]).length > 0 && (
          <div className="text-xs text-[#5B5B5B] mt-1">
            {(data.selectedPins as string[]).length} pin{(data.selectedPins as string[]).length !== 1 ? 's' : ''} attached
          </div>
        )}

        {/* Instructions CTA - Show for all nodes except end node */}
        {data.type !== 'end' && (
          <button 
            onClick={handleInstructionsClick}
            className={`cursor-pointer absolute -bottom-7 left-1/2 -translate-x-1/2 h-[25px] rounded-2xl border py-1 px-2 gap-1 shadow-md bg-white flex items-center justify-center text-xs font-medium hover:bg-[#E5E5E5] transition-colors whitespace-nowrap z-10 ${
              data.type === 'model' && (!data.instructions || !data.instructions.trim())
                ? 'border-red-300 text-red-600'
                : 'border-[#E5E5E5] text-[#1E1E1E]'
            }`}
          >
            {data.instructions && data.instructions.trim() ? (
              <>
                <Check size={14} className="text-green-600" />
                Instructions added
              </>
            ) : data.type === 'model' ? (
              <>
                <Plus size={14} />
                Instructions (Required)
              </>
            ) : (
              <>
                <Plus size={14} />
                Instructions
              </>
            )}
          </button>
        )}
      </div>

      {/* Output Handle - Only for non-end nodes */}
      {data.type !== 'end' && (
        <Handle
          type="source"
          position={Position.Right}
          className="z-3 w-3! h-3! bg-green-500! border-2! border-white!"
        />
      )}
    </div>
  );
}

export default memo(CustomNode);
