"use client";

import { Suspense } from "react";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { TopBar } from "./TopBar";
import { AppDialogs } from "./AppDialogs";

interface AppLayoutProps {
  children: React.ReactNode;
  /** Active chat ID — drives sidebar selection and TopBar title */
  activeChatId?: string;
  chatTitle?: string;
  chatModel?: string;
  showCitationsToggle?: boolean;
  citationsOpen?: boolean;
  onCitationsToggle?: () => void;
  onTitleChange?: (chatId: string, title: string) => Promise<void>;
  onSelectChat?: (id: string) => void;
  onNewChat?: () => void;
}

export function AppLayout({
  children,
  activeChatId,
  chatTitle,
  chatModel,
  showCitationsToggle,
  citationsOpen,
  onCitationsToggle,
  onTitleChange,
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
        }}
      >
        <TopBar
          chatId={activeChatId}
          title={chatTitle}
          model={chatModel}
          showCitationsToggle={showCitationsToggle}
          citationsOpen={citationsOpen}
          onCitationsToggle={onCitationsToggle}
          onTitleChange={onTitleChange}
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
      </div>

      {/* ── Right sidebar (Pinboard) ── */}
      <RightSidebar />

      {/* ── Global dialogs ── */}
      <AppDialogs />
    </div>
  );
}
