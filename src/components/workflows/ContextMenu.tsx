'use client';

import React from 'react';
import { NodeType } from './types';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAddNode?: (type: NodeType) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onGroup?: () => void;
  onResetPosition?: () => void;
  selectedNodeId?: string | null;
  selectedEdgeIds?: string[];
}

export default function ContextMenu({
  x,
  y,
  onClose,
  onAddNode,
  onDuplicate,
  onDelete,
  onGroup,
  onResetPosition,
  selectedNodeId,
  selectedEdgeIds = [],
}: ContextMenuProps) {
  const menuItems = [
    ...(onAddNode
      ? [
          {
            label: 'Add Node',
            submenu: [
              { label: 'Document', action: () => onAddNode('document' as NodeType) },
              { label: 'Chat', action: () => onAddNode('chat' as NodeType) },
              { label: 'Pin', action: () => onAddNode('pin' as NodeType) },
              { label: 'Persona', action: () => onAddNode('persona' as NodeType) },
              { label: 'Model', action: () => onAddNode('model' as NodeType) },
            ],
          },
        ]
      : []),
    ...(selectedNodeId && onDuplicate ? [{ label: 'Duplicate', action: onDuplicate }] : []),
    ...(selectedNodeId && onDelete ? [{ label: 'Delete Node', action: onDelete }] : []),
    ...(selectedEdgeIds.length > 0 && onDelete ? [{ label: `Delete Connection${selectedEdgeIds.length > 1 ? 's' : ''}`, action: onDelete }] : []),
    ...(selectedNodeId && onGroup ? [{ label: 'Group', action: onGroup }] : []),
    ...(selectedNodeId && onResetPosition ? [{ label: 'Reset Position', action: onResetPosition }] : []),
  ];

  const [submenuOpen, setSubmenuOpen] = React.useState<string | null>(null);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        onClick={onClose}
      />

      {/* Context Menu */}
      <div
        className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px] z-50"
        style={{ left: x, top: y }}
      >
        {menuItems.map((item, index) => (
          <div key={index} className="relative">
            {item.submenu ? (
              <>
                <button
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-between"
                  onMouseEnter={() => setSubmenuOpen(item.label)}
                  onClick={() => setSubmenuOpen(submenuOpen === item.label ? null : item.label)}
                >
                  {item.label}
                  <span className="ml-2">›</span>
                </button>
                {submenuOpen === item.label && (
                  <div
                    className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px]"
                    onMouseLeave={() => setSubmenuOpen(null)}
                  >
                    {item.submenu.map((subitem, subindex) => (
                      <button
                        key={subindex}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        onClick={() => {
                          subitem.action();
                          onClose();
                        }}
                      >
                        {subitem.label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <button
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                onClick={() => {
                  item.action?.();
                  onClose();
                }}
              >
                {item.label}
              </button>
            )}
          </div>
        ))}
        {menuItems.length === 0 && (
          <div className="px-4 py-2 text-sm text-gray-400">No actions available</div>
        )}
      </div>
    </>
  );
}
