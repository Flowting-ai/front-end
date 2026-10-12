'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Button } from '@/components/ui/button'
import { type Persona } from '@/lib/api/personas'
import { can, agentRole, type AgentViewer } from '@/lib/agent-permissions'
import { patchableVersionId, type ModelUnavailableReason } from '@/lib/agent-model-health'
import { PersonaCard, PERSONA_CARD_HEIGHT, PERSONA_CARD_WIDTH } from '@/components/PersonaCard'
import { PersonaCardSkeleton } from '@/components/PersonaCard/PersonaCardSkeleton'

const GRID_GAP = 16

export interface AgentsGridProps {
  /** The page's scroll container — measured for column count and used by the virtualizer. */
  scrollRef: React.RefObject<HTMLDivElement | null>
  isLoading: boolean
  /** The filtered, sorted agents to show. */
  filtered: Persona[]
  search: string
  activeFilterCount: number
  onClearFilters: () => void
  onCreateAgent: () => void
  viewer: AgentViewer
  activeShareRepoIds: Set<string>
  visibilityForPersona: Record<string, 'private' | 'team'>
  createdByForPersona: Record<string, string>
  draftAvatarMap: Record<string, string>
  draftTagsMap: Record<string, string[]>
  isDraftLike: (persona: Persona) => boolean
  modelUnavailableReason: (modelId: string | null) => ModelUnavailableReason | null
  resolveModelName: (modelId: string | null) => string | null
  pausingIds: Set<string>
  handleCopyAndEdit: (persona: Persona) => Promise<void>
  handleUseTeamSharedInChat: (persona: Persona) => Promise<void>
  handleUseInChat: (persona: Persona, isOwned: boolean) => void
  handlePauseToggle: (id: string, name: string, currentlyPaused: boolean) => Promise<void>
  onOpenDetails: (id: string) => void
  onEdit: (id: string) => void
  onShare: (target: { repoId: string; name: string }) => void
  onChangeModel: (persona: Persona) => void
  onDelete: (persona: Persona) => void
}

