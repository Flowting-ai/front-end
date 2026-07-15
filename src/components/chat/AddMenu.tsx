'use client'

import React, { useState, useEffect } from 'react'
import { Dropdown } from '@/components/Dropdown'
import {
  ArrowRightOneIcon,
  FolderAddIcon,
  FolderOneIcon,
  GlobalSearchIcon,
  QuillWriteTwoIcon,
  UserAiIcon,
} from '@strange-huge/icons'
import type { PinFolder } from '@/lib/api/pins'
import { fetchPersonas, personasForTeamContext, usePersonaRepoDeduped } from '@/lib/api/personas'
import { listTeamPersonaShares } from '@/lib/api/teams'
import { usePinboard } from '@/context/pinboard-context'
import { useOrg } from '@/context/org-context'
import { useAuth } from '@/context/auth-context'

// Module-level session cache: original team-persona repo ID → member's copy info.
// Shared across component instances; resets on page refresh.
const _teamCopyCache = new Map<string, SelectedPersonaInfo>()

export interface SelectedPersonaInfo {
  id:              string
  name:            string
  imageUrl:        string | null
  modelId:         string | null
  activeVersionId: string | null
  /** null = not yet fetched from the version; populated by the model-selector effect. */
  systemPrompt:    string | null
  temperature:     number | null
}

export const USE_STYLE_OPTIONS = [
  { id: 'none',         label: 'None',         subLabel: 'Default AI behavior' },
  { id: 'professional', label: 'Professional', subLabel: 'Polished, structured, business-ready' },
  { id: 'balanced',     label: 'Balanced',     subLabel: 'Friendly yet professional' },
  { id: 'casual',       label: 'Casual',       subLabel: 'Relaxed and conversational' },
  { id: 'witty',        label: 'Witty',        subLabel: 'Sharp, clever, playful' },
  { id: 'concise',      label: 'Concise',      subLabel: 'Short, direct, no fluff' },
  { id: 'executive',    label: 'Executive',    subLabel: 'Strategic, decision-oriented' },
  { id: 'academic',     label: 'Academic',     subLabel: 'Scholarly, precise, well-cited' },
  { id: 'creative',     label: 'Creative',     subLabel: 'Imaginative and unconventional' },
  { id: 'teaching',     label: 'Teaching',     subLabel: 'Step-by-step, builds understanding' },
  { id: 'socratic',     label: 'Socratic',     subLabel: 'Guides through questions' },
  { id: 'empathetic',   label: 'Empathetic',   subLabel: 'Warm, supportive, emotionally aware' },
] as const


export interface ChatAddMenuProps {
  webSearchEnabled:  boolean
  onWebSearchChange: (enabled: boolean) => void
  onAddFilesClick:   () => void
  selectedStyleId:   string | null
  onStyleChange:     (id: string | null) => void
  selectedFolders:   PinFolder[]
  onFolderToggle:    (folder: PinFolder) => void
  selectedPersonaId: string | null
  onPersonaChange:   (persona: SelectedPersonaInfo | null) => void
  /**
   * Team project scope. When set, the agent picker lists only agents shared to
   * this team (never private/individual ones). Omit/null outside a team project.
   */
  teamId?:           string | null
  hidePersona?:      boolean
  hideStyle?:        boolean
  hideWebSearch?:    boolean
  hidePinFolders?:   boolean
}

