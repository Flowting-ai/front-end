
'use client';
import type { ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
  leftSidebar: ReactNode;
  rightSidebar: ReactNode;
}

export default function AppLayout({ children, leftSidebar, rightSidebar }: AppLayoutProps) {
  return (
      <div className="flex h-screen bg-card w-full">
          {leftSidebar}
          <main className="flex-1 flex flex-col">
            {children}
          </main>
          {rightSidebar}
      </div>
  );
}
