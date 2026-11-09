"use client";

import { useMemo, useState, useEffect } from "react";
import { SidebarEmptyState } from "./SidebarEmptyState";
import { m } from "framer-motion";
import { useGuardedRouter } from "@/context/nav-guard-context";
import { FolderLibraryIcon, FolderThreeIcon, QuillWriteOneIcon } from "@strange-huge/icons";
import { IconWithFallback } from "@/components/IconWithFallback";
import { FlatSidebarRow } from "@/components/ui";
import { SidebarChatRowsSkeleton } from "../SidebarChromeSkeleton";
import { CHATS_ROUTE } from "@/lib/routes";
import { sectionHeightVariants, sectionStaggerVariants, sectionItemVariants } from "./section-motion";
import type { SectionProps } from "./section-motion";
import { FlatChatHistoryItem } from "./FlatChatHistoryItem";

export function FlatRecentsSection({ activeChatId, onSelectChat, chatHistory, onNewChat }: SectionProps & { onNewChat?: () => void }) {
  const { push } = useGuardedRouter()
  const { chats, isLoading, hasMore, loadMore, rename, remove, star, archive } = chatHistory
  // Starred chats live in FlatPinnedSection (see its own `.filter(c => c.starred)`
  // above) — excluded here too, or a newly-pinned chat kept showing in both
  // places instead of moving out of Recent, and unpinning had nothing to
  // "return" since it never left.
  const recentChats = useMemo(() => chats.filter((c) => !c.starred), [chats])
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const loading = mounted && isLoading
  const [shown, setShown] = useState(true)
  const [overflow, setOverflow] = useState<"visible" | "hidden">("visible")

  return (
    <>
      <FlatSidebarRow
        variant="header" label="Recent Chats" shown={shown} onShowClick={() => setShown((s) => !s)}
        onAddClick={onNewChat ? (e) => { e.stopPropagation(); onNewChat() } : undefined} addLabel="New chat"
        addIcon={<QuillWriteOneIcon size={16} animated />}
        extraHeaderIcons={[
          {
            icon: (
              <IconWithFallback
                icon={<FolderLibraryIcon size={16} animated />}
                fallback={<FolderThreeIcon size={16} animated />}
              />
            ),
            onClick: () => push(CHATS_ROUTE),
            label: 'All chats',
          },
        ]}
        actionsAlwaysVisible
      />
      <m.div
        animate={shown ? "open" : "closed"}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === "closed") setOverflow("hidden") }}
        onAnimationComplete={(def) => { if (def === "open") setOverflow("visible") }}
      >
        <m.div
          animate={shown ? "open" : "closed"}
          initial="closed"
          variants={sectionStaggerVariants}
          style={{ display: "flex", flexDirection: "column", gap: 4 }}
        >
          {loading && chats.length === 0 ? (
            <SidebarChatRowsSkeleton rows={5} />
          ) : recentChats.length === 0 ? (
            <SidebarEmptyState label="No chats yet" actionLabel={onNewChat ? "Start a chat" : undefined} onAction={onNewChat} />
          ) : (
            <>
              {recentChats.map((chat) => (
                <m.div key={chat.id} variants={sectionItemVariants}>
                  <FlatChatHistoryItem
                    chat={chat} isActive={chat.id === activeChatId} onSelect={onSelectChat}
                    onRename={rename} onDelete={async (chatId) => { await remove(chatId) }} onStar={star}
                    onArchive={async (chatId) => { await archive(chatId) }}
                  />
                </m.div>
              ))}
              {hasMore && (
                <m.div variants={sectionItemVariants}>
                  <FlatSidebarRow variant="default" label="Load more" onClick={loadMore} />
                </m.div>
              )}
            </>
          )}
        </m.div>
      </m.div>
    </>
  )
}
