'use client'

import React, { useState, useEffect } from 'react'
import { Dropdown } from '@/components/Dropdown'
import {
  ArrowRightOneIcon,
  FolderAddIcon,
  FolderOneIcon,
  GlobalSearchIcon,
  QuillWriteTwoIcon,
} from '@strange-huge/icons'
import { listPinFolders } from '@/lib/api/pins'
import type { PinFolder } from '@/lib/api/pins'

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
}

export function ChatAddMenu({
  webSearchEnabled,
  onWebSearchChange,
  onAddFilesClick,
  selectedStyleId,
  onStyleChange,
  selectedFolders,
  onFolderToggle,
}: ChatAddMenuProps) {
  const [styleMenuOpen,      setStyleMenuOpen]      = useState(false)
  const [pinFoldersMenuOpen, setPinFoldersMenuOpen] = useState(false)
  const [pinFolders,         setPinFolders]         = useState<PinFolder[]>([])
  const [loadingFolders,     setLoadingFolders]     = useState(false)

  // Fetch fresh from the API each time the submenu opens
  useEffect(() => {
    if (!pinFoldersMenuOpen) return
    setLoadingFolders(true)
    listPinFolders()
      .then((folders) => setPinFolders(folders.filter((f) => f.pin_count > 0)))
      .catch(() => setPinFolders([]))
      .finally(() => setLoadingFolders(false))
  }, [pinFoldersMenuOpen])

  return (
    <Dropdown style={{ width: 200 }}>
      <Dropdown.Section fluid>
        <Dropdown.Item label="Add files or photos" icon={<FolderAddIcon />}    fluid onClick={onAddFilesClick} />
        <Dropdown.Item label="Web search"           icon={<GlobalSearchIcon />} fluid showSwitch switchChecked={webSearchEnabled} onSwitchChange={onWebSearchChange} />
        {/* Dropdown.Float keeps submenu clicks from bubbling to the ChatInput's
            close-on-click wrapper and dismissing the outer dropdown prematurely. */}
        <Dropdown.Float
          open={styleMenuOpen}
          onOpenChange={setStyleMenuOpen}
          placement="right-start"
          trigger={
            <Dropdown.Item label="Use style" icon={<QuillWriteTwoIcon />} fluid rightIcon={<ArrowRightOneIcon />} />
          }
        >
          <Dropdown size="md">
            <Dropdown.Section fluid>
              {USE_STYLE_OPTIONS.map((opt) => (
                <Dropdown.Item
                  key={opt.id}
                  label={opt.label}
                  subLabel={opt.subLabel}
                  selected={opt.id === 'none' ? selectedStyleId === null : selectedStyleId === opt.id}
                  onClick={() => { onStyleChange(opt.id === 'none' ? null : opt.id); setStyleMenuOpen(false) }}
                  fluid
                />
              ))}
            </Dropdown.Section>
          </Dropdown>
        </Dropdown.Float>
<Dropdown.Float
          open={pinFoldersMenuOpen}
          onOpenChange={setPinFoldersMenuOpen}
          placement="right-start"
          trigger={
            <Dropdown.Item label="Pin folders" icon={<FolderOneIcon />} fluid rightIcon={<ArrowRightOneIcon />} />
          }
        >
          <Dropdown size="md" style={{ minWidth: 180 }} maxHeight="min(200px, calc(100dvh - 120px))">
            <Dropdown.Section label="Your folders" fluid>
              {loadingFolders
                ? <Dropdown.Item label="Loading…" fluid disabled />
                : pinFolders.length > 0
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
      </Dropdown.Section>
    </Dropdown>
  )
}
