"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { m } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";
import { useGuardedRouter } from "@/context/nav-guard-context";
import { MoreHorizontalIcon, PlusSignIcon, UserAiIcon } from "@strange-huge/icons";
import { SidebarMenuItem, SidebarMenuSkeleton, SidebarProjectsSection } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { fetchPersonaChats, personasForTeamContext, isDraftPersona } from "@/lib/api/personas";
import { can } from "@/lib/agent-permissions";
import type { PersonaChat } from "@/lib/api/personas";
import { resolveViewerUserId } from "@/lib/api/teams";
import { usePersonas } from "@/lib/queries/personas";
import { emitPersonaChatNav } from "@/hooks/use-sidebar-events";
import type { PersonaChatEventDetail } from "@/hooks/use-sidebar-events";
import { useOrg } from "@/context/org-context";
import { Badge } from "@/components/Badge";
import { AGENT_CHAT_ROUTE, AGENT_EDIT_ROUTE, AGENTS_ROUTE } from "@/lib/routes";
import { sectionHeightVariants, sectionStaggerVariants, sectionItemVariants } from "./section-motion";
import { personaAvatarUrl, AGENT_LIST_LIMIT, goToAgentsLibrary } from "./sidebar-helpers";
import { PersonaChatItem } from "./PersonaChatItem";

// -- Personas section - all personas, each collapsible with their chats -------


// Team has no backend route left at all, so there's no way to resolve a
// shared persona's real owner any more — isPersonaOwnedByViewer falls back to
// the coarse currentUserRole check for every org-shared persona (accepted
// capability gap). Module-level so its reference stays stable across renders
// instead of invalidating memoized values that depend on it every time.
const EMPTY_PERSONA_OWNER_MAP: Record<string, string> = {}

export function PersonasSectionAll({ teamId }: { teamId?: string | null } = {}) {
  const isClient            = useIsClient()
  const { push }            = useGuardedRouter()
  const pathname            = usePathname()
  const personaSearchParams = useSearchParams()
  const { currentUserRole, members } = useOrg()
  const { user } = useAuth()
  // `user?.id` is never populated by the backend's /users/me — resolve the
  // viewer's internal id via the org member list instead (see resolveViewerUserId).
  const viewerUserId = resolveViewerUserId(members, user?.email)

  const personaMatch    = pathname?.match(/^\/agents\/([^/]+)\/chat/)
  const activePersonaId = personaMatch?.[1] ?? null
  const activeChatId    = personaSearchParams.get("chatId")

  const [expandedIds,     setExpandedIds]     = useState<Set<string>>(new Set())
  const [personaChatsMap, setPersonaChatsMap] = useState<
    Record<string, { chats: PersonaChat[]; loaded: boolean; loading: boolean }>
  >({})
  // Real per-persona ownership (not an org-role guess) — needed so the sidebar
  // never surfaces a team-shared agent this viewer doesn't own. Its "New chat"
  // button skips the clone-before-chat step the chat chip picker and Team
  // panel use, so an un-owned team-shared agent here would 404 on first send.
  const personaOwnerMap = EMPTY_PERSONA_OWNER_MAP

  // Shared cache/subscription across every usePersonas() consumer — still backed
  // by fetchPersonas() (same TTL, dedupe); filter to team-shared only when
  // teamId is provided, same as the old mount-effect did.
  const { data: allPersonas, isLoading } = usePersonas()

  const rawPersonas = useMemo(
    () => personasForTeamContext(allPersonas ?? [], teamId ?? null),
    [allPersonas, teamId],
  )

  const personas = useMemo(
    () => rawPersonas.filter(p => !isDraftPersona(p) && can({ userId: viewerUserId, isAdmin: currentUserRole === 'admin', ownerMap: personaOwnerMap }, 'list', p)),
    [rawPersonas, personaOwnerMap, viewerUserId, currentUserRole],
  )

  // Load chats for a given persona — idempotent (no-op if already loaded/loading)
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

  // Auto-expand and load the active persona whenever the URL changes
  useEffect(() => {
    if (!activePersonaId) return
    setExpandedIds(prev => {
      if (prev.has(activePersonaId)) return prev
      return new Set([...prev, activePersonaId])
    })
    loadPersonaChats(activePersonaId)
  }, [activePersonaId, loadPersonaChats])

  // Listen for chat created / title-updated events
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

  const [shown, setShown] = useState(true)

  return (
    <>
      <SidebarMenuItem fluid variant="header" label="Agents" shown={shown} onShowClick={() => setShown(s => !s)} />
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

          {!isLoading && personas.length === 0 && (
            <div
              style={{
                padding:    "8px 6px",
                fontFamily: "var(--font-body)",
                fontSize:   "var(--font-size-caption)",
                color:      "var(--neutral-400)",
              }}
            >
              {teamId ? 'No shared agents for this team yet' : 'No agents yet'}
            </div>
          )}

          {personas.slice(0, AGENT_LIST_LIMIT).map(persona => {
            const isExpanded = expandedIds.has(persona.id)
            const isActive   = activePersonaId === persona.id
            const isDraft    = persona.status === 'draft'
            const chatData   = personaChatsMap[persona.id]
            // Only show chats that belong to the persona's currently active version.
            // Chats without a versionId (optimistically created this session or
            // legacy rows) are kept so they don't vanish from under the user.
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
                  badge={isDraft ? (
                    <Badge color="Yellow" label="Draft" />
                  ) : persona.sourceShareId !== null ? (
                    <Badge color="Blue" label="Shared" />
                  ) : undefined}
                >
                  {!isDraft && (
                    <>
                      {/* New chat button */}
                      <SidebarMenuItem
                        fluid
                        variant="default"
                        label="New chat"
                        icon={<PlusSignIcon size={20} />}
                        href={`/agents/${persona.id}/chat`}
                        onClick={() => { emitPersonaChatNav({ personaId: persona.id }); push(AGENT_CHAT_ROUTE(persona.id)) }}
                      />

                      {/* Loading skeletons */}
                      {chatData?.loading && !chatData.loaded && Array.from({ length: 2 }).map((_, i) => (
                        <SidebarMenuSkeleton key={i} index={i} fluid />
                      ))}

                      {/* Chat items */}
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

                      {/* Empty state */}
                      {chatData?.loaded && visibleChats.length === 0 && (
                        <div
                          style={{
                            padding:    "4px 6px",
                            fontFamily: "var(--font-body)",
                            fontSize:   "var(--font-size-caption)",
                            color:      "var(--neutral-400)",
                          }}
                        >
                          No chats yet
                        </div>
                      )}
                    </>
                  )}
                </SidebarProjectsSection>
              </m.div>
            )
          })}

          {personas.length > AGENT_LIST_LIMIT && (
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
