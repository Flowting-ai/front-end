"use client";

import { useState } from "react";
import { m } from "framer-motion";
import { SidebarMenuItem } from "@/components/ui";
import { ChatHistoryItem } from "../ChatHistoryItem";
import { sectionHeightVariants, sectionStaggerVariants, sectionItemVariants } from "./section-motion";
import type { SectionProps } from "./section-motion";

// -- Starred section -----------------------------------------------------------

export function StarredSection({ activeChatId, onSelectChat, chatHistory }: SectionProps) {
  const [shown, setShown] = useState(true);
  const [overflow, setOverflow] = useState<"visible" | "hidden">("visible");

  const starredChats = chatHistory.chats.filter((c) => c.starred);

  // Don't render the section at all when no chats are starred.
  // Component remounts next time a chat is starred ? shown resets to true.
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
      <m.div
        animate={shown ? "open" : "closed"}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === "closed") setOverflow("hidden"); }}
        onAnimationComplete={(def) => { if (def === "open") setOverflow("visible"); }}
      >
        <m.div
          animate={shown ? "open" : "closed"}
          initial="closed"
          variants={sectionStaggerVariants}
          style={{
            paddingTop: "4px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          {starredChats.map((chat) => (
            <m.div key={chat.id} variants={sectionItemVariants}>
              <ChatHistoryItem
                chat={chat}
                isActive={chat.id === activeChatId}
                onSelect={onSelectChat}
                onRename={chatHistory.rename}
                onDelete={async (chatId) => { await chatHistory.remove(chatId) }}
                onStar={chatHistory.star}
              />
            </m.div>
          ))}
        </m.div>
      </m.div>
    </>
  );
}
