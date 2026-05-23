'use client'

import React, { Suspense, useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { X } from 'lucide-react'
import { ChatInterface }                                   from '@/components/chat/ChatInterface'
import { ChatInput }                                       from '@/components/chat/ChatInput'
import { ModelMenu }                                        from '@/components/chat/ModelMenu'
import { AttachmentManager, type PendingAttachment }       from '@/components/chat/AttachmentManager'
import { InitialPrompts }                                  from '@/components/chat/InitialPrompts'
import { ModelSwitchDialog }                               from '@/components/chat/ModelSwitchDialog'
import { PinMentionDropdown }                              from '@/components/chat/PinMentionDropdown'
import { useModelSelectorContext }                         from '@/context/model-selector-context'
import { useChatHistoryContext }                           from '@/context/chat-history-context'
import { useProjects }                                     from '@/context/projects-context'
import { useFileUpload }                                   from '@/hooks/use-file-upload'
import { useFileDrop }                                     from '@/hooks/use-file-drop'
import { usePinOperations }                                from '@/hooks/use-pin-operations'
import { listPinFolders }                                  from '@/lib/api/pins'
import { fetchPersonas, getVersion }                       from '@/lib/api/personas'
import type { Persona }                                    from '@/lib/api/personas'
import { Dropdown }                                        from '@/components/Dropdown'
import { Chip }                                            from '@/components/Chip'
import { Button }                                          from '@/components/Button'
import {
  ArrowRightOneIcon,
  FolderAddIcon,
  FolderOneIcon,
  GlobalSearchIcon,
  QuillWriteTwoIcon,
  UserAiIcon,
  QuillWriteOneIcon,
  NeuralNetworkIcon,
  AiVisionRecognitionIcon,
  AiWebBrowsingIcon,
  CalendarFoldIcon,
  StickyNoteTwoIcon,
  AuctionIcon,
} from '@strange-huge/icons'
import type { AIModel }      from '@/types/ai-model'
import type { Pin, PinFolder } from '@/lib/api/pins'

// ── Mentioned-pin state type ──────────────────────────────────────────────────

interface MentionedPin { id: string; label: string }

// ── Mention chip ──────────────────────────────────────────────────────────────

function MentionChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        gap:             '4px',
        borderRadius:    '999px',
        backgroundColor: 'var(--neutral-100)',
        border:          '1px solid var(--neutral-200)',
        padding:         '2px 8px 2px 10px',
        fontSize:        '12px',
        fontWeight:      500,
        color:           'var(--neutral-700)',
        fontFamily:      'var(--font-body)',
        maxWidth:        '200px',
        whiteSpace:      'nowrap',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>@{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove mention @${label}`}
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          justifyContent: 'center',
          border:         'none',
          background:     'none',
          padding:        '1px',
          cursor:         'pointer',
          color:          'var(--neutral-400)',
          borderRadius:   '50%',
          flexShrink:     0,
        }}
      >
        <X size={11} strokeWidth={2.5} />
      </button>
    </span>
  )
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex:          1,
        background:    'white',
        border:        `1px solid ${hovered ? 'var(--neutral-300)' : 'var(--neutral-200)'}`,
        borderRadius:  '12px',
        padding:       '14px 12px',
        cursor:        'pointer',
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'flex-start',
        gap:           '10px',
        textAlign:     'left',
        boxShadow:     hovered ? '0 2px 8px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
        transition:    'box-shadow 150ms, border-color 150ms',
        minWidth:      0,
      }}
    >
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize:   '13px',
          fontWeight: 500,
          color:      'var(--neutral-700)',
          margin:     0,
          lineHeight: 1.4,
        }}
      >
        {label}
      </p>
    </button>
  )
}

// ── Chat mode ─────────────────────────────────────────────────────────────────

type ChatMode = 'write' | 'research' | 'think' | 'build'

const ACTION_BUTTONS: Array<{ mode: ChatMode; label: string; icon: React.ReactNode; disabled?: boolean }> = [
  { mode: 'write',    label: 'Write',    icon: <QuillWriteOneIcon       size={16} animated /> },
  { mode: 'research', label: 'Research', icon: <NeuralNetworkIcon       size={16} animated />, disabled: true },
  { mode: 'think',    label: 'Think',    icon: <AiVisionRecognitionIcon size={16} animated /> },
  { mode: 'build',    label: 'Build',    icon: <AiWebBrowsingIcon       size={16} animated /> },
]

const MODE_PLACEHOLDERS: Record<ChatMode, string> = {
  write:    'What would you like to write?',
  research: 'What would you like to research?',
  think:    'What would you like to think through?',
  build:    'What would you like to build?',
}

const TEMPLATE_CARDS: Array<{ icon: React.ReactNode; label: string; prompt: string }> = [
  { icon: <CalendarFoldIcon  size={24} color="var(--yellow-500)" animated />, label: 'Prep me for an upcoming meeting',    prompt: 'Help me prepare for an upcoming meeting' },
  { icon: <StickyNoteTwoIcon size={24} color="#141B34"           animated />, label: 'Help me draft and structure my notes', prompt: 'Help me draft and structure my notes' },
  { icon: <AuctionIcon       size={24} color="var(--green-500)"  animated />, label: 'Compare and evaluate my options',     prompt: 'Help me compare and evaluate my options' },
]

// ── Style / Tone options ─────────────────────────────────────────────────────

const USE_STYLE_OPTIONS = [
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


// ── Add-menu ──────────────────────────────────────────────────────────────────

interface SelectedPersonaInfo { id: string; name: string; imageUrl: string | null; modelId: string | null; activeVersionId: string | null }

function AddMenu({
  webSearchEnabled,
  onWebSearchChange,
  onAddFilesClick,
  selectedStyleId,
  onStyleChange,
  selectedFolders,
  onFolderToggle,
  selectedPersonaId,
  onPersonaChange,
}: {
  webSearchEnabled:  boolean
  onWebSearchChange: (enabled: boolean) => void
  onAddFilesClick:   () => void
  selectedStyleId:   string | null
  onStyleChange:     (id: string | null) => void
  selectedFolders:   PinFolder[]
  onFolderToggle:    (folder: PinFolder) => void
  selectedPersonaId: string | null
  onPersonaChange:   (persona: SelectedPersonaInfo | null) => void
}) {
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
      .then(setPinFolders)
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
        {/* Use Dropdown.Float (click-triggered, stopsPropagation on trigger) so
            clicks on submenus don't bubble to the ChatInput's close-on-click
            wrapper and close the outer dropdown before options can be shown. */}
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
                          onPersonaChange(selectedPersonaId === p.id ? null : { id: p.id, name: p.name, imageUrl: p.imageUrl, modelId: p.modelId, activeVersionId: p.activeVersionId })
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

// ── Page ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
function ProjectChatPageInner() {
  const params       = useParams<{ id: string; chatId: string }>()
  const { replace }   = useRouter()
  const searchParams  = useSearchParams()
  const qParam        = searchParams.get('q')

  const { getProject, getChats, addChat, loadProjectChats } = useProjects()
  const { addOptimistic }          = useChatHistoryContext()
  const { processFiles, FILE_ACCEPT } = useFileUpload()

  const isNewChat = params.chatId === 'new'

  const project = getProject(params.id)
  const chats   = getChats(params.id)
  const chat    = isNewChat ? undefined : chats.find(c => c.id === params.chatId)

  useEffect(() => { loadProjectChats(params.id) }, [params.id, loadProjectChats])

  const [hasMessages,        setHasMessages]        = useState(!!qParam)
  const [initialPrompt,      setInitialPrompt]      = useState<string | null>(qParam)

  // useSearchParams() returns empty on the server, so qParam is null during SSR
  // and useState is initialized with null. This effect syncs the real value on
  // the client so the chat page immediately starts generating without re-entering text.
  useEffect(() => {
    if (qParam && isNewChat && !hasMessages) {
      setInitialPrompt(qParam)
      setHasMessages(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam])

  const [newChatInput,       setNewChatInput]       = useState('')
  const [selectedMode,       setSelectedMode]       = useState<ChatMode | null>(null)
  const [webSearchEnabled,   setWebSearchEnabled]   = useState(false)
  const [newChatAttachments, setNewChatAttachments] = useState<PendingAttachment[]>([])
  const [addMenuFiles,       setAddMenuFiles]       = useState<File[]>([])
  const [initialFiles,       setInitialFiles]       = useState<File[]>([])
  const [pendingModelSwitch, setPendingModelSwitch] = useState<AIModel | null>(null)
  const [selectedStyleId,    setSelectedStyleId]    = useState<string | null>(null)
  const [styleChipOpen,      setStyleChipOpen]      = useState(false)
  const [selectedFolders,    setSelectedFolders]    = useState<PinFolder[]>([])
  const [selectedPersona,    setSelectedPersona]    = useState<SelectedPersonaInfo | null>(null)
  const [personaChipOpen,    setPersonaChipOpen]    = useState(false)
  const [chipPersonas,       setChipPersonas]       = useState<SelectedPersonaInfo[]>([])
  const [loadingChipPersonas, setLoadingChipPersonas] = useState(false)

  // Tracks which chatIds in this session were created via the persona endpoint.
  const personaChatIds = useRef(new Map<string, string>()) // chatId → personaId

  const fileInputRef           = useRef<HTMLInputElement>(null)
  const newChatInputWrapperRef = useRef<HTMLDivElement>(null)

  // ── Pin @-mention state ───────────────────────────────────────────────────

  const [showPinDropdown,     setShowPinDropdown]     = useState(false)
  const [pinQuery,            setPinQuery]            = useState('')
  const [highlightedPinIndex, setHighlightedPinIndex] = useState(0)
  const [mentionedPins,       setMentionedPins]       = useState<MentionedPin[]>([])

  const { pins } = usePinOperations()

  const filteredPins = useMemo<Pin[]>(() => {
    if (!pinQuery.trim()) return pins.slice(0, 10)
    const q = pinQuery.toLowerCase()
    return pins.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    )
  }, [pins, pinQuery])

  // eslint-disable-next-line react-doctor/no-derived-state-effect -- index reset on filter change; not a component-level key-prop candidate
  useEffect(() => { setHighlightedPinIndex(0) }, [filteredPins])

  useEffect(() => {
    if (!showPinDropdown) return
    const handler = (e: MouseEvent) => {
      if (newChatInputWrapperRef.current && !newChatInputWrapperRef.current.contains(e.target as Node)) {
        setShowPinDropdown(false)
        setPinQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPinDropdown])

  const handleMentionChange = useCallback((query: string | null) => {
    if (query === null) { setShowPinDropdown(false); setPinQuery('') }
    else                { setShowPinDropdown(true);  setPinQuery(query) }
  }, [])

  const handlePinSelect = useCallback((pin: Pin) => {
    const label = (pin.title || pin.content).slice(0, 50) || pin.id
    setNewChatInput(prev => { const i = prev.lastIndexOf('@'); return i !== -1 ? prev.substring(0, i) : prev })
    setMentionedPins(prev => prev.some(m => m.id === pin.id) ? prev : [...prev, { id: pin.id, label }])
    setShowPinDropdown(false)
    setPinQuery('')
  }, [])

  const handlePinNavigate = useCallback((action: 'up' | 'down' | 'select' | 'close') => {
    switch (action) {
      case 'down':   setHighlightedPinIndex(i => i < filteredPins.length - 1 ? i + 1 : 0); break
      case 'up':     setHighlightedPinIndex(i => i > 0 ? i - 1 : filteredPins.length - 1); break
      case 'select': if (filteredPins[highlightedPinIndex]) handlePinSelect(filteredPins[highlightedPinIndex]); break
      case 'close':  setShowPinDropdown(false); setPinQuery(''); break
    }
  }, [filteredPins, highlightedPinIndex, handlePinSelect])

  // ── File handling ─────────────────────────────────────────────────────────

  const { isDragging } = useFileDrop({
    onFiles: files => { setNewChatAttachments(prev => processFiles(files, prev)) },
    disabled: hasMessages,
  })

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      if (isNewChat && !hasMessages) setNewChatAttachments(prev => processFiles(e.target.files!, prev))
      else              setAddMenuFiles(Array.from(e.target.files!))
      e.target.value = ''
    }
  }

  // ── Model selector ────────────────────────────────────────────────────────

  const { models, selectedModel, selectModel, open: openModelSelector, museActive, museAdvanced } = useModelSelectorContext()

  const modelButtonLabel = museActive
    ? museAdvanced ? 'Souvenir AI Muse (Advanced)' : 'Souvenir AI Muse (Basic)'
    : selectedModel?.modelName

  const handleModelClick = (e: React.MouseEvent<HTMLButtonElement>) => { openModelSelector(e.currentTarget) }

  const handleModelSwitchConfirm = () => {
    if (pendingModelSwitch) { selectModel(pendingModelSwitch); setPendingModelSwitch(null) }
  }

  const selectModelRef = useRef(selectModel)
  selectModelRef.current = selectModel

  useEffect(() => {
    if (!selectedPersona || !models.length) return

    if (selectedPersona.modelId) {
      const match = models.find(m => String(m.modelId ?? m.id) === selectedPersona.modelId)
      if (match) selectModelRef.current(match)
      return
    }

    if (!selectedPersona.activeVersionId) return
    let cancelled = false
    getVersion(selectedPersona.id, selectedPersona.activeVersionId)
      .then(version => {
        if (cancelled || !version.model_id) return
        const match = models.find(m => String(m.modelId ?? m.id) === version.model_id)
        if (match) selectModelRef.current(match)
        setSelectedPersona(prev =>
          prev?.id === selectedPersona.id ? { ...prev, modelId: version.model_id } : prev
        )
      })
      .catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- selectModel intentionally via ref
  }, [selectedPersona, models])

  // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18+ batches these; useReducer refactor tracked separately
  useEffect(() => {
    if (!personaChipOpen) return
    setLoadingChipPersonas(true)
    fetchPersonas()
      .then(list => setChipPersonas(list.map(p => ({ id: p.id, name: p.name, imageUrl: p.imageUrl, modelId: p.modelId, activeVersionId: p.activeVersionId }))))
      .catch(() => setChipPersonas([]))
      .finally(() => setLoadingChipPersonas(false))
  }, [personaChipOpen])

  // ── Chips ─────────────────────────────────────────────────────────────────

  const activeStyle = USE_STYLE_OPTIONS.find(s => s.id === selectedStyleId) ?? null

  // Persona is "active" when starting a new chat or the current chat was created
  // as a persona chat in this session; otherwise the chip is cosmetic (model only).
  const personaApplied = isNewChat || !!personaChatIds.current.get(params.chatId)

  const newChatChips: React.ReactNode = (
    <>
      {activeStyle && (
        <Dropdown.Float
          open={styleChipOpen}
          onOpenChange={setStyleChipOpen}
          placement="top-start"
          trigger={
            <Chip
              label={activeStyle.label}
              icon={<QuillWriteTwoIcon size={20} color="var(--chip-text)" />}
              onRemove={() => setSelectedStyleId(null)}
              onExpand={() => setStyleChipOpen(v => !v)}
            />
          }
        >
          <Dropdown size="md">
            <Dropdown.Section fluid>
              {USE_STYLE_OPTIONS.map(opt => (
                <Dropdown.Item
                  key={opt.id}
                  label={opt.label}
                  subLabel={opt.subLabel}
                  selected={opt.id === 'none' ? selectedStyleId === null : selectedStyleId === opt.id}
                  onClick={() => { setSelectedStyleId(opt.id === 'none' ? null : opt.id); setStyleChipOpen(false) }}
                  fluid
                />
              ))}
            </Dropdown.Section>
          </Dropdown>
        </Dropdown.Float>
      )}
      {selectedFolders.map(folder => (
        <Chip
          key={folder.id}
          label={folder.name}
          icon={<FolderOneIcon size={20} color="var(--chip-text)" />}
          onRemove={() => setSelectedFolders(prev => prev.filter(f => f.id !== folder.id))}
        />
      ))}
      {mentionedPins.map(mp => (
        <MentionChip key={mp.id} label={mp.label} onRemove={() => setMentionedPins(prev => prev.filter(m => m.id !== mp.id))} />
      ))}
      {webSearchEnabled && (
        <Chip key="web-search" size="Medium" icon={<GlobalSearchIcon size={20} color="var(--chip-text)" />} label="Web search" onRemove={() => setWebSearchEnabled(false)} />
      )}
      {selectedPersona && (
        <Dropdown.Float
          open={personaChipOpen}
          onOpenChange={setPersonaChipOpen}
          placement="top-start"
          trigger={
            <Chip
              label={selectedPersona.name}
              personaImage={selectedPersona.imageUrl ?? undefined}
              onRemove={() => setSelectedPersona(null)}
              onExpand={() => setPersonaChipOpen(v => !v)}
              title={!personaApplied ? "Persona model is active — system instructions apply to new chats only" : undefined}
              style={!personaApplied ? { opacity: 0.65 } : undefined}
            />
          }
        >
          <Dropdown size="md" style={{ minWidth: 200 }} maxHeight="min(280px, calc(100dvh - 120px))">
            <Dropdown.Section fluid>
              {loadingChipPersonas
                ? <Dropdown.Item label="Loading…" fluid disabled />
                : chipPersonas.length > 0
                  ? chipPersonas.map(p => (
                      <Dropdown.Item
                        key={p.id}
                        label={p.name}
                        fluid
                        selected={selectedPersona.id === p.id}
                        onClick={() => { setSelectedPersona(p); setPersonaChipOpen(false) }}
                      />
                    ))
                  : <Dropdown.Item label="No personas yet" fluid disabled />
              }
            </Dropdown.Section>
          </Dropdown>
        </Dropdown.Float>
      )}
    </>
  )

  const addMenu = (
    <AddMenu
      webSearchEnabled={webSearchEnabled}
      onWebSearchChange={setWebSearchEnabled}
      onAddFilesClick={() => fileInputRef.current?.click()}
      selectedStyleId={selectedStyleId}
      onStyleChange={setSelectedStyleId}
      selectedFolders={selectedFolders}
      onFolderToggle={(folder) => setSelectedFolders(prev =>
        prev.some(f => f.id === folder.id) ? prev.filter(f => f.id !== folder.id) : [...prev, folder]
      )}
      selectedPersonaId={selectedPersona?.id ?? null}
      onPersonaChange={setSelectedPersona}
    />
  )

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = (value: string) => {
    if (!value.trim()) return
    setInitialFiles(newChatAttachments.map(a => a.file))
    setNewChatAttachments([])
    setMentionedPins([])
    setInitialPrompt(value.trim())
    setNewChatInput('')
    setHasMessages(true)
    setSelectedMode(null)
  }

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!project || (!isNewChat && !chat)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ fontFamily: 'var(--font-body)', color: '#857a72' }}>Chat not found.</p>
      </div>
    )
  }

  // Show the new-chat UI only when we are on the /chat/new route AND
  // neither a manual send nor a URL prompt has been provided yet.
  // Existing chats (real chatId) always skip straight to ChatInterface.
  const isNewChatState = isNewChat && !hasMessages && !initialPrompt

  return (
    <div
      style={{
        flex:          1,
        position:      'relative',
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
        minHeight:     '400px',
        overflow:      'hidden',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={FILE_ACCEPT}
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        aria-hidden
      />

      <AnimatePresence mode="sync" initial={false}>
        {isNewChatState ? (
          <m.div
            key="new-chat"
            exit={{ opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }}
            className="kaya-scrollbar"
            style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}
          >
            {/* Drag-and-drop overlay */}
            {isDragging && (
              <div
                style={{
                  position:        'fixed',
                  inset:           0,
                  zIndex:          40,
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  backgroundColor: 'rgba(255,255,255,0.88)',
                  border:          '2px dashed var(--focus-ring)',
                  borderRadius:    '16px',
                  pointerEvents:   'none',
                }}
              >
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body-md)', color: 'var(--blue-600)', fontWeight: 500 }}>
                  Drop files here
                </span>
              </div>
            )}

            {/* Centering wrapper */}
            <div
              style={{
                minHeight:      '100%',
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                justifyContent: 'center',
                padding:        '40px 16px 48px',
              }}
            >
              <div
                style={{
                  display:       'flex',
                  flexDirection: 'column',
                  alignItems:    'center',
                  gap:           '24px',
                  maxWidth:      '768px',
                  width:         '100%',
                }}
              >
                <m.div exit={{ opacity: 0, y: -28, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}>
                  <InitialPrompts />
                </m.div>

                <m.div
                  style={{ width: '100%', maxWidth: '640px', margin: '0 auto' }}
                  exit={{ opacity: 0, y: 36, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
                >
                  <div ref={newChatInputWrapperRef} style={{ width: '100%', position: 'relative' }}>
                    <PinMentionDropdown
                      isOpen={showPinDropdown}
                      pins={filteredPins}
                      query={pinQuery}
                      highlightedIndex={highlightedPinIndex}
                      onHighlight={setHighlightedPinIndex}
                      onSelect={handlePinSelect}
                    />
                    <ChatInput
                      value={newChatInput}
                      onChange={setNewChatInput}
                      onSend={handleSend}
                      modelName={modelButtonLabel}
                      onModelClick={handleModelClick}
                      addMenu={addMenu}
                      modelMenu={<ModelMenu />}
                      chips={newChatChips}
                      attachmentsSlot={
                        <AttachmentManager
                          attachments={newChatAttachments}
                          onAttachmentsChange={setNewChatAttachments}
                        />
                      }
                      placeholder={selectedMode ? MODE_PLACEHOLDERS[selectedMode] : 'How can I help you today?'}
                      onMentionChange={handleMentionChange}
                      isPinDropdownOpen={showPinDropdown}
                      onPinNavigate={handlePinNavigate}
                    />
                  </div>

                  {/* Mode buttons */}
                  <div
                    style={{
                      display:        'flex',
                      justifyContent: 'center',
                      gap:            '8px',
                      marginTop:      '16px',
                      flexWrap:       'wrap',
                    }}
                  >
                    {ACTION_BUTTONS.map(btn => (
                      <div key={btn.mode} style={{ opacity: (btn.disabled || (selectedMode && selectedMode !== btn.mode)) ? 0.4 : 1, transition: 'opacity 150ms' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={btn.icon}
                          disabled={btn.disabled}
                          onClick={btn.disabled ? undefined : () => setSelectedMode(prev => prev === btn.mode ? null : btn.mode)}
                        >
                          {btn.label}
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Template cards */}
                  <div style={{ marginTop: '28px' }}>
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize:   '13px',
                        fontWeight: 500,
                        color:      'var(--neutral-500)',
                        margin:     '0 0 10px',
                        textAlign:  'left',
                      }}
                    >
                      Not sure where to start?
                    </p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {TEMPLATE_CARDS.map((card) => (
                        <TemplateCard key={card.label} icon={card.icon} label={card.label} onClick={() => handleSend(card.prompt)} />
                      ))}
                    </div>
                  </div>
                </m.div>
              </div>
            </div>
          </m.div>
        ) : (
          <m.div
            key="active-chat"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0, 0, 0.2, 1] } }}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
          >
            <ChatInterface
              chatId={isNewChat ? undefined : params.chatId}
              onChatCreated={(newChatId) => {
                if (selectedPersona) {
                  personaChatIds.current.set(newChatId, selectedPersona.id)
                }
                addChat(params.id, newChatId, initialPrompt?.slice(0, 60) ?? '')
                replace(`/project/${params.id}/chat/${newChatId}`)
              }}
              onTitleUpdate={() => {}}
              onChatMoveToTop={() => {}}
              selectedModel={modelButtonLabel}
              selectedModelId={selectedModel?.id}
              onModelClick={handleModelClick}
              addMenu={addMenu}
              modelMenu={<ModelMenu />}
              initialPrompt={initialPrompt}
              initialFiles={initialFiles}
              onClearInitialFiles={() => setInitialFiles([])}
              webSearchEnabled={webSearchEnabled}
              addMenuFiles={addMenuFiles}
              onClearAddMenuFiles={() => setAddMenuFiles([])}
              chips={newChatChips}
              selectedFolders={selectedFolders}
              selectedPersonaId={
                isNewChat
                  ? (selectedPersona?.id ?? null)
                  : (personaChatIds.current.get(params.chatId) ?? null)
              }
            />
          </m.div>
        )}
      </AnimatePresence>

      <ModelSwitchDialog
        isOpen={!!pendingModelSwitch}
        fromModel={selectedModel}
        toModel={pendingModelSwitch}
        onConfirm={handleModelSwitchConfirm}
        onCancel={() => setPendingModelSwitch(null)}
      />
    </div>
  )
}

export default function ProjectChatPage() {
  return (
    <Suspense fallback={null}>
      <ProjectChatPageInner />
    </Suspense>
  )
}
