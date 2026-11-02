"use client";

import { useCallback, useState, useEffect } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { m } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";
import { useGuardedRouter } from "@/context/nav-guard-context";
import { BubbleChatAddIcon, MoreHorizontalIcon, UserAddOneIcon, UserAiIcon } from "@strange-huge/icons";
import { SidebarMenuItem, SidebarMenuSkeleton, SidebarProjectsSection } from "@/components/ui";
import { fetchPersonaChats } from "@/lib/api/personas";
import type { Persona, PersonaChat } from "@/lib/api/personas";
import { usePersonas } from "@/lib/queries/personas";
import { emitPersonaChatNav } from "@/hooks/use-sidebar-events";
import type { PersonaChatEventDetail } from "@/hooks/use-sidebar-events";
import { Badge } from "@/components/Badge";
import { AGENT_CHAT_ROUTE, AGENT_EDIT_ROUTE, AGENTS_ROUTE, AGENTS_TEMPLATES_ROUTE } from "@/lib/routes";
import { sectionHeightVariants, sectionStaggerVariants, sectionItemVariants } from "./section-motion";
import { personaAvatarUrl, AGENT_LIST_LIMIT, goToAgentsLibrary } from "./sidebar-helpers";
import { PersonaChatItem } from "./PersonaChatItem";

// -- Individual personas section — "Shared Agents" + "Your Agents" split -----
// Fetches all personas for the user (no teamId filter) and splits by
// sourceShareId: shared agents (accepted via Super Link) vs owned agents.

