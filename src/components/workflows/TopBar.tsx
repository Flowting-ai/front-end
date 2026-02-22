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

  const canUseTestOrRun = Boolean(workflowId) && canTestWorkflow;
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
      <div className="flex items-center gap-3">
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
          className="z-10 text-[#404040] bg-transparent hover:bg-gray-100 disabled:bg-gray-200 disabled:cursor-not-allowed flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Saving...</span>
            </>
          ) : (
            <div className={`flex items-center gap-2 rounded-[8px] px-3 py-2 ${hasUnsavedChanges ? "text-black border border-main-border" : "text-gray-400 border border-gray-300"}`}>
              <Save className="w-4 h-4" />
              <span className="text-sm">Save</span>
            </div>
          )}
        </button>

        {/* Test Workflow - opens in-built chat only (no save, no chat persistence), URL becomes ?id=X&chatMode=true */}
        <button
          onClick={onTest}
          disabled={isTestDisabled}
          title={isTestDisabled ? testDisabledReason || "Save workflow first, then test." : "Open test chat (in-built)"}
          className="z-10 text-[#404040] bg-transparent hover:bg-gray-100 disabled:bg-gray-200 disabled:cursor-not-allowed flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Running...</span>
            </>
          ) : (
            <div className="flex items-center gap-2 text-black border border-main-border rounded-[8px] px-3 py-2">
              <FlaskConical className="w-4 h-4" />
              <span className="text-sm">Test Workflow</span>
            </div>
          )}
        </button>

        {/* Run Workflow - navigates to workflow chat page (highlighted in recent workflows board) */}
        <button
          onClick={onRun}
          disabled={isRunDisabled}
          title={isRunDisabled ? testDisabledReason || "Save workflow first." : "Open workflow chat"}
          className="z-10 text-[#404040] bg-transparent hover:bg-gray-100 disabled:bg-gray-200 disabled:cursor-not-allowed flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2 text-black border border-main-border rounded-[8px] px-3 py-2">
            <Play className="w-4 h-4" />
            <span className="text-sm">Run Workflow</span>
          </div>
        </button>
      </div>
    </div>
  );
}
