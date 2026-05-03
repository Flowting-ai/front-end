"use client";

import { Suspense } from "react";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { TopBar } from "./TopBar";
import { AppDialogs } from "./AppDialogs";
import { FloatingPanel } from "./FloatingPanel";

interface AppLayoutProps {
  children: React.ReactNode;
  activeChatId?: string;
  showCitationsToggle?: boolean;
  citationsOpen?: boolean;
  onCitationsToggle?: () => void;
  onSelectChat?: (id: string) => void;
  onNewChat?: () => void;
}

export function AppLayout({
  children,
  activeChatId,
  showCitationsToggle,
  citationsOpen,
  onCitationsToggle,
  onSelectChat,
  onNewChat,
}: AppLayoutProps) {
  return (
    <div
      style={{
        display: "flex",
        height: "100svh",
        overflow: "hidden",
        backgroundColor: "var(--neutral-50)",
      }}
    >
      {/* ── Left sidebar ── */}
      <Suspense fallback={null}>
        <LeftSidebar
          activeChatId={activeChatId}
          onSelectChat={onSelectChat}
          onNewChat={onNewChat}
        />
      </Suspense>

      {/* ── Main content column ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
          position: "relative",
        }}
      >
        <TopBar
          showCitationsToggle={showCitationsToggle}
          citationsOpen={citationsOpen}
          onCitationsToggle={onCitationsToggle}
        />

        <main
          className="kaya-scrollbar"
          style={{
            flex: 1,
            overflow: "auto",
            backgroundColor: "var(--neutral-white)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {children}
        </main>

        {/* ── Floating action panel — middle-right of content column ── */}
        <FloatingPanel />
      </div>

      {/* ── Right sidebar (Pinboard) ── */}
      <RightSidebar />

      {/* ── Global dialogs ── */}
      <AppDialogs />
    </div>
  );
}
