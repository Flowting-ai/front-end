'use client';

import React, { useState, useRef } from 'react';
import { ArrowLeft, Play, Share2, Loader2, FlaskConical, Save, ImagePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface TopBarProps {
  workflowName: string;
  onNameChange: (name: string) => void;
  onBack: () => void;
  onSave: () => void;
  onTest: () => void;
  onRun: () => void;
  onShare: () => void;
  workflowId: string | null;
  hasUnsavedChanges: boolean;
  isSaving?: boolean;
  isExecuting?: boolean;
  canTestWorkflow?: boolean;
  testDisabledReason?: string;
  saveStatus: string | null;
  thumbnail?: string | null;
  onThumbnailChange?: (preview: string | null, file?: File) => void;
}

export default function TopBar({
  workflowName,
  onNameChange,
  onBack,
  onSave,
  onTest,
  onRun,
  onShare,
  workflowId,
  hasUnsavedChanges,
  isSaving = false,
  isExecuting = false,
  canTestWorkflow = true,
  testDisabledReason,
  saveStatus,
  thumbnail,
  onThumbnailChange,
}: TopBarProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(workflowName);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const handleNameSubmit = () => {
    if (tempName.trim()) {
      onNameChange(tempName.trim());
    }
    setIsEditing(false);
  };

  const handleThumbnailClick = () => {
    thumbnailInputRef.current?.click();
  };

  const handleThumbnailFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      // Pass both the preview data-URL (for immediate display) and the raw File
      // (so the parent can upload it to the backend on save)
      onThumbnailChange?.(dataUrl, file);
    };
    reader.readAsDataURL(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setTempName(workflowName);
      setIsEditing(false);
    }
  };

  // Save is enabled only when there are unsaved changes
  const isSaveEnabled = hasUnsavedChanges && !isSaving;

  // Test/Run should only be enabled when:
  // 1. The workflow has been saved at least once (has workflowId)
  // 2. The workflow passes configuration checks (canTestWorkflow)
  // 3. There are NO unsaved changes — if Save is enabled, Test/Run must be disabled
  const hasSavedWorkflow = Boolean(workflowId);
  const canUseTestOrRun = hasSavedWorkflow && canTestWorkflow && !hasUnsavedChanges;
  const isTestDisabled = isExecuting || !canUseTestOrRun;
  const isRunDisabled = !canUseTestOrRun;

  // Determine tooltip messages
  const getTestTooltip = () => {
    if (isExecuting) return "Workflow is currently running";
    if (!hasSavedWorkflow) return "Save workflow first, then test";
    if (hasUnsavedChanges) return "Save your changes before testing";
    if (!canTestWorkflow) return testDisabledReason || "Configure workflow before testing";
    return "Open test chat (in-built)";
  };

  const getRunTooltip = () => {
    if (!hasSavedWorkflow) return "Save workflow first, then run";
    if (hasUnsavedChanges) return "Save your changes before running";
    if (!canTestWorkflow) return testDisabledReason || "Configure workflow before running";
    return "Run workflow";
  };

  return (
    <div className="h-14 w-full bg-gradient-to-b from-[#F2F2F2] to-transparent flex items-center justify-between gap-6 px-6 absolute top-0 left-0 right-0 z-50">
      {/* Left Content */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-[#525252] hover:text-[#000] transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Workflow Thumbnail button */}
        {/* <button
          type="button"
          onClick={handleThumbnailClick}
          title={thumbnail ? "Change workflow thumbnail" : "Add workflow thumbnail"}
          className="flex-shrink-0 h-8 w-8 rounded-[6px] overflow-hidden border border-dashed border-gray-300 hover:border-gray-500 transition-colors flex items-center justify-center"
        >
          {thumbnail ? (
            <Image src={thumbnail} alt="Thumbnail" width={32} height={32} className="h-8 w-8 object-cover" unoptimized />
          ) : (
            <ImagePlus className="w-4 h-4 text-gray-400" />
          )}
        </button> */}
        <input
          ref={thumbnailInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleThumbnailFileChange}
        />

        {isEditing ? (
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleKeyDown}
            className="font-inter font-semibold text-base text-black bg-white border border-gray-300 rounded px-2 py-1 outline-none focus:border-black"
            autoFocus
          />
        ) : (
          <h1
            onClick={() => setIsEditing(true)}
            className="font-inter font-semibold text-base text-black cursor-pointer hover:text-gray-600 transition-colors"
          >
            {workflowName}
          </h1>
        )}
      </div>

      {/* Right Content */}
      <div className="flex items-center gap-4">
        {saveStatus && (
          <div className="h-5 px-1.5 py-1 rounded text-xs flex items-center text-[#00812F] bg-[#D8FDE4]">
            {saveStatus}
          </div>
        )}

        {/* Save button - enabled only when there are unsaved changes */}
        <button
          onClick={onSave}
          disabled={!isSaveEnabled}
          title={!workflowId ? "Name and configure workflow first, then save" : hasUnsavedChanges ? "Save workflow" : "No changes to save"}
          className="z-10 cursor-pointer hover:text-white hover:bg-[#0A0A0A] text-black bg-transparent disabled:text-gray-300 disabled:cursor-not-allowed flex items-center gap-2 rounded-lg transition-all duration-300"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Saving...</span>
            </>
          ) : (
            <div className={`flex items-center gap-2 rounded-[8px] px-3 py-2 ${isSaveEnabled ? "border border-main-border" : "border border-gray-300"}`}>
              <Save className="w-4 h-4" />
              <span className="text-sm">Save</span>
            </div>
          )}
        </button>

        {/* Test Workflow - disabled whenever Save is enabled (has unsaved changes) */}
        <button
          onClick={onTest}
          disabled={isTestDisabled}
          title={getTestTooltip()}
          className="z-10 cursor-pointer hover:text-white hover:bg-[#0A0A0A] text-black bg-transparent disabled:text-gray-300 disabled:cursor-not-allowed flex items-center gap-2 rounded-lg transition-all duration-300"
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Running...</span>
            </>
          ) : (
            <div className={`flex items-center gap-2 rounded-[8px] px-3 py-2 ${isTestDisabled ? "border border-gray-200" : "border border-main-border"}`}>
              <FlaskConical className="w-4 h-4" />
              <span className="text-sm">Test Workflow</span>
            </div>
          )}
        </button>

        {/* Run Workflow - disabled whenever Save is enabled (has unsaved changes) */}
        <button
          onClick={onRun}
          disabled={isRunDisabled}
          title={getRunTooltip()}
          className="z-10 cursor-pointer hover:text-white hover:bg-[#0A0A0A] text-black bg-transparent disabled:text-gray-300 disabled:cursor-not-allowed flex items-center gap-2 rounded-lg transition-all duration-300"
        >
          <div className={`flex items-center gap-2 rounded-[8px] px-3 py-2 ${isRunDisabled ? "border border-gray-200" : "border border-main-border"}`}>
            <Play className="w-4 h-4" />
            <span className="text-sm">Run Workflow</span>
          </div>
        </button>
      </div>
    </div>
  );
}
