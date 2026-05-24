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
import { listPinFolders } from '@/lib/api/pins'
import type { PinFolder } from '@/lib/api/pins'
import { fetchPersonas } from '@/lib/api/personas'
import type { Persona } from '@/lib/api/personas'

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
}: ChatAddMenuProps) {
  const [styleMenuOpen,      setStyleMenuOpen]      = useState(false)
  const [pinFoldersMenuOpen, setPinFoldersMenuOpen] = useState(false)
  const [personaMenuOpen,    setPersonaMenuOpen]    = useState(false)
  const [pinFolders,         setPinFolders]         = useState<PinFolder[]>([])
  const [loadingFolders,     setLoadingFolders]     = useState(false)
  const [personas,           setPersonas]           = useState<Persona[]>([])
  const [loadingPersonas,    setLoadingPersonas]    = useState(false)

  // Fetch fresh from the API each time the submenu opens
  // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18+ batches these; useReducer refactor tracked separately
  useEffect(() => {
    if (!pinFoldersMenuOpen) return
    setLoadingFolders(true)
    listPinFolders()
      .then((folders) => setPinFolders(folders.filter((f) => f.pin_count > 0)))
      .catch(() => setPinFolders([]))
      .finally(() => setLoadingFolders(false))
  }, [pinFoldersMenuOpen])

  // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18+ batches these; useReducer refactor tracked separately
  useEffect(() => {
    if (!personaMenuOpen) return
    setLoadingPersonas(true)
    fetchPersonas()
      .then(setPersonas)
      .catch(() => setPersonas([]))
      .finally(() => setLoadingPersonas(false))
  }, [personaMenuOpen])

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
          open={personaMenuOpen}
          onOpenChange={setPersonaMenuOpen}
          placement="right-start"
          trigger={
            <Dropdown.Item
              label="Add persona"
              icon={<UserAiIcon />}
              fluid
              rightIcon={<ArrowRightOneIcon />}
              selected={!!selectedPersonaId}
            />
          }
        >
          <Dropdown size="md" style={{ minWidth: 200 }} maxHeight="min(280px, calc(100dvh - 120px))">
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
                          setPersonaMenuOpen(false)
                        }}
                      />
                    ))
                  : <Dropdown.Item label="No personas yet" fluid disabled />
              }
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
