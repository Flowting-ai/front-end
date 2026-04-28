"use client";

import React from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge, useReactFlow } from 'reactflow';
import { X } from 'lucide-react';
import { WorkflowNodeData } from '../types';

interface CustomEdgeData {
  onDeleteEdge?: (edgeIds: string[]) => void;
}

interface CustomEdgeProps extends EdgeProps<CustomEdgeData> {
  selected?: boolean;
  onDelete?: (edgeId: string) => void;
}

export function CustomEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {},
  markerEnd,
  selected = false,
  onDelete,
}: CustomEdgeProps) {
  const { getNode } = useReactFlow();
  
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onDeleteFromData =
    typeof data?.onDeleteEdge === "function" ? data.onDeleteEdge : undefined;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(id);
      return;
    }
    if (onDeleteFromData) {
      onDeleteFromData([id]);
    }
  };

  // Check if source is pin/chat node and target is end node
  const sourceNode = getNode(source);
  const targetNode = getNode(target);
  const sourceNodeType = (sourceNode?.data as WorkflowNodeData | undefined)?.type;
  const isInvalidConnection = 
    (sourceNodeType === 'pin' || sourceNodeType === 'chat') && 
    target === 'end-node';

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{
          ...style,
          strokeWidth: selected ? 3 : 2,
          stroke: isInvalidConnection ? '#EF4444' : (selected ? '#000000' : '#8B8B8B'),
        }}
      />
      {selected && (onDelete || onDeleteFromData) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <button
              onClick={handleDelete}
              className="cursor-pointer w-7 h-7 rounded-full bg-black text-white flex items-center justify-center hover:bg-[#1F1F1F] transition-colors shadow-lg"
              aria-label="Delete connection"
            >
              <X size={14} />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default CustomEdge;
