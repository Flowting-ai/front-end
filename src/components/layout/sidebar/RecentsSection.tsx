"use client";

import { useState, useEffect } from "react";
import { m } from "framer-motion";
import { SidebarMenuItem, SidebarMenuSkeleton } from "@/components/ui";
import { ChatHistoryItem } from "../ChatHistoryItem";
import { sectionHeightVariants, sectionStaggerVariants, sectionItemVariants } from "./section-motion";
import type { SectionProps } from "./section-motion";

// -- Recents list --------------------------------------------------------------

function RecentsList({ activeChatId, onSelectChat, chatHistory }: SectionProps) {
  const { chats, isLoading, hasMore, loadMore, rename, remove, star } = chatHistory;

  // Suppress hydration mismatch: the server always renders with isLoading=false,
  // so defer the loading skeleton until after mount so the first client render
  // matches the server output.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const loading = mounted && isLoading;

  if (loading && chats.length === 0) {
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
          <SidebarMenuSkeleton key={i} index={i} fluid />
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
    <m.div
      animate="open"
      initial="closed"
      variants={sectionStaggerVariants}
      style={{ display: "flex", flexDirection: "column", gap: "4px" }}
    >
      {chats.map((chat) => (
        <m.div key={chat.id} variants={sectionItemVariants}>
          <ChatHistoryItem
            chat={chat}
            isActive={chat.id === activeChatId}
            onSelect={onSelectChat}
            onRename={rename}
            onDelete={async (chatId) => { await remove(chatId) }}
            onStar={star}
          />
        </m.div>
      ))}
      {hasMore && (
        <m.div variants={sectionItemVariants}>
          <SidebarMenuItem
            fluid
            variant="default"
            label="Load more"
            onClick={loadMore}
          />
        </m.div>
      )}
    </m.div>
  );
}

// -- Recents section - header with show/hide + animated collapse ---------------

export function RecentsSection(props: SectionProps) {
  const [shown, setShown] = useState(true);
  const [overflow, setOverflow] = useState<"visible" | "hidden">("visible");

  return (
    <>
      <SidebarMenuItem
        fluid
        variant="header"
        label="Recent Chats"
        shown={shown}
        onShowClick={() => setShown((s) => !s)}
      />
      <m.div
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
      </m.div>
    </>
  );
}
