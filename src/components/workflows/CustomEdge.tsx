"use client";

import React from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';
import { X } from 'lucide-react';

interface CustomEdgeData {
  onDeleteEdge?: (edgeIds: string[]) => void;
}

interface CustomEdgeProps extends EdgeProps<CustomEdgeData> {
  selected?: boolean;
  onDelete?: (edgeId: string) => void;
}

export function CustomEdge({
  id,
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

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{
          ...style,
          strokeWidth: selected ? 3 : 2,
          stroke: selected ? '#000000' : '#8B8B8B',
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
