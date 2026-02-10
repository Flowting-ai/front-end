"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Trash2, Upload, File, Image as ImageIcon } from "lucide-react";
import { WorkflowNodeData } from "./types";

interface DocumentFile {
  id: string;
  name: string;
  size: number;
  type: "pdf" | "image" | "document";
  url: string;
  file: File;
  uploadProgress?: number;
}

interface DocumentNodeInspectorProps {
  nodeData: WorkflowNodeData;
  onClose: () => void;
  onUpdate: (data: Partial<WorkflowNodeData>) => void;
  onDelete: () => void;
}

export function DocumentNodeInspector({
  nodeData,
  onClose,
  onUpdate,
  onDelete,
}: DocumentNodeInspectorProps) {
  const [files, setFiles] = useState<DocumentFile[]>(
    (nodeData.files as DocumentFile[]) || [],
  );
  const [nodeName, setNodeName] = useState<string>(nodeData.name || "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const newFiles: DocumentFile[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];

      // Check for duplicate
      if (files.some((f) => f.name === file.name)) {
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        continue;
      }

      const fileId = crypto.randomUUID();
      const objectUrl = URL.createObjectURL(file);

      // Determine file type
      const isPdf = file.type === "application/pdf";
      const isImage = file.type.startsWith("image/");
      const fileType = isPdf ? "pdf" : isImage ? "image" : "document";

      newFiles.push({
        id: fileId,
        name: file.name,
        size: file.size,
        type: fileType,
        url: objectUrl,
        file: file,
        uploadProgress: 100, // Simulated - already "uploaded"
      });
    }

    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === fileId);
      if (file) {
        URL.revokeObjectURL(file.url);
      }
      return prev.filter((f) => f.id !== fileId);
    });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleSaveAndClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onUpdate({ files: files as any, name: nodeName });
    onClose();
  };

  return (
    <div
      className="absolute top-4 right-4 w-[360px] rounded-2xl border border-[#E5E5E5] bg-white shadow-lg p-3 flex flex-col gap-3 z-50"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#2C2C2C] leading-[140%]">
            Documents
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

      {/* File Upload Section */}
      <div className="flex flex-col gap-2">
        <h3 className="font-geist font-medium text-sm text-[#0A0A0A]">
          File Upload
        </h3>
        {/* Dotted Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full h-[147px] rounded-[8px] border-2 border-dashed ${
            isDragging ? "border-blue-500 bg-blue-50" : "border-[#E5E5E5]"
          } p-3 flex flex-col items-center justify-center gap-3 transition-colors`}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <Upload className="h-8 w-8 text-[#9F9F9F]" />
            <p className="text-sm text-[#757575]">
              Drag & drop files here or click to browse
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleUploadClick();
            }}
            className="cursor-pointer h-8 min-h-[32px] rounded-lg border border-[#E5E5E5] px-3 py-[5.5px] flex items-center gap-1.5 text-xs font-medium text-black hover:bg-gray-50 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.xlsx,.xls,image/*"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
        </div>
      </div>

      {/* Uploaded Files Grid */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="relative rounded-lg border border-[#E5E5E5] bg-white p-2"
            >
              {/* X Button - Top Right */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile(file.id);
                }}
                className="absolute top-1 right-1 text-[#757575] hover:text-red-600 transition-colors cursor-pointer"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>

              {/* File Name */}
              <p className="text-xs font-medium text-black truncate pr-5 mb-1">
                {file.name}
              </p>

              {/* File Type and Size */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#757575] capitalize">{file.type}</p>
                <p className="text-xs text-[#757575]">
                  {formatFileSize(file.size)}
                </p>
              </div>
            </div>
          ))}
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
  );
}
