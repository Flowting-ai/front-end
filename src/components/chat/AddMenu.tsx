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
import { fetchPersonas, personasForTeamContext } from '@/lib/api/personas'
import type { Persona } from '@/lib/api/personas'
import { usePinboard } from '@/context/pinboard-context'

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
  const pinFolders: PinFolder[] = contextFolders
    .filter(f => f.pinCount === undefined || f.pinCount > 0)
    .map(f => ({ id: f.id, name: f.label, pin_count: f.pinCount ?? 0 }))

  type OpenSubmenu = 'style' | 'persona' | 'pinFolders' | null
  const [openSubmenu, setOpenSubmenu] = useState<OpenSubmenu>(null)
  const styleMenuOpen      = openSubmenu === 'style'
  const personaMenuOpen    = openSubmenu === 'persona'
  const pinFoldersMenuOpen = openSubmenu === 'pinFolders'
  const [personas,           setPersonas]           = useState<Persona[]>([])
  const [loadingPersonas,    setLoadingPersonas]    = useState(false)

  useEffect(() => {
    if (!personaMenuOpen) return
    // fetchPersonas() has an internal 30s cache + in-flight dedup.
    // Only show the spinner when there are no cached results yet so
    // repeat opens don't flash "Loading…" on already-populated lists.
    const needsLoad = personas.length === 0
    if (needsLoad) setLoadingPersonas(true)
    fetchPersonas()
      .then(list => setPersonas(
        teamId
          // Team project: agents shared to that team only.
          ? personasForTeamContext(list, teamId)
          // Normal chat: personal and super-link agents only — never team-shared ones.
          : list.filter(p => p.visibility === 'private')
      ))
      .catch(() => setPersonas([]))
      .finally(() => setLoadingPersonas(false))
  }, [personaMenuOpen, teamId]) // eslint-disable-line react-hooks/exhaustive-deps -- personas.length read only for the initial guard, not a dep

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
                            onPersonaChange(selectedPersonaId === p.id ? null : { id: p.id, name: p.name, imageUrl: p.imageUrl, modelId: p.modelId, activeVersionId: p.activeVersionId, systemPrompt: null, temperature: null })
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
