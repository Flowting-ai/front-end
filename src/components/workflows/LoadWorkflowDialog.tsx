'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import { workflowAPI } from './workflow-api';
import { WorkflowMetadata } from './types';

interface LoadWorkflowDialogProps {
  onClose: () => void;
  onLoad: (workflowId: string) => void;
}

export function LoadWorkflowDialog({ onClose, onLoad }: LoadWorkflowDialogProps) {
  const [workflows, setWorkflows] = useState<WorkflowMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        setIsLoading(true);
        const { workflows: data } = await workflowAPI.list();
        setWorkflows(data);
      } catch (error) {
        console.error('Failed to load workflows:', error);
        setWorkflows([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflows();
  }, []);

  const filteredWorkflows = workflows.filter((workflow) => {
    if (!searchQuery) return true;
    return workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           workflow.description?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleLoad = () => {
    if (selectedWorkflowId) {
      onLoad(selectedWorkflowId);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[10px] border border-[#E5E5E5] shadow-lg flex flex-col gap-3 p-3"
        style={{
          width: '500px',
          maxHeight: '600px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-2">
          <h2 className="font-clash font-normal text-[24px] text-[#0A0A0A]">
            Load Workflow
          </h2>
          <button
            onClick={onClose}
            className="cursor-pointer text-[#757575] hover:text-black transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-[#757575] px-2">
          Select a workflow to load into the canvas
        </p>

        {/* Search Bar */}
        <div className="relative px-2">
          <Search className="absolute left-4 top-2.5 h-4 w-4 text-[#9F9F9F]" />
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 py-2 rounded-[8px] border border-[#E5E5E5] font-geist font-normal text-sm text-[#0A0A0A] placeholder-[#737373] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>

        {/* Workflows List */}
        <div className="flex-1 overflow-y-auto px-2" style={{ minHeight: '300px', maxHeight: '400px' }}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-[#757575]" />
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#757575] text-sm gap-2">
              <div className="font-medium">No workflows found</div>
              {searchQuery ? (
                <div className="text-xs">Try a different search term</div>
              ) : (
                <div className="text-xs text-center">
                  Create your first workflow to see it here
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredWorkflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    selectedWorkflowId === workflow.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-[#E5E5E5] bg-white hover:bg-[#F5F5F5]'
                  }`}
                  onClick={() => setSelectedWorkflowId(workflow.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-[#0A0A0A] truncate">
                        {workflow.name}
                      </h3>
                      {workflow.description && (
                        <p className="text-xs text-[#757575] mt-1 line-clamp-2">
                          {workflow.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-[#9F9F9F]">
                        <span>{workflow.nodeCount} nodes</span>
                        <span>•</span>
                        <span>{workflow.edgeCount} connections</span>
                        {workflow.updatedAt && (
                          <>
                            <span>•</span>
                            <span>
                              Updated {new Date(workflow.updatedAt).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {selectedWorkflowId === workflow.id && (
                      <div className="ml-2 flex-shrink-0">
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer - Cancel and Load Buttons */}
        <div className="flex items-center justify-end gap-2 px-2 py-1 border-t border-[#E5E5E5]">
          <button
            onClick={onClose}
            className="cursor-pointer h-9 rounded-[8px] px-4 bg-white text-sm font-medium text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleLoad}
            disabled={!selectedWorkflowId}
            className="cursor-pointer h-9 rounded-[8px] px-4 bg-[#2C2C2C] text-white text-sm font-medium hover:bg-[#1F1F1F] transition-colors disabled:bg-[#D4D4D4] disabled:text-[#757575] disabled:cursor-not-allowed"
          >
            Load Workflow
          </button>
        </div>
      </div>
    </div>
  );
}
