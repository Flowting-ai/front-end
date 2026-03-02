'use client';

import React, { useState } from 'react';
import { ArrowLeft, Play, Share2, Loader2, FlaskConical, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
}: TopBarProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(workflowName);

  const handleNameSubmit = () => {
    if (tempName.trim()) {
      onNameChange(tempName.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setTempName(workflowName);
      setIsEditing(false);
    }
  };

  // Allow Test/Run whenever the workflow has been saved at least once
  // and passes configuration checks, even if there are current unsaved edits.
  const hasSavedWorkflow = Boolean(workflowId);
  const canUseTestOrRun = hasSavedWorkflow && canTestWorkflow;
  const isTestDisabled = isExecuting || !canUseTestOrRun;
  const isRunDisabled = !canUseTestOrRun;

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

        {/* Save button - disabled until there are unsaved changes */}
        <button
          onClick={onSave}
          disabled={!hasUnsavedChanges || isSaving}
          title={!workflowId ? "Name and configure workflow first, then save" : hasUnsavedChanges ? "Save workflow" : "No changes to save"}
          className="z-10 cursor-pointer hover:text-white hover:bg-[#0A0A0A] text-black bg-transparent disabled:text-gray-300 disabled:cursor-not-allowed flex items-center gap-2 rounded-lg transition-all duration-300"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Saving...</span>
            </>
          ) : (
            <div className={`flex items-center gap-2 rounded-[8px] px-3 py-2 ${hasUnsavedChanges ? "border border-main-border" : "border border-gray-300"}`}>
              <Save className="w-4 h-4" />
              <span className="text-sm">Save</span>
            </div>
          )}
        </button>

        {/* Test Workflow - opens in-built chat only (no save, no chat persistence), URL becomes ?id=X&chatMode=true */}
        <button
          onClick={onTest}
          disabled={isTestDisabled}
          title={
            isTestDisabled
              ? testDisabledReason || (!hasSavedWorkflow ? "Save workflow first, then test." : "Configure workflow before testing.")
              : "Open test chat (in-built)"
          }
          className="z-10 cursor-pointer hover:text-white hover:bg-[#0A0A0A] text-black bg-transparent disabled:text-gray-300 disabled:cursor-not-allowed flex items-center gap-2 rounded-lg transition-all duration-300"
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Running...</span>
            </>
          ) : (
            <div className="flex items-center gap-2 border border-main-border rounded-[8px] px-3 py-2">
              <FlaskConical className="w-4 h-4" />
              <span className="text-sm">Test Workflow</span>
            </div>
          )}
        </button>

        {/* Run Workflow - navigates to workflow chat page (highlighted in recent workflows board) */}
        <button
          onClick={onRun}
          disabled={isRunDisabled}
          title={
            isRunDisabled
              ? testDisabledReason || (!hasSavedWorkflow ? "Save workflow first." : "Configure workflow before running.")
              : "Open workflow chat"
          }
          className="z-10 cursor-pointer hover:text-white hover:bg-[#0A0A0A] text-black bg-transparent disabled:text-gray-300 disabled:cursor-not-allowed flex items-center gap-2 rounded-lg transition-all duration-300"
        >
          <div className="flex items-center gap-2 border border-main-border rounded-[8px] px-3 py-2">
            <Play className="w-4 h-4" />
            <span className="text-sm">Run Workflow</span>
          </div>
        </button>
      </div>
    </div>
  );
}
