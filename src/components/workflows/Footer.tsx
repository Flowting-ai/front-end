'use client';

import React from 'react';

interface FooterProps {
  nodeCount: number;
  connectionCount: number;
}

export default function Footer({ nodeCount, connectionCount }: FooterProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-10 bg-white border-t border-gray-200 flex items-center justify-between px-6 text-xs text-gray-600 z-40">
      {/* Left - Statistics */}
      <div className="flex items-center gap-6">
        <span>{nodeCount} node{nodeCount !== 1 ? 's' : ''}</span>
        <span>{connectionCount} connection{connectionCount !== 1 ? 's' : ''}</span>
      </div>

      {/* Right - Additional Info */}
      <div className="flex items-center gap-6">
        <span>Workflow Builder</span>
      </div>
    </div>
  );
}
