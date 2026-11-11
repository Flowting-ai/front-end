"use client";

import { useCallback, useState, useEffect } from "react";
import { m } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";
import { useGuardedRouter } from "@/context/nav-guard-context";
import { SidebarMenuItem, SidebarMenuSkeleton } from "@/components/ui";
import { fetchPersonas, fetchAgentChatsFor } from "@/lib/api/personas";
import { onPersonasInvalidated } from "@/lib/api/persona-cache";
import type { PersonaChat } from "@/lib/api/personas";
import { existingAgentChatHref } from "@/lib/agent-chat-handoff";
import { CHAT_ROUTE } from "@/lib/routes";
import { sectionHeightVariants, sectionStaggerVariants, sectionItemVariants } from "./section-motion";
import { PersonaChatItem } from "./PersonaChatItem";

// -- Recent agent chats section -----------------------------------------------
// Fetches all agent chats across all personas and displays them chronologically.
// Acts as a second layer: the first layer shows chats nested under each agent,
// this layer shows all chats flat by recency regardless of which agent owns them.

type AgentChat = PersonaChat & { personaId: string }

export function RecentAgentChatsSection() {
  const { push }            = useGuardedRouter()
  const pathname            = usePathname()
  const personaSearchParams = useSearchParams()

  // Agent chats open on the normal chat page, so the open one is /chat?id=.
  const activeChatId    = pathname === CHAT_ROUTE ? personaSearchParams.get("id") : null

  const [allChats, setAllChats] = useState<AgentChat[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [shown, setShown] = useState(true)

  const fetchAll = useCallback(async () => {
    try {
      const personas = await fetchPersonas()
      // Shared with global search: one cached request per agent; an agent whose
      // list fails is skipped instead of blanking every agent's chats.
      const { chats } = await fetchAgentChatsFor(personas)
      const merged = chats.sort((a, b) => {
        const at = a.updated_at ?? a.created_at ?? ''
        const bt = b.updated_at ?? b.created_at ?? ''
        return bt.localeCompare(at)
      })
      setAllChats(merged)
    } catch (e) {
      console.error(e)
    }
  }, [])

  // Initial load with loading state
  useEffect(() => {
    setIsLoading(true)
    fetchAll().finally(() => setIsLoading(false))
  }, [fetchAll])

  // Silent re-fetch on persona publish/delete/update
  useEffect(() => {
    return onPersonasInvalidated(() => { void fetchAll() })
  }, [fetchAll])

  return (
    <>
      <SidebarMenuItem
        fluid
        variant="header"
        label="Recent agent chats"
        shown={shown}
        onShowClick={() => setShown(s => !s)}
      />
      <m.div
        animate={shown ? 'open' : 'closed'}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow: shown ? 'visible' : 'hidden' }}
      >
        <m.div
          animate={shown ? 'open' : 'closed'}
          initial="closed"
          variants={sectionStaggerVariants}
          style={{ paddingTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}
        >
          {isLoading && Array.from({ length: 3 }).map((_, i) => (
            <SidebarMenuSkeleton key={i} index={i} fluid />
          ))}
          {!isLoading && allChats.length === 0 && (
            <div style={{ padding: "8px 6px", fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", color: "var(--neutral-400)" }}>
              No agent chats yet
            </div>
          )}
          {!isLoading && allChats.map(chat => (
            <m.div key={chat.id} variants={sectionItemVariants}>
              <PersonaChatItem
                personaId={chat.personaId}
                chat={chat}
                isActive={chat.id === activeChatId}
                onSelect={() => push(existingAgentChatHref(chat.id))}
                onRename={(chatId, title) => setAllChats(prev => prev.map(c => c.id === chatId ? { ...c, title } : c))}
                onDelete={(chatId) => setAllChats(prev => prev.filter(c => c.id !== chatId))}
              />
            </m.div>
          ))}
        </m.div>
      </m.div>
    </>
  )
}
