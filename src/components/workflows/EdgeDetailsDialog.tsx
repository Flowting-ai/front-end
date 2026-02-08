"use client";

import React from "react";
import { X, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { WorkflowNode, WorkflowEdge } from "./types";
import { isValidConnection, getNodeCategory } from "./workflow-utils";

interface EdgeDetailsDialogProps {
  edge: WorkflowEdge;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onClose: () => void;
  edgeIndex: number;
}

export function EdgeDetailsDialog({
  edge,
  nodes,
  edges,
  onClose,
  edgeIndex,
}: EdgeDetailsDialogProps) {
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  if (!sourceNode || !targetNode) {
    return null;
  }

  const sourceType = sourceNode.data.type;
  const targetType = targetNode.data.type;
  const sourceName = sourceNode.data.label || sourceNode.data.name || `${sourceType} node`;
  const targetName = targetNode.data.label || targetNode.data.name || `${targetType} node`;

  // Check if connection is valid
  const isValid = isValidConnection(
    sourceType,
    targetType,
    nodes,
    edges,
    edge.source,
    edge.target
  );

  // Generate explanation based on validation rules
  const getExplanation = () => {
    if (isValid) {
      return {
        title: "Connection is set up properly",
        message: `This connection allows data to flow from the ${sourceType} node to the ${targetType} node, following the workflow execution path.`,
      };
    }

    // Check specific validation failures
    if (sourceType === 'start' && targetType === 'end') {
      return {
        title: "Connection is not set up properly",
        message: "Start and End nodes cannot be directly connected. Add an intermediate node (like Persona, Model, or Context nodes) between them to create a meaningful workflow.",
      };
    }

    if (sourceType === 'end' && targetType === 'start') {
      return {
        title: "Connection is not set up properly",
        message: "End nodes cannot connect back to Start nodes. Workflows must flow in one direction from Start to End.",
      };
    }

    const sourceCategory = getNodeCategory(sourceType);
    if (sourceCategory === 'context' && targetType === 'end') {
      return {
        title: "Connection is not set up properly",
        message: `Context nodes (Document, Chat, Pin) cannot connect directly to the End node. They must first flow through reasoning nodes (Persona or Model) to process the context data before reaching the End.`,
      };
    }

    const targetCategory = getNodeCategory(targetType);
    if (targetCategory === 'context') {
      return {
        title: "Connection is not set up properly",
        message: `Context nodes (Document, Chat, Pin) are source-only and cannot receive incoming connections. They provide input data to the workflow. Connect this ${sourceType} node to a Persona or Model node instead.`,
      };
    }

    // Check for cycles
    if ((sourceType === 'model' && targetType === 'persona') || 
        (sourceType === 'persona' && targetType === 'model')) {
      return {
        title: "Connection is not set up properly",
        message: "This connection creates a circular dependency between Persona and Model nodes. Remove any existing path from the target back to the source to break the loop.",
      };
    }

    return {
      title: "Connection is not set up properly",
      message: "This connection violates workflow rules. Please check that your nodes are connected in a valid sequence from Start to End.",
    };
  };

  const explanation = getExplanation();

  return (
    <div
      className="absolute top-4 right-4 w-[400px] rounded-2xl border border-[#E5E5E5] bg-white shadow-lg p-4 flex flex-col gap-4 z-50"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#2C2C2C] leading-[140%]">
          Connection #{edgeIndex + 1}
        </h3>
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

      {/* Connection Flow */}
      <div className="flex flex-col gap-3">
        {/* Source Node */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#757575] uppercase">
            Source Node
          </label>
          <div className="flex items-center gap-2 p-2 bg-[#F5F5F5] rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-[#1E1E1E]">
                {sourceName}
              </p>
              <p className="text-xs text-[#757575] capitalize">
                {sourceType}
              </p>
            </div>
          </div>
        </div>

        {/* Arrow Indicator */}
        <div className="flex items-center justify-center">
          <ArrowRight className="h-5 w-5 text-[#8B8B8B]" />
        </div>

        {/* Target Node */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#757575] uppercase">
            Target Node
          </label>
          <div className="flex items-center gap-2 p-2 bg-[#F5F5F5] rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-[#1E1E1E]">
                {targetName}
              </p>
              <p className="text-xs text-[#757575] capitalize">
                {targetType}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 p-3 rounded-lg border" style={{
        backgroundColor: isValid ? '#F0FDF4' : '#FEF2F2',
        borderColor: isValid ? '#86EFAC' : '#FECACA',
      }}>
        {isValid ? (
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
        ) : (
          <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
        )}
        <div className="flex-1">
          <p className={`text-sm font-semibold ${isValid ? 'text-green-700' : 'text-red-700'}`}>
            {isValid ? 'Valid Connection' : 'Invalid Connection'}
          </p>
        </div>
      </div>

      {/* Explanation */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-[#1E1E1E]">
          {explanation.title}
        </p>
        <p className="text-sm text-[#757575] leading-relaxed">
          {explanation.message}
        </p>
      </div>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="cursor-pointer w-full h-9 rounded-lg bg-[#2C2C2C] text-white text-sm font-medium hover:bg-[#1F1F1F] transition-colors"
      >
        Close
      </button>
    </div>
  );
}
