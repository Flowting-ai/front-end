'use client';

import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { Files, MessagesSquare, Pin, SquareUser, BrainCircuit, Edit2, Copy } from 'lucide-react';
import { WorkflowNodeData, NodeType } from './types';

let id = 0;
const getId = () => `node_${id++}`;

const iconMap = {
  document: Files,
  chat: MessagesSquare,
  pin: Pin,
  persona: SquareUser,
  model: BrainCircuit,
};

const statusColors = {
  idle: 'bg-gray-100 text-gray-600',
  running: 'bg-blue-100 text-blue-600',
  success: 'bg-green-100 text-green-600',
  error: 'bg-red-100 text-red-600',
};

const nodeTypeColors = {
  document: 'text-[#B47800] bg-[#FBEEB1]',
  chat: 'text-[#B47800] bg-[#FBEEB1]',
  pin: 'text-[#B47800] bg-[#FBEEB1]',
  persona: 'text-[#3C6CFF] bg-[#E5EBFD]',
  model: 'text-[#3C6CFF] bg-[#E5EBFD]',
};

function CustomNode({ data, selected, id: nodeId }: NodeProps<WorkflowNodeData>) {
  const Icon = iconMap[data.type as NodeType];
  const statusColor = statusColors[data.status];
  const [isHovered, setIsHovered] = useState(false);
  const { setNodes, getNodes } = useReactFlow();
  
  // Check if this node type is highlighted
  const isHighlighted = data.isHighlighted && !selected;

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Clicking edit will select the node, triggering inspector to open
    // This is handled by the parent component
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentNodes = getNodes();
    const currentNode = currentNodes.find(n => n.id === nodeId);
    if (!currentNode) return;

    const newNode = {
      ...currentNode,
      id: getId(),
      position: {
        x: currentNode.position.x + 50,
        y: currentNode.position.y + 50,
      },
      selected: false,
    };

    setNodes((nds) => [...nds, newNode]);
  };

  return (
    <div
      className={`bg-white rounded-xl border-2 transition-all shadow-md min-w-[240px] relative ${
        selected 
          ? 'border-blue-500 shadow-lg' 
          : isHighlighted 
          ? 'border-blue-300 shadow-md ring-2 ring-blue-200' 
          : 'border-gray-200'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />

      {/* Hover Action Bar */}
      {(isHovered || selected) && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-white rounded-lg shadow-md border border-gray-200 p-1 z-10 opacity-0 animate-fadeIn">
          <button
            onClick={handleEdit}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors group"
            title="Edit Node"
          >
            <Edit2 className="w-3.5 h-3.5 text-gray-600 group-hover:text-blue-600" />
          </button>
          <button
            onClick={handleDuplicate}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors group"
            title="Duplicate Node"
          >
            <Copy className="w-3.5 h-3.5 text-gray-600 group-hover:text-green-600" />
          </button>
        </div>
      )}

      {/* Node Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${nodeTypeColors[data.type as NodeType]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-500 uppercase">
                {data.type}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>
                {data.status}
              </span>
            </div>
            <h3 className="font-semibold text-sm text-gray-900 truncate">
              {data.label}
            </h3>
          </div>
        </div>
      </div>

      {/* Node Content */}
      {data.description && (
        <div className="p-4">
          <p className="text-xs text-gray-600 line-clamp-2">{data.description}</p>
        </div>
      )}

      {/* Node Footer - Show file count or other info */}
      {data.files && data.files.length > 0 && (
        <div className="px-4 pb-4">
          <div className="text-xs text-gray-500">
            {data.files.length} file{data.files.length !== 1 ? 's' : ''} attached
          </div>
        </div>
      )}

      {data.output && (
        <div className="px-4 pb-4">
          <div className="text-xs text-green-600 font-medium">
            Output available
          </div>
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
      />
    </div>
  );
}

export default memo(CustomNode);
