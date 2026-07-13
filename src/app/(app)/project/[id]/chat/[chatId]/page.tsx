'use client'

import React, { Suspense, useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { X } from 'lucide-react'
import { ChatInterface }                                   from '@/components/chat/ChatInterface'
import { ChatInput }                                       from '@/components/chat/ChatInput'
import { ModelMenu }                                        from '@/components/chat/ModelMenu'
import { AttachmentManager, type PendingAttachment }       from '@/components/chat/AttachmentManager'
import { InitialPrompts }                                  from '@/components/chat/InitialPrompts'
import { ModelSwitchDialog }                               from '@/components/chat/ModelSwitchDialog'
import { PinMentionDropdown }                              from '@/components/chat/PinMentionDropdown'
import { ChatShareOverlay }                                from '@/components/chat/ChatShareOverlay'
import { useModelSelectorContext }                         from '@/context/model-selector-context'
import { useProjects }                                     from '@/context/projects-context'
import { useOrg }                                          from '@/context/org-context'
import { useFileUpload }                                   from '@/hooks/use-file-upload'
import { useFileDrop }                                     from '@/hooks/use-file-drop'
import { usePinboard, type PinItem }                       from '@/context/pinboard-context'
import { useHighlight }                                    from '@/context/highlight-context'
import type { PinMentionable }                             from '@/components/chat/PinMentionDropdown'
import { fetchPersonas, personasForTeamContext, getVersion, usePersonaRepo } from '@/lib/api/personas'
import { ChatAddMenu, USE_STYLE_OPTIONS, type SelectedPersonaInfo } from '@/components/chat/AddMenu'
import { Dropdown }                                        from '@/components/Dropdown'
import { Chip }                                            from '@/components/Chip'
import { Button }                                          from '@/components/Button'
import {
  FolderOneIcon,
  GlobalSearchIcon,
  QuillWriteTwoIcon,
  QuillWriteOneIcon,
  NeuralNetworkIcon,
  AiVisionRecognitionIcon,
  AiWebBrowsingIcon,
  CalendarFoldIcon,
  StickyNoteTwoIcon,
  AuctionIcon,
} from '@strange-huge/icons'
import type { AIModel }      from '@/types/ai-model'
import type { PinFolder } from '@/lib/api/pins'
import { CHAT_ROUTE } from '@/lib/routes'

// ── Mentioned-pin state type ──────────────────────────────────────────────────

interface MentionedPin { id: string; label: string; }

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

// ── Per-chat settings persistence ────────────────────────────────────────────

const PROJECT_CHAT_SETTINGS_PREFIX = 'souvenir_project_chat_'

interface ProjectChatSettings { webSearch: boolean; persona: SelectedPersonaInfo | null }

function loadProjectChatSettings(chatId: string): ProjectChatSettings | null {
  try { const raw = localStorage.getItem(PROJECT_CHAT_SETTINGS_PREFIX + chatId); return raw ? JSON.parse(raw) : null } catch { return null }
}

function saveProjectChatSettings(chatId: string, s: ProjectChatSettings) {
  try { localStorage.setItem(PROJECT_CHAT_SETTINGS_PREFIX + chatId, JSON.stringify(s)) } catch {}
}

// ── Loading / not-found screens ───────────────────────────────────────────────

function CentredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <p style={{ fontFamily: 'var(--font-body)', color: '#857a72' }}>{children}</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function ProjectChatPageInner() {
  const params       = useParams<{ id: string; chatId: string }>()
  const searchParams  = useSearchParams()
  const qParam        = searchParams.get('q')
  const { push }      = useRouter()

  const {
    loading: projectsContextLoading,
    getProject,
    getChats,
    addChat,
    renameChat,
    loadProjectChats,
  } = useProjects()
  const { currentUserRole } = useOrg()
  const { processFiles, FILE_ACCEPT } = useFileUpload()

  const isNewChat = params.chatId === 'new'

  const project = getProject(params.id)
  const chats   = getChats(params.id)
  const chat    = isNewChat ? undefined : chats.find(c => c.id === params.chatId)

  // ── Chat-loading state ────────────────────────────────────────────────────
  // Start as true so we never flash "Chat not found" before data arrives.
  const [chatsLoading, setChatsLoading] = useState(true)

  // Track a chat ID we just created in THIS render session.  Using a ref
  // (not state) avoids a second render cycle and survives the URL replace
  // without the component unmounting.  We use it to bypass the "chat not
  // found" guard during the brief window between addChat() and the context
  // state update being committed after router.replace().
  const justCreatedChatIdRef = useRef<string | null>(null)

  // Local chatId state — mirrors the main chat page pattern.
  // Updated immediately (same React batch) when onChatCreated fires so that
  // markChatAsOptimistic + the chatId prop change land in the SAME commit,
  // preventing useChatState from clearing streaming messages via fetch-and-clear.
  // We use window.history.replaceState (not router.replace) to update the URL
  // so that Next.js does NOT remount this page on the path-param change,
  // which would reset justCreatedChatIdRef and optimisticChatIdsRef mid-stream.
  const [activeChatId, setActiveChatId] = useState<string | undefined>(
    params.chatId !== 'new' ? params.chatId : undefined
  )

  // Looked up by activeChatId (not the stale params.chatId) so this stays correct
  // for a chat just created this session — window.history.replaceState updates
  // activeChatId locally without Next.js re-resolving params.chatId.
  const activeChatRecord    = activeChatId ? chats.find(c => c.id === activeChatId) : undefined
  const activeChatCanManage = activeChatRecord?.canEdit === true
  const activeChatReadOnly  = activeChatRecord?.canEdit === false

  // Load highlights whenever the active project chat changes — mirrors the
  // main chat page's effect on chatIdFromUrl. Without this, the shared
  // HighlightProvider keeps whichever other chat's highlights were loaded
  // last, so returning to this chat renders zero highlight marks even
  // though the highlights themselves still exist server-side. A chat-id-less
  // "new" route clears instead, so a previous chat's highlights don't linger.
  const { loadForChat: loadHighlightsForChat, clearHighlights } = useHighlight()
  useEffect(() => {
    if (activeChatId) loadHighlightsForChat(activeChatId)
    else clearHighlights()
  }, [activeChatId, loadHighlightsForChat, clearHighlights])

  useEffect(() => {
    setChatsLoading(true)
    loadProjectChats(params.id).finally(() => setChatsLoading(false))
  }, [params.id, loadProjectChats])

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
  const [initialFiles,       setInitialFiles]       = useState<File[]>(() => {
    // Synchronously read files carried over from the project overview page.
    // Only applies when there is an initial prompt (text+files navigation);
    // files-only navigation is handled by the useEffect below.
    if (typeof window === 'undefined') return []
    const files = (window as any).__pendingProjectChatFiles as File[] | undefined
    if (!files || !files.length || !qParam) return []
    delete (window as any).__pendingProjectChatFiles
    return files
  })
  const [pendingModelSwitch, setPendingModelSwitch] = useState<AIModel | null>(null)
  const [selectedStyleId,    setSelectedStyleId]    = useState<string | null>(null)
  const [styleChipOpen,      setStyleChipOpen]      = useState(false)
  const [selectedFolders,    setSelectedFolders]    = useState<PinFolder[]>([])
  // Read from sessionStorage synchronously in the lazy initializer so selectedPersona
  // is populated on the FIRST render. If we used useEffect instead, ChatInterface would
  // capture selectedPersonaId=null in its initial-send effect (runs in the same flush,
  // before the state update from a useEffect could apply) and the agent would be ignored.
  const [selectedPersona,    setSelectedPersona]    = useState<SelectedPersonaInfo | null>(() => {
    if (!isNewChat || typeof window === 'undefined') return null
    const stored = sessionStorage.getItem('project-chat-pending-persona')
    if (!stored) return null
    sessionStorage.removeItem('project-chat-pending-persona')
    try { return JSON.parse(stored) as SelectedPersonaInfo } catch { return null }
  })
  const [personaChipOpen,    setPersonaChipOpen]    = useState(false)
  const [chipPersonas,       setChipPersonas]       = useState<SelectedPersonaInfo[]>([])
  const [loadingChipPersonas, setLoadingChipPersonas] = useState(false)
  // Cache original-repo-id → member's copy info so usePersonaRepo is called at most once per session per persona
  const teamPersonaCopyCache = useRef<Map<string, SelectedPersonaInfo>>(new Map())

  const fileInputRef           = useRef<HTMLInputElement>(null)
  const newChatInputWrapperRef = useRef<HTMLDivElement>(null)

  // ── Pin @-mention state ───────────────────────────────────────────────────

  const [showPinDropdown,     setShowPinDropdown]     = useState(false)
  const [pinQuery,            setPinQuery]            = useState('')
  const [highlightedPinIndex, setHighlightedPinIndex] = useState(0)
  const [mentionedPins,       setMentionedPins]       = useState<MentionedPin[]>([])

  const { pins } = usePinboard()

  const filteredPins = useMemo<PinItem[]>(() => {
    if (!pinQuery.trim()) return pins.slice(0, 10)
    const q = pinQuery.toLowerCase()
    return pins.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q) ||
      (p.tags ?? []).some(t => t.toLowerCase().includes(q))
    )
  }, [pins, pinQuery])

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

  const handlePinSelect = useCallback((pin: PinMentionable) => {
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

  // Files-only navigation from the project overview page (no ?q= param):
  // the lazy initialiser above skips window files when qParam is absent, so
  // we pick them up here and show them as pre-loaded chips in the new-chat input.
  useEffect(() => {
    const files = (window as any).__pendingProjectChatFiles as File[] | undefined
    if (!files || !files.length) return
    delete (window as any).__pendingProjectChatFiles
    setNewChatAttachments(prev => processFiles(files, prev))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Model selector ────────────────────────────────────────────────────────

  const { models, selectedModel, selectModel, open: openModelSelector, museActive, museAdvanced, enableReasoning, setPersonaActive } = useModelSelectorContext()

  const modelButtonLabel = museActive
    ? museAdvanced ? 'Souvenir AI Muse (Advanced)' : 'Souvenir AI Muse (Basic)'
    : selectedModel?.modelName

  const handleModelClick = (e: React.MouseEvent<HTMLButtonElement>) => { if (selectedPersona) return; openModelSelector(e.currentTarget) }

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
        if (cancelled) return
        if (version.model_id && models.length > 0) {
          const match = models.find(m => String(m.modelId ?? m.id) === version.model_id)
          if (match) selectModelRef.current(match)
        }
        setSelectedPersona(prev =>
          prev?.id === selectedPersona.id
            ? { ...prev, modelId: version.model_id ?? prev.modelId, systemPrompt: version.prompt, temperature: version.temperature }
            : prev
        )
      })
      .catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- selectModel intentionally via ref
  }, [selectedPersona, models])

  // Lock model selector while a persona chip is active (matches normal chat page).
  useEffect(() => {
    setPersonaActive(!!selectedPersona)
  }, [selectedPersona, setPersonaActive])

  // Load persisted settings when navigating to an existing project chat.
  useEffect(() => {
    if (!activeChatId) return
    const s = loadProjectChatSettings(activeChatId)
    if (!s) return
    setWebSearchEnabled(s.webSearch ?? false)
    if (s.persona) setSelectedPersona(s.persona)
  }, [activeChatId])

  // Persist settings whenever they change for an existing chat.
  useEffect(() => {
    if (!activeChatId) return
    saveProjectChatSettings(activeChatId, { webSearch: webSearchEnabled, persona: selectedPersona })
  }, [activeChatId, webSearchEnabled, selectedPersona])

  useEffect(() => {
    if (!personaChipOpen) return
    setLoadingChipPersonas(true)

    const teamId = project?.teamId ?? null
    // Members/editors can't use another user's persona directly — _resolve_persona enforces ownership.
    // For team projects, transparently copy each team-shared persona into the member's own account
    // so the chat can proceed with their copy's version ID instead of the admin's.
    const needsCopy = Boolean(teamId) && currentUserRole !== 'admin'
    let cancelled = false

    async function loadChipPersonas() {
      const list = await fetchPersonas()
      if (cancelled) return
      const teamPersonas = personasForTeamContext(list, teamId)

      if (!needsCopy) {
        setChipPersonas(teamPersonas.map(p => ({ id: p.id, name: p.name, imageUrl: p.imageUrl, modelId: p.modelId, activeVersionId: p.activeVersionId, systemPrompt: null, temperature: null })))
        return
      }

      const resolved = await Promise.all(teamPersonas.map(async p => {
        const base: SelectedPersonaInfo = { id: p.id, name: p.name, imageUrl: p.imageUrl, modelId: p.modelId, activeVersionId: p.activeVersionId, systemPrompt: null, temperature: null }
        if (p.visibility !== 'team') return base
        const cached = teamPersonaCopyCache.current.get(p.id)
        if (cached) return cached
        try {
          const copy = await usePersonaRepo(p.id)
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
          teamPersonaCopyCache.current.set(p.id, info)
          return info
        } catch {
          return base
        }
      }))
      if (!cancelled) setChipPersonas(resolved)
    }

    loadChipPersonas()
      .catch(() => { if (!cancelled) setChipPersonas([]) })
      .finally(() => { if (!cancelled) setLoadingChipPersonas(false) })
    return () => { cancelled = true }
  }, [personaChipOpen, project?.teamId, currentUserRole])

  // ── Chips ─────────────────────────────────────────────────────────────────

  const activeStyle = USE_STYLE_OPTIONS.find(s => s.id === selectedStyleId) ?? null

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
          icon={<FolderOneIcon size={20} color="var(--chip-text)" variant="static" />}
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
                  : <Dropdown.Item label={project?.teamId ? 'No shared team agents' : 'No agents yet'} fluid disabled />
              }
            </Dropdown.Section>
          </Dropdown>
        </Dropdown.Float>
      )}
    </>
  )

  const addMenu = (
    <ChatAddMenu
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
      teamId={project?.teamId ?? null}
    />
  )

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = (value: string) => {
    if (!value.trim() && !newChatAttachments.length) return
    setInitialFiles(newChatAttachments.map(a => a.file))
    setNewChatAttachments([])
    setMentionedPins([])
    setInitialPrompt(value.trim())
    setNewChatInput('')
    setHasMessages(true)
    setSelectedMode(null)
  }

  // ── Route guard — with loading gates to prevent instant "not found" ───────
  //
  // Priority:
  //   1. Project still loading from context bootstrap → show spinner.
  //   2. Project definitively not found → show error.
  //   3. Existing chat: chats still loading → show spinner.
  //   4. Existing chat: just created in this session (race-condition window) → let through.
  //   5. Existing chat: definitively not found after chats loaded → show error.

  if (!project) {
    if (projectsContextLoading) {
      return <CentredMessage>Loading…</CentredMessage>
    }
    return <CentredMessage>Project not found.</CentredMessage>
  }

  if (!isNewChat) {
    const isJustCreated = params.chatId === justCreatedChatIdRef.current
    if (!chat && !isJustCreated) {
      if (chatsLoading) {
        return <CentredMessage>Loading…</CentredMessage>
      }
      return <CentredMessage>Chat not found.</CentredMessage>
    }
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
                      onFilePaste={(files) => setNewChatAttachments((prev) => processFiles(files, prev))}
                      hasAttachments={newChatAttachments.length > 0}
                      modelName={modelButtonLabel}
                      onModelClick={selectedPersona ? undefined : handleModelClick}
                      addMenu={addMenu}
                      modelMenu={selectedPersona ? undefined : <ModelMenu />}
                      disabledModelSelector={!!selectedPersona}
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
              chatId={activeChatId}
              onChatCreated={(newChatId) => {
                // Clear initialPrompt so ChatInterface's addMenuFiles absorb effect
                // is no longer blocked for subsequent file uploads in this session.
                setInitialPrompt(null)
                // Persist settings immediately so the load effect reads the right value.
                saveProjectChatSettings(newChatId, { webSearch: webSearchEnabled, persona: selectedPersona })
                // Update local state immediately so markChatAsOptimistic + chatId
                // prop change land in the same React commit (same as main chat page).
                setActiveChatId(newChatId)
                justCreatedChatIdRef.current = newChatId
                addChat(params.id, newChatId, initialPrompt?.slice(0, 60) ?? '')
                // Update the browser URL without triggering a Next.js navigation.
                // router.replace() changes params.chatId (path param), which causes
                // Next.js App Router to remount this page — resetting justCreatedChatIdRef
                // and optimisticChatIdsRef mid-stream and clearing streaming messages.
                window.history.replaceState(null, '', `/project/${params.id}/chat/${newChatId}`)
                window.dispatchEvent(new Event('chat-url-updated'))
              }}
              onTitleUpdate={(chatId, title) => {
                renameChat(params.id, chatId, title)
                window.dispatchEvent(new CustomEvent('project:chat-title-updated', { detail: { title } }))
              }}
              onChatMoveToTop={() => {}}
              selectedModel={modelButtonLabel}
              selectedModelId={selectedModel?.id}
              onModelClick={selectedPersona ? undefined : handleModelClick}
              addMenu={addMenu}
              modelMenu={selectedPersona ? undefined : <ModelMenu />}
              disabledModelSelector={!!selectedPersona}
              initialPrompt={initialPrompt}
              initialFiles={initialFiles}
              onClearInitialFiles={() => setInitialFiles([])}
              webSearchEnabled={webSearchEnabled}
              enableReasoning={enableReasoning}
              addMenuFiles={addMenuFiles}
              onClearAddMenuFiles={() => setAddMenuFiles([])}
              chips={newChatChips}
              selectedFolders={selectedFolders}
              selectedStyleId={selectedStyleId}
              selectedPersonaId={selectedPersona?.activeVersionId ?? null}
              selectedPersonaSystemPrompt={selectedPersona?.systemPrompt ?? null}
              selectedPersonaTemperature={selectedPersona?.temperature ?? null}
              readOnly={activeChatReadOnly}
            />
          </m.div>
        )}
      </AnimatePresence>

      <ChatShareOverlay
        chatId={activeChatId}
        canManage={activeChatCanManage}
        readOnly={activeChatReadOnly}
        onCopied={(copy) => push(`${CHAT_ROUTE}?id=${copy.chatId}`)}
      />

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
