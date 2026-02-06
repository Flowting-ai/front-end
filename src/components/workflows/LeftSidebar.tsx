"use client";

import React, { useState } from "react";
import {
  Files,
  MessagesSquare,
  Pin,
  SquareUser,
  BrainCircuit,
  GripVertical,
} from "lucide-react";
import { NodeType } from "./types";
import { cn } from "@/lib/utils";

const nodeItems = [
  {
    category: "CONTEXT",
    nodes: [
      { type: "document" as NodeType, label: "Documents", icon: Files },
      { type: "chat" as NodeType, label: "Chats", icon: MessagesSquare },
      { type: "pin" as NodeType, label: "Pins", icon: Pin },
    ],
  },
  {
    category: "REASONING",
    nodes: [
      {
        type: "persona" as NodeType,
        label: "Persona",
        icon: SquareUser,
      },
      { type: "model" as NodeType, label: "Model", icon: BrainCircuit },
    ],
  },
];

interface LeftSidebarProps {
  onDragStart: (event: React.DragEvent, nodeType: NodeType) => void;
}

export default function LeftSidebar({ onDragStart }: LeftSidebarProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  return (
    <div className="overflow-hidden z-40 absolute top-15 left-3 w-60 bg-white border border-[#E5E5E5] rounded-2xl shadow-sm pt-3 px-2 pb-2">
      {nodeItems.map((category) => (
        <div key={category.category} className="mb-4 last:mb-0">
          {/* Category Header */}
          <div className="font-semibold uppercase text-[11px] text-[#757575] px-2 mb-2">
            {category.category}
          </div>

          {/* Node Items */}
          <div className="space-y-0">
            {category.nodes.map((node) => {
              const Icon = node.icon;
              const nodeKey = `${category.category}-${node.type}`;
              const isHovered = hoveredNode === nodeKey;

              return (
                <div
                  key={node.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, node.type)}
                  onMouseEnter={() => setHoveredNode(nodeKey)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className={`cursor-grab active:cursor-grabbing rounded-lg flex items-center justify-between transition-all pl-2 pr-4 py-1 ${
                    isHovered ? "bg-[#F5F5F5]" : "bg-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-8.5 h-8.5 bg-white border border-gray-200 rounded-[8px] flex items-center justify-center p-2",
                        category.category === "CONTEXT"
                          ? "text-[#B47800] bg-[#FBEEB1]"
                          : "text-[#3C6CFF] bg-[#E5EBFD]",
                      )}
                    >
                      <Icon className="w-full h-full" />
                    </div>
                    <span className="font-semibold text-sm text-[#303030]">
                      {node.label}
                    </span>
                  </div>
                  {isHovered && (
                    <GripVertical className="w-4 h-4 text-zinc-400" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
