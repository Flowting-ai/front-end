
'use client';
import type { ReactNode } from "react";
import React, { useState } from "react";
import { LeftSidebar } from "./left-sidebar";
import { RightSidebar } from "./right-sidebar";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(true);

  return (
      <div className="flex h-screen bg-card w-full">
          <LeftSidebar 
            isCollapsed={isLeftSidebarCollapsed}
            onToggle={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
          />
          <main className="flex-1 flex flex-col">
            {React.cloneElement(children as React.ReactElement, {
                isRightSidebarVisible,
                setIsRightSidebarVisible
            })}
          </main>
          <RightSidebar
            isVisible={isRightSidebarVisible}
            onClose={() => setIsRightSidebarVisible(false)}
          />
      </div>
  );
}
