
'use client';
import type { ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
  leftSidebar: ReactNode;
  rightSidebar: ReactNode;
}

export default function AppLayout({ children, leftSidebar, rightSidebar }: AppLayoutProps) {
  return (
      <div className="flex min-h-screen bg-card">
          {leftSidebar}
          <main className="flex-1 flex flex-col">
            {children}
          </main>
          {rightSidebar}
      </div>
  );
}
