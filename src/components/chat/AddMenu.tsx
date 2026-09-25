'use client'

import React, { useState } from 'react'
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
import { useSelectableChatPersonas } from '@/hooks/use-selectable-chat-personas'
import type { SelectedPersonaInfo } from '@/lib/chat-personas'
import { usePinboard } from '@/context/pinboard-context'
import { getPersonaFallbackAvatar } from '@/lib/persona-template-avatars'
import { USE_STYLE_OPTIONS } from '@/lib/tone-options'
export type { SelectedPersonaInfo } from '@/lib/chat-personas'


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
  const { personas, loading: loadingPersonas } = useSelectableChatPersonas(personaMenuOpen)

  return (
    <Dropdown style={{ width: 200 }} maxHeight={false}>
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
                          avatar={
                            <img
                              src={p.imageUrl ?? getPersonaFallbackAvatar(p.id)}
                              alt=""
                              style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover' }}
                            />
                          }
                          fluid
                          selected={selectedPersonaId === p.id}
                          onClick={() => {
                            onPersonaChange(selectedPersonaId === p.id ? null : p)
                            setOpenSubmenu(null)
                          }}
                        />
                      ))
                    : <Dropdown.Item label="No agents yet" fluid disabled />
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
