"use client";

import { useState } from "react";
import { m } from "framer-motion";
import { FlatSidebarRow } from "@/components/ui";
import { sectionHeightVariants, sectionStaggerVariants, sectionItemVariants } from "./section-motion";
import type { SectionProps } from "./section-motion";
import { FlatChatHistoryItem } from "./FlatChatHistoryItem";

// -- FlatPinnedSection / FlatRecentsSection — same self-hide + hydration guard as originals.
// "Pinned" is the user-facing name for chat.starred — kept as `starred`/`star` internally
// to match the API contract (src/lib/api/chat.ts), mirroring the agent/persona split. --

export function FlatPinnedSection({ activeChatId, onSelectChat, chatHistory }: SectionProps) {
  const [shown, setShown] = useState(true)
  const [overflow, setOverflow] = useState<"visible" | "hidden">("visible")
  const pinnedChats = chatHistory.chats.filter((c) => c.starred)
  if (pinnedChats.length === 0) return null
  return (
    <>
      <FlatSidebarRow variant="header" label="Pinned" shown={shown} onShowClick={() => setShown((s) => !s)} />
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
          {pinnedChats.map((chat) => (
            <m.div key={chat.id} variants={sectionItemVariants}>
              <FlatChatHistoryItem
                chat={chat} isActive={chat.id === activeChatId} onSelect={onSelectChat}
                onRename={chatHistory.rename} onDelete={async (chatId) => { await chatHistory.remove(chatId) }} onStar={chatHistory.star}
                onArchive={async (chatId) => { await chatHistory.archive(chatId) }}
              />
            </m.div>
          ))}
        </m.div>
      </m.div>
      {/* Gap before Recent Chats — only takes up space when Pinned actually rendered (see the early return above). */}
      <div aria-hidden style={{ height: 12 }} />
    </>
  )
}