export function ChatAddMenu({
  webSearchEnabled,
  onWebSearchChange,
  onAddFilesClick,
  selectedStyleId,
  onStyleChange,
  selectedFolders,
  onFolderToggle,
  selectedPersonaId,
  onPersonaChange,
  teamId,
  hidePersona,
  hideStyle,
  hideWebSearch,
  hidePinFolders,
}: ChatAddMenuProps) {
  const { folders: contextFolders } = usePinboard()
  const { currentUserRole, orgId } = useOrg()
  const { user } = useAuth()
  const pinFolders: PinFolder[] = contextFolders
    .filter(f => f.pinCount === undefined || f.pinCount > 0)
    .map(f => ({ id: f.id, name: f.label, pin_count: f.pinCount ?? 0 }))

  type OpenSubmenu = 'style' | 'persona' | 'pinFolders' | null
  const [openSubmenu, setOpenSubmenu] = useState<OpenSubmenu>(null)
  const styleMenuOpen      = openSubmenu === 'style'
  const personaMenuOpen    = openSubmenu === 'persona'
  const pinFoldersMenuOpen = openSubmenu === 'pinFolders'
  const [personas,           setPersonas]           = useState<SelectedPersonaInfo[]>([])
  const [loadingPersonas,    setLoadingPersonas]    = useState(false)

  useEffect(() => {
    if (!personaMenuOpen) return
    // Only show the spinner when there are no cached results yet.
    const needsLoad = personas.length === 0
    if (needsLoad) setLoadingPersonas(true)

    // Members/editors can't use another user's persona directly — _resolve_persona
    // enforces ownership. For team projects, transparently copy each team-shared
    // persona the caller doesn't personally own into their own account, so the
    // chat proceeds with their copy's version ID.
    //
    // Ownership is per-persona, not per-org-role — `currentUserRole` alone would
    // treat every admin as owning every admin-created team-shared agent, not just
    // their own. listTeamPersonaShares carries the real creator id (same data the
    // org/teams "Shared by X" panel uses); fall back to the coarse role check only
    // if that fetch hasn't resolved yet, to avoid blocking the menu on it.
    const ownerMapPromise = teamId && orgId
      ? listTeamPersonaShares(orgId, teamId).then(shares => {
          const map: Record<string, string> = {}
          for (const s of shares) map[s.personaRepoId] = s.sharedByUserId
          return map
        }).catch(() => ({} as Record<string, string>))
      : Promise.resolve({} as Record<string, string>)

    fetchPersonas()
      .then(async list => {
        if (teamId) {
          const ownerMap = await ownerMapPromise
          const isOwnedByMe = (repoId: string) => {
            const ownerId = ownerMap[repoId]
            return ownerId ? String(ownerId) === String(user?.id) : currentUserRole === 'admin'
          }
          const teamPersonas = personasForTeamContext(list, teamId)
          const resolved = await Promise.all(teamPersonas.map(async p => {
            const base: SelectedPersonaInfo = { id: p.id, name: p.name, imageUrl: p.imageUrl, modelId: p.modelId, activeVersionId: p.activeVersionId, systemPrompt: null, temperature: p.temperature }
            if (p.visibility !== 'team' || isOwnedByMe(p.id)) return base
            const cached = _teamCopyCache.get(p.id)
            if (cached) return cached
            try {
              const copy = await usePersonaRepoDeduped(p.id)
              const v = copy.published_version ?? copy.active_version
              const info: SelectedPersonaInfo = {
                id: copy.id,
                name: p.name,
                imageUrl: v?.image_url ?? p.imageUrl,
                modelId: v?.model_id ?? p.modelId,
                activeVersionId: copy.published_version_id ?? null,
                systemPrompt: null,
                temperature: v?.temperature ?? p.temperature,
              }
              _teamCopyCache.set(p.id, info)
              return info
            } catch { return base }
          }))
          setPersonas(resolved)
        } else {
          setPersonas(list.filter(p => p.visibility === 'private').map(p => ({ id: p.id, name: p.name, imageUrl: p.imageUrl, modelId: p.modelId, activeVersionId: p.activeVersionId, systemPrompt: null, temperature: p.temperature })))
        }
      })
      .catch(() => setPersonas([]))
      .finally(() => setLoadingPersonas(false))
  }, [personaMenuOpen, teamId, currentUserRole, orgId, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- personas.length read only for the initial guard, not a dep

  return (
    <Dropdown style={{ width: 200 }}>
      <Dropdown.Section fluid>
        <Dropdown.Item label="Add files or photos" icon={<FolderAddIcon />}    fluid onClick={onAddFilesClick} />
        {!hideWebSearch && (
          <Dropdown.Item label="Web search" icon={<GlobalSearchIcon />} fluid showSwitch switchChecked={webSearchEnabled} onSwitchChange={onWebSearchChange} />
        )}
        {!hideStyle && (
          /* Dropdown.Float keeps submenu clicks from bubbling to the ChatInput's
             close-on-click wrapper and dismissing the outer dropdown prematurely. */
          <Dropdown.Float
            open={styleMenuOpen}
            onOpenChange={(open) => setOpenSubmenu(open ? 'style' : null)}
            placement="right-start"
            trigger={
              <Dropdown.Item label="Use style" icon={<QuillWriteTwoIcon />} fluid rightIcon={<ArrowRightOneIcon />} />
            }
          >
            <Dropdown size="md" maxHeight="min(278px, calc(100dvh - 120px))">
              <Dropdown.Section fluid>
                {USE_STYLE_OPTIONS.map((opt) => (
                  <Dropdown.Item
                    key={opt.id}
                    label={opt.label}
                    subLabel={opt.subLabel}
                    selected={opt.id === 'none' ? selectedStyleId === null : selectedStyleId === opt.id}
                    onClick={() => { onStyleChange(opt.id === 'none' ? null : opt.id); setOpenSubmenu(null) }}
                    fluid
                  />
                ))}
              </Dropdown.Section>
            </Dropdown>
          </Dropdown.Float>
        )}
        {!hidePersona && (
          <Dropdown.Float
            open={personaMenuOpen}
            onOpenChange={(open) => setOpenSubmenu(open ? 'persona' : null)}
            placement="right-start"
            trigger={
              <Dropdown.Item
                label="Add agent"
                icon={<UserAiIcon />}
                fluid
                rightIcon={<ArrowRightOneIcon />}
                selected={!!selectedPersonaId}
              />
            }
          >
            <Dropdown size="md" style={{ minWidth: 200 }} maxHeight="min(248px, calc(100dvh - 120px))">
              <Dropdown.Section fluid>
                {loadingPersonas
                  ? <Dropdown.Item label="Loading…" fluid disabled />
                  : personas.length > 0
                    ? personas.map((p) => (
                        <Dropdown.Item
                          key={p.id}
                          label={p.name}
                          fluid
                          selected={selectedPersonaId === p.id}
                          onClick={() => {
                            onPersonaChange(selectedPersonaId === p.id ? null : p)
                            setOpenSubmenu(null)
                          }}
                        />
                      ))
                    : <Dropdown.Item label={teamId ? 'No shared team agents' : 'No agents yet'} fluid disabled />
                }
              </Dropdown.Section>
            </Dropdown>
          </Dropdown.Float>
        )}
        {!hidePinFolders && (
        <Dropdown.Float
          open={pinFoldersMenuOpen}
          onOpenChange={(open) => setOpenSubmenu(open ? 'pinFolders' : null)}
          placement="right-start"
          trigger={
            <Dropdown.Item label="Pin folders" icon={<FolderOneIcon variant="static" />} fluid rightIcon={<ArrowRightOneIcon />} />
          }
        >
          <Dropdown size="md" style={{ minWidth: 180 }} maxHeight="min(280px, calc(100dvh - 120px))">
            <Dropdown.Section label="Your folders" fluid>
              {pinFolders.length > 0
                  ? pinFolders.map((f) => (
                      <Dropdown.Item
                        key={f.id}
                        label={f.name}
                        icon={<FolderOneIcon variant="static" animated />}
                        fluid
                        selected={selectedFolders.some(sf => sf.id === f.id)}
                        onClick={() => onFolderToggle(f)}
                      />
                    ))
                  : <Dropdown.Item label="No folders yet" fluid disabled />
              }
            </Dropdown.Section>
          </Dropdown>
        </Dropdown.Float>
        )}
      </Dropdown.Section>
    </Dropdown>
  )
}