export function PersonasSectionIndividual() {
  const isClient            = useIsClient()
  const { push }            = useGuardedRouter()
  const pathname            = usePathname()
  const personaSearchParams = useSearchParams()

  const personaMatch    = pathname?.match(/^\/agents\/([^/]+)\/chat/)
  const activePersonaId = personaMatch?.[1] ?? null
  const activeChatId    = personaSearchParams.get("chatId")

  const [expandedIds,     setExpandedIds]     = useState<Set<string>>(new Set())
  const [personaChatsMap, setPersonaChatsMap] = useState<
    Record<string, { chats: PersonaChat[]; loaded: boolean; loading: boolean }>
  >({})

  const { data: personas, isLoading } = usePersonas()

  const loadPersonaChats = useCallback((personaId: string) => {
    setPersonaChatsMap(prev => {
      if (prev[personaId]?.loaded || prev[personaId]?.loading) return prev
      return { ...prev, [personaId]: { chats: [], loaded: false, loading: true } }
    })
    fetchPersonaChats(personaId)
      .then(chats =>
        setPersonaChatsMap(prev => ({
          ...prev,
          [personaId]: { chats, loaded: true, loading: false },
        }))
      )
      .catch(() =>
        setPersonaChatsMap(prev => ({
          ...prev,
          [personaId]: { chats: [], loaded: true, loading: false },
        }))
      )
  }, [])

  useEffect(() => {
    if (!activePersonaId) return
    setExpandedIds(prev => {
      if (prev.has(activePersonaId)) return prev
      return new Set([...prev, activePersonaId])
    })
    loadPersonaChats(activePersonaId)
  }, [activePersonaId, loadPersonaChats])

  useEffect(() => {
    const handleCreated = (e: Event) => {
      const { personaId, chatId, title } = (e as CustomEvent<PersonaChatEventDetail>).detail
      const newChat: PersonaChat = { id: chatId, title, created_at: new Date().toISOString() }
      setPersonaChatsMap(prev => {
        const existing = prev[personaId]
        if (!existing) {
          return { ...prev, [personaId]: { chats: [newChat], loaded: true, loading: false } }
        }
        if (existing.chats.some(c => c.id === chatId)) return prev
        return { ...prev, [personaId]: { ...existing, chats: [newChat, ...existing.chats] } }
      })
    }
    const handleTitleUpdated = (e: Event) => {
      const { personaId, chatId, title } = (e as CustomEvent<PersonaChatEventDetail>).detail
      setPersonaChatsMap(prev => {
        const existing = prev[personaId]
        if (!existing) return prev
        return {
          ...prev,
          [personaId]: {
            ...existing,
            chats: existing.chats.map(c => c.id === chatId ? { ...c, title } : c),
          },
        }
      })
    }
    window.addEventListener("persona:chat-created",       handleCreated)
    window.addEventListener("persona:chat-title-updated", handleTitleUpdated)
    return () => {
      window.removeEventListener("persona:chat-created",       handleCreated)
      window.removeEventListener("persona:chat-title-updated", handleTitleUpdated)
    }
  }, [])

  // Re-fetch on publish/delete/update is now handled inside usePersonas() itself
  // (bustPersonasCache() invalidates the shared query).

  const handleExpand = useCallback((personaId: string, expanded: boolean) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      expanded ? next.add(personaId) : next.delete(personaId)
      return next
    })
    if (expanded) loadPersonaChats(personaId)
  }, [loadPersonaChats])

  const handleChatRename = useCallback((personaId: string, chatId: string, title: string) => {
    setPersonaChatsMap(prev => {
      const existing = prev[personaId]
      if (!existing) return prev
      return {
        ...prev,
        [personaId]: {
          ...existing,
          chats: existing.chats.map(c => c.id === chatId ? { ...c, title } : c),
        },
      }
    })
  }, [])

  const handleChatDelete = useCallback((personaId: string, chatId: string) => {
    setPersonaChatsMap(prev => {
      const existing = prev[personaId]
      if (!existing) return prev
      return {
        ...prev,
        [personaId]: {
          ...existing,
          chats: existing.chats.filter(c => c.id !== chatId),
        },
      }
    })
  }, [])

  const sharedPersonas = (personas ?? []).filter(p => p.sourceShareId !== null)
  const ownedPersonas  = (personas ?? []).filter(p => p.sourceShareId === null)

  const [shownShared, setShownShared] = useState(true)
  const [shownOwned,  setShownOwned]  = useState(true)

  const renderPersonaRow = (persona: Persona) => {
    const isExpanded   = expandedIds.has(persona.id)
    const isActive     = activePersonaId === persona.id
    const isDraft      = persona.status === 'draft'
    const chatData     = personaChatsMap[persona.id]
    const visibleChats = chatData?.chats.filter(
      c => !c.versionId || !persona.activeVersionId || c.versionId === persona.activeVersionId,
    ) ?? []

    const avatarUrl  = personaAvatarUrl(persona, isClient)
    const avatarIcon = avatarUrl
      ? <img src={avatarUrl} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: 'var(--shadow-sidebar-item-avatar)' }} />
      : <UserAiIcon size={20} />

    return (
      <m.div key={persona.id} variants={sectionItemVariants}>
        <SidebarProjectsSection
          fluid
          label={persona.name}
          icon={avatarIcon}
          active={isActive}
          expanded={isDraft ? false : isExpanded}
          onClick={() => isDraft
            ? push(AGENT_EDIT_ROUTE(persona.id))
            : handleExpand(persona.id, !isExpanded)}
          onExpandedChange={(v) => { if (!isDraft) handleExpand(persona.id, v) }}
          showExpandArrow={!isDraft}
          badge={isDraft ? <Badge color="Yellow" label="Draft" /> : undefined}
        >
          {!isDraft && (
            <>
              <SidebarMenuItem
                fluid
                variant="default"
                label="New chat"
                icon={<BubbleChatAddIcon size={20} />}
                href={`/agents/${persona.id}/chat`}
                onClick={() => { emitPersonaChatNav({ personaId: persona.id }); push(AGENT_CHAT_ROUTE(persona.id)) }}
              />
              {chatData?.loading && !chatData.loaded && Array.from({ length: 2 }).map((_, i) => (
                <SidebarMenuSkeleton key={i} index={i} fluid />
              ))}
              {visibleChats.map(chat => (
                <PersonaChatItem
                  key={chat.id}
                  personaId={persona.id}
                  chat={chat}
                  isActive={isActive && chat.id === activeChatId}
                  onSelect={() => { emitPersonaChatNav({ personaId: persona.id, chatId: chat.id }); push(`${AGENT_CHAT_ROUTE(persona.id)}?chatId=${chat.id}`) }}
                  onRename={(chatId, title) => handleChatRename(persona.id, chatId, title)}
                  onDelete={(chatId) => handleChatDelete(persona.id, chatId)}
                />
              ))}
              {chatData?.loaded && visibleChats.length === 0 && (
                <div style={{ padding: "4px 6px", fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", color: "var(--neutral-400)" }}>
                  No chats yet
                </div>
              )}
            </>
          )}
        </SidebarProjectsSection>
      </m.div>
    )
  }

  return (
    <>
      {/* Shared Agents — only rendered when loading or at least one shared agent exists */}
      {(isLoading || sharedPersonas.length > 0) && (
        <>
          <SidebarMenuItem
            fluid
            variant="header"
            label="Shared Agents"
            shown={shownShared}
            onShowClick={() => setShownShared(s => !s)}
          />
          <m.div
            animate={shownShared ? 'open' : 'closed'}
            initial={false}
            variants={sectionHeightVariants}
            style={{ overflow: shownShared ? 'visible' : 'hidden' }}
          >
            <m.div
              animate={shownShared ? 'open' : 'closed'}
              initial="closed"
              variants={sectionStaggerVariants}
              style={{ paddingTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}
            >
              {isLoading && Array.from({ length: 2 }).map((_, i) => (
                <SidebarMenuSkeleton key={i} index={i} fluid />
              ))}
              {!isLoading && sharedPersonas.slice(0, AGENT_LIST_LIMIT).map(renderPersonaRow)}
              {sharedPersonas.length > AGENT_LIST_LIMIT && (
                <m.div variants={sectionItemVariants}>
                  <SidebarMenuItem
                    fluid
                    variant="default"
                    icon={<MoreHorizontalIcon size={20} animated />}
                    label="See all agents"
                    href={AGENTS_ROUTE}
                    onClick={() => goToAgentsLibrary(pathname, push)}
                  />
                </m.div>
              )}
            </m.div>
          </m.div>
        </>
      )}

      {/* Your Agents — always rendered */}
      <SidebarMenuItem
        fluid
        variant="header"
        label="Your Agents"
        shown={shownOwned}
        onShowClick={() => setShownOwned(s => !s)}
      />
      <m.div
        animate={shownOwned ? 'open' : 'closed'}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow: shownOwned ? 'visible' : 'hidden' }}
      >
        <m.div
          animate={shownOwned ? 'open' : 'closed'}
          initial="closed"
          variants={sectionStaggerVariants}
          style={{ paddingTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}
        >
          <m.div variants={sectionItemVariants}>
            <SidebarMenuItem
              fluid
              variant="default"
              label="New Agent"
              icon={<UserAddOneIcon size={20} />}
              onClick={() => push(AGENTS_TEMPLATES_ROUTE)}
            />
          </m.div>
          {isLoading && Array.from({ length: 2 }).map((_, i) => (
            <SidebarMenuSkeleton key={i} index={i} fluid />
          ))}
          {!isLoading && ownedPersonas.length === 0 && (
            <div style={{ padding: "8px 6px", fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", color: "var(--neutral-400)" }}>
              No agents yet
            </div>
          )}
          {!isLoading && ownedPersonas.slice(0, AGENT_LIST_LIMIT).map(renderPersonaRow)}
          {ownedPersonas.length > AGENT_LIST_LIMIT && (
            <m.div variants={sectionItemVariants}>
              <SidebarMenuItem
                fluid
                variant="default"
                icon={<MoreHorizontalIcon size={20} animated />}
                label="See all agents"
                href={AGENTS_ROUTE}
                onClick={() => goToAgentsLibrary(pathname, push)}
              />
            </m.div>
          )}
        </m.div>
      </m.div>
    </>
  )
}
