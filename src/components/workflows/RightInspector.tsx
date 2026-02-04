'use client';

import React, { useState } from 'react';
import { X, Upload, Trash2, FileText } from 'lucide-react';
import { Node } from 'reactflow';
import { WorkflowNodeData } from './types';

interface RightInspectorProps {
  selectedNode: Node<WorkflowNodeData> | null;
  onClose: () => void;
  onUpdateNode: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  onDelete: () => void;
}

export default function RightInspector({
  selectedNode,
  onClose,
  onUpdateNode,
  onDelete,
}: RightInspectorProps) {
  const [label, setLabel] = useState(selectedNode?.data.label || '');
  const [description, setDescription] = useState(selectedNode?.data.description || '');
  const [prompt, setPrompt] = useState(selectedNode?.data.prompt || '');
  const [systemPrompt, setSystemPrompt] = useState(selectedNode?.data.systemPrompt || '');
  const [userPrompt, setUserPrompt] = useState(selectedNode?.data.userPrompt || '');
  const [temperature, setTemperature] = useState(selectedNode?.data.temperature || 0.7);
  const [maxTokens, setMaxTokens] = useState(selectedNode?.data.maxTokens || 2048);

  if (!selectedNode) {
    return null;
  }

  const handleUpdate = () => {
    if (!selectedNode) return;

    onUpdateNode(selectedNode.id, {
      label,
      description,
      prompt,
      systemPrompt,
      userPrompt,
      temperature,
      maxTokens,
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files).map((file) => ({
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file),
    }));

    onUpdateNode(selectedNode.id, {
      files: [...(selectedNode.data.files || []), ...newFiles],
    });
  };

  const handleRemoveFile = (index: number) => {
    const files = selectedNode.data.files || [];
    const updatedFiles = files.filter((_, i) => i !== index);
    onUpdateNode(selectedNode.id, { files: updatedFiles });
  };

  return (
    <div className="absolute top-14 right-0 w-80 h-[calc(100vh-3.5rem)] bg-white border-l border-gray-200 shadow-lg overflow-y-auto z-40">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <h2 className="font-semibold text-lg text-gray-900">Node Settings</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Node Type Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase px-2 py-1 bg-gray-100 rounded">
            {selectedNode.data.type}
          </span>
          <span className={`text-xs px-2 py-1 rounded ${
            selectedNode.data.status === 'idle' ? 'bg-gray-100 text-gray-600' :
            selectedNode.data.status === 'running' ? 'bg-blue-100 text-blue-600' :
            selectedNode.data.status === 'success' ? 'bg-green-100 text-green-600' :
            'bg-red-100 text-red-600'
          }`}>
            {selectedNode.data.status}
          </span>
        </div>

        {/* Node Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Node Name
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleUpdate}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter node name"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleUpdate}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
            placeholder="Enter description"
          />
        </div>

        {/* Document Node - File Upload */}
        {selectedNode.data.type === 'document' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Files
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
              <input
                type="file"
                id="file-upload"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-600">
                  Click to upload files
                </span>
              </label>
            </div>

            {/* File List */}
            {selectedNode.data.files && selectedNode.data.files.length > 0 && (
              <div className="mt-3 space-y-2">
                {selectedNode.data.files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">
                        {file.name}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Instruction Field */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Context Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onBlur={handleUpdate}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={4}
                placeholder="Add instructions for how to use these documents..."
              />
            </div>
          </div>
        )}

        {/* Model Node - Prompt Configuration */}
        {selectedNode.data.type === 'model' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                System Prompt
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                onBlur={handleUpdate}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={4}
                placeholder="Enter system prompt..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Prompt
              </label>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                onBlur={handleUpdate}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={4}
                placeholder="Enter user prompt..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temperature: {temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                onMouseUp={handleUpdate}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Tokens
              </label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                onBlur={handleUpdate}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                max="32000"
              />
            </div>
          </>
        )}

        {/* Chat & Persona Nodes */}
        {(selectedNode.data.type === 'chat' || selectedNode.data.type === 'persona') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Configuration
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onBlur={handleUpdate}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={6}
              placeholder="Enter configuration..."
            />
          </div>
        )}

        {/* Pin Node */}
        {selectedNode.data.type === 'pin' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pinned Content
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onBlur={handleUpdate}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={6}
              placeholder="Enter pinned content..."
            />
          </div>
        )}

        {/* Help Section */}
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            About this node
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            {selectedNode.data.type === 'document' &&
              'Document nodes allow you to attach files that can be used as context for other nodes in your workflow.'}
            {selectedNode.data.type === 'model' &&
              'Model nodes execute AI model prompts with configurable parameters. Connect inputs to provide context.'}
            {selectedNode.data.type === 'chat' &&
              'Chat nodes display conversation history and can receive context from upstream nodes.'}
            {selectedNode.data.type === 'persona' &&
              'Persona nodes orchestrate multiple models, tools, and memory for advanced agent behavior.'}
            {selectedNode.data.type === 'pin' &&
              'Pin nodes store important information that can be reused across your workflow.'}
          </p>
        </div>

        {/* Delete Button */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={onDelete}
            className="w-full px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm font-medium">Delete Node</span>
          </button>
        </div>
      </div>
    </div>
  );
}
