'use client';

import React, { useState } from 'react';
import { Files, MessagesSquare, Pin, SquareUser, BrainCircuit, GripVertical } from 'lucide-react';
import { NodeType } from './types';

const nodeItems = [
  {
    category: 'CONTEXT',
    nodes: [
      { type: 'document' as NodeType, label: 'Documents', icon: Files },
      { type: 'chat' as NodeType, label: 'Chats', icon: MessagesSquare },
      { type: 'pin' as NodeType, label: 'Pins', icon: Pin },
    ],
  },
  {
    category: 'REASONING',
    nodes: [
      { type: 'persona' as NodeType, label: 'Agents / Persona', icon: SquareUser },
      { type: 'model' as NodeType, label: 'Models', icon: BrainCircuit },
    ],
  },
];

interface LeftSidebarProps {
  onDragStart: (event: React.DragEvent, nodeType: NodeType) => void;
}

export default function LeftSidebar({ onDragStart }: LeftSidebarProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  return (
    <div className="absolute top-15 left-3 w-60 bg-white border border-[#E5E5E5] rounded-2xl pt-3 px-2 pb-2 z-40 shadow-sm">
      {nodeItems.map((category) => (
        <div key={category.category} className="mb-4 last:mb-0">
          {/* Category Header */}
          <div className="text-[#757575] text-xs font-medium uppercase mb-2 px-2">
            {category.category}
          </div>

          {/* Node Items */}
          <div className="space-y-1">
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
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-all cursor-grab active:cursor-grabbing ${
                    isHovered ? 'bg-gray-50' : 'bg-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-[34px] h-[34px] rounded-[8px] p-[8px] flex items-center justify-center bg-white border border-gray-200">
                      <Icon className="w-full h-full text-gray-700" />
                    </div>
                    <span className="text-sm text-gray-900">{node.label}</span>
                  </div>
                  {isHovered && (
                    <GripVertical className="w-4 h-4 text-gray-400" />
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
