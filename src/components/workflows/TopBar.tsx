'use client';

import React, { useState } from 'react';
import { ArrowLeft, Play, Share2, RotateCcw, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface TopBarProps {
  workflowName: string;
  onNameChange: (name: string) => void;
  onTest: () => void;
  onShare: () => void;
  onReset?: () => void;
  isExecuting?: boolean;
  canTestWorkflow?: boolean;
  testDisabledReason?: string;
  saveStatus: string | null; // 'Auto saved' or 'Workflow saved'
}

export default function TopBar({
  workflowName,
  onNameChange,
  onTest,
  onShare,
  onReset,
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

  const isTestDisabled = isExecuting || !canTestWorkflow;

  return (
    <div className="h-14 w-full bg-gradient-to-b from-[#F2F2F2] to-transparent flex items-center justify-between gap-6 px-6 absolute top-0 left-0 right-0 z-50">
      {/* Left Content */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/workflowAdmin')}
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
        {/* Save Status Indicator */}
        {saveStatus && (
          <div className={`h-5 px-1.5 py-1 rounded text-xs flex items-center ${
            saveStatus === 'Workflow saved'
              ? 'text-[#00812F] bg-[#D8FDE4]'
              : 'text-[#00812F] bg-[#D8FDE4]'
          }`}>
            {saveStatus}
          </div>
        )}

        {/* Reset Workflow Button */}
        {/* {onReset && (
          <button
            onClick={onReset}
            disabled={isExecuting}
            className="text-[#404040] bg-transparent hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm">Reset</span>
          </button>
        )} */}

        {/* Test Workflow Button */}
        <button
          onClick={onTest}
          disabled={isTestDisabled}
          title={isTestDisabled ? testDisabledReason || "Configure workflow before testing." : "Run workflow test"}
          className="text-[#404040] bg-transparent hover:bg-gray-100 disabled:bg-gray-200 disabled:cursor-not-allowed flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Running...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span className="text-sm">Test Workflow</span>
            </>
          )}
        </button>


        <button
          onClick={onShare}
          className="text-[#FAFAFA] bg-[#171717] hover:bg-[#2a2a2a] flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
        >
          <Share2 className="w-4 h-4" />
          <span className="text-sm">Share</span>
        </button>
      </div>
    </div>
  );
}