export function AgentsGrid({
  scrollRef, isLoading, filtered, search, activeFilterCount, onClearFilters, onCreateAgent,
  viewer, activeShareRepoIds, visibilityForPersona, createdByForPersona, draftAvatarMap, draftTagsMap,
  isDraftLike, modelUnavailableReason, resolveModelName, pausingIds,
  handleCopyAndEdit, handleUseTeamSharedInChat, handleUseInChat, handlePauseToggle,
  onOpenDetails, onEdit, onShare, onChangeModel, onDelete,
}: AgentsGridProps) {
  // How many 314px cards fit across: 3 when there is room, fewer when the details panel (or a
  // narrow window) squeezes the list. Measured from the scroll container so it reacts to the panel
  // opening and closing; the loading skeleton uses the same number.
  const [gridWidth, setGridWidth] = useState(0)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setGridWidth(el.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [scrollRef])
  const GRID_COLS = gridWidth === 0
    ? 3
    : Math.min(3, Math.max(1, Math.floor((gridWidth + GRID_GAP) / (PERSONA_CARD_WIDTH + GRID_GAP))))
  const gridRows = useMemo(() => {
    const rows: Persona[][] = []
    for (let i = 0; i < filtered.length; i += GRID_COLS) rows.push(filtered.slice(i, i + GRID_COLS))
    return rows
  }, [filtered, GRID_COLS])
  const gridVirtualizer = useVirtualizer({
    count:            gridRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize:     () => PERSONA_CARD_HEIGHT + GRID_GAP,
    overscan:         2,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {isLoading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, ${PERSONA_CARD_WIDTH}px))`,
          justifyContent: 'center',
          gap: GRID_GAP,
        }}>
          {/* Two rows of cards, in as many columns as the real grid has right now. */}
          {Array.from({ length: GRID_COLS * 2 }).map((_, i) => (
            <PersonaCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        (search.trim() || activeFilterCount > 0) ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '80px 24px',
          }}>
            <p role="status" style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--font-weight-regular)',
              fontSize: 14,
              lineHeight: '22px',
              color: 'var(--neutral-500)',
              textAlign: 'center',
              margin: 0,
            }}>
              {search.trim()
                ? `No agents matching “${search}”${activeFilterCount > 0 ? ' with the current filters' : ''}`
                : 'No agents match your filters'}
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => onClearFilters()}
                style={{
                  background: 'none', border: '1px solid var(--border-default)',
                  borderRadius: 8, cursor: 'pointer', padding: '6px 14px',
                  fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
                  color: 'var(--neutral-600)',
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            padding: '48px 24px',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <p style={{
                fontFamily: 'var(--font-title)',
                fontWeight: 'var(--font-weight-regular)',
                fontSize: 24,
                lineHeight: '32px',
                color: 'var(--legacy-1a1916)',
                margin: 0,
                whiteSpace: 'nowrap',
              }}>
                No agents yet
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--font-weight-regular)',
                fontSize: 16,
                lineHeight: '22px',
                color: 'var(--legacy-1a1916)',
                textAlign: 'center',
                maxWidth: 427,
                margin: 0,
              }}>
                Agents are your custom AI configurations - define behavior, connect knowledge, and share via link.
              </p>
            </div>
            <Button variant="default" onClick={() => onCreateAgent()}>
              Create your first agent
            </Button>
          </div>
        )
      ) : (
        <div style={{ position: 'relative', height: gridVirtualizer.getTotalSize() }}>
          {gridVirtualizer.getVirtualItems().map((vRow) => (
            <div
              key={vRow.index}
              data-index={vRow.index}
              ref={gridVirtualizer.measureElement}
              style={{
                position:            'absolute',
                top:                 vRow.start,
                left:                0,
                width:               '100%',
                display:             'grid',
                // Match may-day: every card is a uniform 314px wide
                // (caps at 314, shrinks equally on narrow widths) and the
                // row is centred so cards never stretch unevenly.
                gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, ${PERSONA_CARD_WIDTH}px))`,
                justifyContent:      'center',
                gap:                 GRID_GAP,
                paddingBottom:       16,
              }}
            >
              {gridRows[vRow.index].map(persona => (
                <PersonaCard
                  key={persona.id}
                  // Fill the grid cell width (the DS default is a fixed
                  // 314px, which overflows the 1fr cells) — height is no
                  // longer stretched here since PersonaCard now enforces
                  // its own fixed height directly, so every card lines up
                  // without depending on row-mates.
                  style={{ width: '100%' }}
                  variant={isDraftLike(persona) ? 'draft' : 'default'}
                  avatarSeed={persona.activeVersionId ?? persona.workingVersionId ?? persona.id}
                  repoId={persona.id}
                  name={persona.name}
                  handle={persona.handle.replace(/^@/, '')}
                  description={
                    isDraftLike(persona) && !persona.description
                      ? 'Tap Edit to add a system instruction and publish this agent.'
                      : persona.description
                  }
                  avatarUrl={draftAvatarMap[persona.id] ?? persona.imageUrl ?? undefined}
                  tags={draftTagsMap[persona.id] ?? persona.tags}
                  paused={persona.isPaused}
                  // Super Link-accepted only — the team-visibility half of this
                  // is hidden along with the rest of the shared-agent UI (see
                  // SharingTab.tsx), not deleted from `Persona.visibility` itself.
                  shared={persona.sourceShareId !== null}
                  createdBy={createdByForPersona[persona.id]}
                  useInChatLabel="Use in chat"
                  // Draft cards already have their own "finish setup" treatment —
                  // only live/published agents get the model-unavailable overlay.
                  modelUnavailable={!isDraftLike(persona) && !!modelUnavailableReason(persona.modelId)}
                  modelUnavailableReason={modelUnavailableReason(persona.modelId) ?? undefined}
                  unavailableModelName={resolveModelName(persona.modelId)}
                  // Withheld when there's no version to patch, so the
                  // button can never render as a no-op.
                  onChangeModel={
                    patchableVersionId(persona)
                      ? () => onChangeModel(persona)
                      : undefined
                  }
                  superlink={activeShareRepoIds.has(persona.id)}
                  // Clicking the card itself (not one of its buttons or its ⋯ menu) opens the
                  // details panel for this agent.
                  onClick={event => {
                    if ((event.target as HTMLElement).closest('button, a, [role="menu"], [role="menuitem"], [role="dialog"]')) return
                    onOpenDetails(persona.id)
                  }}
                  // "Team" badge hidden along with the rest of the shared-agent UI —
                  // every card reads as Private regardless of the underlying value.
                  visibility={visibilityForPersona[persona.id] ? 'private' : undefined}
                  {...(() => {
                    // Team-shared originals not created by this user (regardless of
                    // their own org role) — they cannot edit/delete/share the
                    // original; they copy it first.
                    const isTeamShared = agentRole(persona, viewer) === 'team-viewer'
                    if (isTeamShared) return {
                      onMenuDetails:     () => onOpenDetails(persona.id),
                      onEdit:            () => void handleCopyAndEdit(persona),
                      onUseInChat:       () => void handleUseTeamSharedInChat(persona),
                      onMenuDuplicate:   () => void handleCopyAndEdit(persona),
                    }
                    // Owned personas (private copies or admin's own team agents)
                    const isOwned = can(viewer, 'edit', persona)
                    return {
                      onMenuDetails:     () => onOpenDetails(persona.id),
                      onEdit:            isOwned ? () => onEdit(persona.id) : undefined,
                      onLink:            isOwned ? () => onShare({ repoId: persona.id, name: persona.name }) : undefined,
                      // Same "hand off via sessionStorage, land on a fresh /chat
                      // with the agent pre-attached" pattern as agents/published's
                      // "Use this Agent" — this used to push AGENT_CHAT_ROUTE,
                      // landing on the agent's own dedicated chat thread instead
                      // of attaching it to a new regular chat.
                      onUseInChat:       () => handleUseInChat(persona, isOwned),
                      onResume:          isOwned ? () => handlePauseToggle(persona.id, persona.name, persona.isPaused) : undefined,
                      onMenuEdit:        isOwned ? () => onEdit(persona.id) : undefined,
                      onMenuShare:       isOwned ? () => onShare({ repoId: persona.id, name: persona.name }) : undefined,
                      onMenuPauseToggle: isOwned && (persona.activeVersionId !== null || persona.isPaused) ? () => handlePauseToggle(persona.id, persona.name, persona.isPaused) : undefined,
                      pausePending:      pausingIds.has(persona.id),
                      onMenuDelete:      () => onDelete(persona),
                    }
                  })()}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
