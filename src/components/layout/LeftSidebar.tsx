"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar, SidebarMenuItem, SidebarMenuSkeleton } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { useChatHistoryContext } from "@/context/chat-history-context";
import { ChatHistoryItem } from "./ChatHistoryItem";
import type { UseChatHistoryResult } from "@/hooks/use-chat-history";

// ── Collapse state persistence ────────────────────────────────────────────────

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("sidebar_collapsed") === "true";
}

// ── Section show/hide animation — matches Sidebar design system ───────────────

const sectionHeightVariants = {
  open: {
    height: "auto" as const,
    transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const },
  },
  closed: {
    height: 0,
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const, delay: 0.14 },
  },
};

// ── Shared section props ──────────────────────────────────────────────────────

interface SectionProps {
  activeChatId?: string;
  onSelectChat: (id: string) => void;
  chatHistory: UseChatHistoryResult;
}

// ── Starred section ───────────────────────────────────────────────────────────

function StarredSection({ activeChatId, onSelectChat, chatHistory }: SectionProps) {
  const [shown, setShown] = useState(true);
  const [overflow, setOverflow] = useState<"visible" | "hidden">("visible");

  const starredChats = chatHistory.chats.filter((c) => c.starred);

  // Don't render the section at all when no chats are starred.
  // Component remounts next time a chat is starred → shown resets to true.
  if (starredChats.length === 0) return null;

  return (
    <>
      <SidebarMenuItem
        fluid
        variant="header"
        label="Starred"
        shown={shown}
        onShowClick={() => setShown((s) => !s)}
      />
      <motion.div
        animate={shown ? "open" : "closed"}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === "closed") setOverflow("hidden"); }}
        onAnimationComplete={(def) => { if (def === "open") setOverflow("visible"); }}
      >
        <div
          style={{
            paddingTop: "4px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          {starredChats.map((chat) => (
            <ChatHistoryItem
              key={chat.id}
              chat={chat}
              isActive={chat.id === activeChatId}
              onSelect={onSelectChat}
              onRename={chatHistory.rename}
              onDelete={chatHistory.remove}
              onStar={chatHistory.star}
            />
          ))}
        </div>
      </motion.div>
    </>
  );
}

// ── Recents list ──────────────────────────────────────────────────────────────

function RecentsList({ activeChatId, onSelectChat, chatHistory }: SectionProps) {
  const { chats, isLoading, hasMore, loadMore, rename, remove, star } = chatHistory;

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
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
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

// ── Recents section — header with show/hide + animated collapse ───────────────

function RecentsSection(props: SectionProps) {
  const [shown, setShown] = useState(true);
  const [overflow, setOverflow] = useState<"visible" | "hidden">("visible");

  return (
    <>
      <SidebarMenuItem
        fluid
        variant="header"
        label="Recents"
        shown={shown}
        onShowClick={() => setShown((s) => !s)}
      />
      <motion.div
        animate={shown ? "open" : "closed"}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === "closed") setOverflow("hidden"); }}
        onAnimationComplete={(def) => { if (def === "open") setOverflow("visible"); }}
      >
        <div style={{ paddingTop: "4px" }}>
          <RecentsList {...props} />
        </div>
      </motion.div>
    </>
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
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const chatHistory = useChatHistoryContext();
  const collapsedRef = useRef<boolean>(readCollapsed());

  const resolvedActiveChatId = activeChatId ?? searchParams.get("id") ?? undefined;

  const handleCollapse = () => {
    collapsedRef.current = !collapsedRef.current;
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar_collapsed", String(collapsedRef.current));
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
    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.name || ""
    : "";

  const sectionProps: SectionProps = {
    activeChatId: resolvedActiveChatId,
    onSelectChat: handleSelectChat,
    chatHistory,
  };

  return (
    <Sidebar
      userName={displayName || "Account"}
      userEmail={user?.email ?? ""}
      avatarSrc={undefined}
      defaultCollapsed={collapsedRef.current}
      onCollapse={handleCollapse}
      onNewChat={handleNewChat}
      onSearch={() => {
        /* wired in Day 7 — search dialog */
      }}
      onSettingsClick={() => router.push("/settings")}
      recentItems={
        // Both sections share sectionProps; StarredSection self-hides when empty.
        // gap:'8px' on the wrapper adds space between Starred and Recents only
        // when both are present — gap does not apply to null children.
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <StarredSection {...sectionProps} />
          <RecentsSection {...sectionProps} />
        </div>
      }
    />
  );
}
