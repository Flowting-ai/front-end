"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, SidebarMenuItem, SidebarMenuSkeleton } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { useChatHistory } from "@/hooks/use-chat-history";
import { ChatHistoryItem } from "./ChatHistoryItem";

// ── Collapse state persistence ────────────────────────────────────────────────

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("sidebar_collapsed") === "true";
}

// ── Chat history recents section ──────────────────────────────────────────────

interface RecentsProps {
  activeChatId?: string;
  onSelectChat: (id: string) => void;
  chatHistory: ReturnType<typeof useChatHistory>;
}

function ChatRecents({ activeChatId, onSelectChat, chatHistory }: RecentsProps) {
  const { chats, isLoading, hasMore, loadMore, rename, remove, star } =
    chatHistory;

  if (isLoading && chats.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          padding: "4px 0",
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <SidebarMenuSkeleton key={i} fluid />
        ))}
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div
        style={{
          padding: "8px 6px",
          fontFamily: "var(--font-body)",
          fontSize: "var(--font-size-caption)",
          color: "var(--neutral-400)",
        }}
      >
        No chats yet
      </div>
    );
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "4px" }}
    >
      {chats.map((chat) => (
        <ChatHistoryItem
          key={chat.id}
          chat={chat}
          isActive={chat.id === activeChatId}
          onSelect={onSelectChat}
          onRename={rename}
          onDelete={remove}
          onStar={star}
        />
      ))}
      {hasMore && (
        <SidebarMenuItem
          fluid
          variant="default"
          label="Load more"
          onClick={loadMore}
        />
      )}
    </div>
  );
}

// ── LeftSidebar ───────────────────────────────────────────────────────────────

interface LeftSidebarProps {
  activeChatId?: string;
  onSelectChat?: (id: string) => void;
  onNewChat?: () => void;
}

export function LeftSidebar({
  activeChatId,
  onSelectChat,
  onNewChat,
}: LeftSidebarProps) {
  const router = useRouter();
  const { user } = useAuth();
  const chatHistory = useChatHistory();
  const collapsedRef = useRef<boolean>(readCollapsed());

  const handleCollapse = () => {
    collapsedRef.current = !collapsedRef.current;
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "sidebar_collapsed",
        String(collapsedRef.current),
      );
    }
  };

  const handleNewChat = () => {
    if (onNewChat) {
      onNewChat();
    } else {
      router.push("/chat");
    }
  };

  const handleSelectChat = (id: string) => {
    if (onSelectChat) {
      onSelectChat(id);
    } else {
      router.push(`/chat?id=${id}`);
    }
  };

  const displayName = user
    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
      user.name ||
      ""
    : "";

  const avatarInitials = (() => {
    const first = user?.firstName?.trim();
    const last = user?.lastName?.trim();
    if (first && last) return (first[0] + last[0]).toUpperCase();
    if (first) return first[0].toUpperCase();
    if (user?.email) return user.email[0].toUpperCase();
    return undefined;
  })();

  return (
    <Sidebar
      userName={displayName || "Account"}
      userEmail={user?.email ?? ""}
      avatarSrc={undefined}
      avatarInitials={avatarInitials}
      defaultCollapsed={collapsedRef.current}
      onCollapse={handleCollapse}
      onNewChat={handleNewChat}
      onSearch={() => {
        /* wired in Day 7 — search dialog */
      }}
      onSettingsClick={() => router.push("/settings")}
      recentItems={
        <ChatRecents
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          chatHistory={chatHistory}
        />
      }
    />
  );
}
