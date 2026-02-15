'use client';

import React from 'react';
import { Undo2, Redo2, Maximize, Trash2, Save, FolderOpen, ZoomIn, ZoomOut, Map } from 'lucide-react';

interface UtilitySectionProps {
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
  onClear: () => void;
  onSave: () => void;
  onLoad: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleMinimap: () => void;
  canUndo: boolean;
  canRedo: boolean;
  showMinimap: boolean;
}

export default function UtilitySection({
  onUndo,
  onRedo,
  onFitView,
  onClear,
  onSave,
  onLoad,
  onZoomIn,
  onZoomOut,
  onToggleMinimap,
  canUndo,
  canRedo,
  showMinimap,
}: UtilitySectionProps) {
  const buttons = [
    { icon: Undo2, label: 'Undo', action: onUndo, disabled: !canUndo },
    { icon: Redo2, label: 'Redo', action: onRedo, disabled: !canRedo },
    { icon: ZoomIn, label: 'Zoom In', action: onZoomIn, disabled: false },
    { icon: ZoomOut, label: 'Zoom Out', action: onZoomOut, disabled: false },
    { icon: Maximize, label: 'Fit View', action: onFitView, disabled: false },
    { icon: Map, label: showMinimap ? 'Hide Minimap' : 'Show Minimap', action: onToggleMinimap, disabled: false, active: showMinimap },
    { icon: Save, label: 'Save', action: onSave, disabled: false },
    // { icon: FolderOpen, label: 'Load', action: onLoad, disabled: false },
    { icon: Trash2, label: 'Clear', action: onClear, disabled: false },
  ];

  return (
    <div className="absolute left-1/2 bottom-4 transform -translate-x-1/2 z-50">
      <div className="w-auto h-12 bg-white border border-[#E5E5E5] rounded-2xl shadow-md flex items-center gap-2 px-1 py-2">
        {buttons.map((button, index) => {
          const Icon = button.icon;
          return (
            <button
              key={index}
              onClick={button.action}
              disabled={button.disabled}
              className={`cursor-pointer p-2.5 rounded-xl transition-all ${
                button.disabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : (button as any).active
                  ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 active:scale-95'
                  : 'text-gray-700 hover:bg-gray-100 active:scale-95'
              }`}
              title={button.label}
              aria-label={button.label}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
