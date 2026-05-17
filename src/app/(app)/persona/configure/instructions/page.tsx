'use client'

import React, { useState, Suspense, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeftOneIcon,
  ArrowRightOneIcon,
  MoreHorizontalIcon,
  QuillWriteOneIcon,
  ArrowUpRightOneIcon,
  UserAiIcon,
  AiIdeaIcon,
  FolderLibraryIcon,
  ArrowDownOneIcon,
  AtomOneIcon,
  PlusSignIcon,
  CancelOneIcon,
  ExpandIcon,
  ViewOffSlashIcon,
} from '@strange-huge/icons'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { ChatInput } from '@/components/ChatInput'
import { EnhancePromptField } from '@/components/EnhancePromptField'
import ExampleConversationModal from '@/app/(app)/persona/configure/components/ExampleConversationModal'
import RepublishModal from '@/app/(app)/persona/configure/components/RepublishModal'
import { useInstructionHistory } from '@/app/(app)/persona/configure/hooks/use-instruction-history'
import {
  createPersonaRepo,
  createVersion,
  getPersonaRepo,
  getVersion,
  setActiveVersion,
  createAndStreamPersonaChat,
  streamPersonaMessage,
  type PersonaChatStreamCallbacks,
  type PersonaVersionResponse,
  type PersonaRepoResponse,
} from '@/lib/api/personas'
import { fetchModelsWithCache } from '@/lib/ai-models'
import type { AIModel } from '@/types/ai-model'
import { LlmIcon } from '@strange-huge/icons/llm'
import { getModelLlmId } from '@/lib/model-icons'

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = ['Instructions', 'Profile', 'Knowledge', 'Connectors', 'Sharing'] as const
type Tab = (typeof TABS)[number]

const MUTED_TABS = new Set<Tab>(['Knowledge', 'Sharing'])

const TAB_ROUTES: Partial<Record<Tab, string>> = {
  Profile:    '/persona/configure/profile',
  Knowledge:  '/persona/configure/knowledge',
  Connectors: '/persona/configure/connectors',
  Sharing:    '/persona/configure/sharing',
}

function getTemperatureLabel(v: number): string {
  if (v <= 0.12) return 'Very Precise'
  if (v <= 0.37) return 'Precise'
  if (v <= 0.62) return 'Balanced'
  if (v <= 0.87) return 'Creative'
  return 'Very Creative'
}

// ── Floating menu ─────────────────────────────────────────────────────────────

function FloatingMenu({
  testChatOpen,
  onToggleTestChat,
}: {
  testChatOpen: boolean
  onToggleTestChat: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        backgroundColor: 'var(--neutral-white)',
        borderRadius: 12,
        padding: '4px 4px 6px',
        boxShadow:
          '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-200)',
        position: 'relative',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          boxShadow: 'inset 0px -2.182px 0.364px 0px var(--neutral-100)',
          pointerEvents: 'none',
        }}
      />
      <button
        onClick={onToggleTestChat}
        title={testChatOpen ? 'Close test chat' : 'Open test chat'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 6,
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          backgroundColor: testChatOpen ? 'rgba(237,225,215,0.6)' : 'transparent',
          boxShadow: testChatOpen
            ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4)'
            : 'none',
          transition: 'background-color 150ms, box-shadow 150ms',
        }}
      >
        {testChatOpen && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              boxShadow:
                'inset 0px 1px 0px 0px rgba(247,242,237,0.61), inset 0px -1px 0px 0px rgba(106,98,93,0.05)',
              pointerEvents: 'none',
            }}
          />
        )}
        <UserAiIcon size={20} color="var(--neutral-700)" animated />
      </button>
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 6,
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          backgroundColor: 'transparent',
        }}
      >
        <AiIdeaIcon size={20} color="var(--neutral-700)" animated />
      </button>
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 6,
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          backgroundColor: 'transparent',
          opacity: 0.7,
        }}
      >
        <FolderLibraryIcon size={20} color="var(--neutral-700)" animated />
      </button>
    </div>
  )
}

// ── Undo / redo group — matches Figma node 848:54854 footer button group ─────

function UndoRedoGroup({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  canUndo: boolean
  canRedo: boolean
  onUndo:  () => void
  onRedo:  () => void
}) {
  const baseStyle: React.CSSProperties = {
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    width:           36,
    height:          36,
    padding:         8,
    border:          'none',
    backgroundColor: 'transparent',
    boxShadow:       '0px 0px 0px 1px rgba(59,54,50,0.3)',
    cursor:          'pointer',
    color:           'var(--neutral-700)',
    transition:      'background-color 150ms, opacity 150ms',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <button
        type="button"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={onUndo}
        style={{
          ...baseStyle,
          borderTopLeftRadius:    10,
          borderBottomLeftRadius: 10,
          opacity:                canUndo ? 1 : 0.4,
          cursor:                 canUndo ? 'pointer' : 'not-allowed',
        }}
      >
        <ArrowLeftOneIcon size={20} />
      </button>
      <button
        type="button"
        aria-label="Redo"
        disabled={!canRedo}
        onClick={onRedo}
        style={{
          ...baseStyle,
          borderTopRightRadius:    10,
          borderBottomRightRadius: 10,
          opacity:                 canRedo ? 1 : 0.4,
          cursor:                  canRedo ? 'pointer' : 'not-allowed',
        }}
      >
        <ArrowRightOneIcon size={20} />
      </button>
    </div>
  )
}

// ── Inline anchored model dropdown ───────────────────────────────────────────
// The chat-style ModelSelector renders a centered modal — wrong for this page,
// where the dropdown must drop under its trigger and span the trigger's width.

function ModelDropdown({
  models,
  selectedModel,
  open,
  onOpenChange,
  onSelect,
}: {
  models:        AIModel[]
  selectedModel: AIModel | null
  open:          boolean
  onOpenChange:  (open: boolean) => void
  onSelect:      (model: AIModel) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) onOpenChange(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onOpenChange])

  const grouped = models.reduce<Record<string, AIModel[]>>((acc, m) => {
    const k = m.companyName || 'Other'
    if (!acc[k]) acc[k] = []
    acc[k].push(m)
    return acc
  }, {})

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#0a0a0a' }}>
        Model
      </span>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             8,
          padding:         '8px 12px',
          border:          '1px solid var(--neutral-200)',
          borderRadius:    6,
          backgroundColor: 'transparent',
          cursor:          'pointer',
          width:           '100%',
          textAlign:       'left',
          transition:      'border-color 150ms',
        }}
      >
        <span style={{ flexShrink: 0, lineHeight: 0 }}>
          {selectedModel ? (
            <LlmIcon
              id={getModelLlmId(selectedModel.companyName, selectedModel.modelName) ?? ''}
              variant="color"
              size={20}
            />
          ) : (
            <AtomOneIcon size={20} color="var(--neutral-700)" />
          )}
        </span>
        <span
          style={{
            flex:         '1 0 0',
            minWidth:     0,
            fontFamily:   'var(--font-body)',
            fontWeight:   500,
            fontSize:     14,
            lineHeight:   '22px',
            color:        'var(--neutral-700)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}
        >
          {selectedModel?.modelName ?? 'Select model'}
        </span>
        <ArrowDownOneIcon
          size={20}
          color="var(--neutral-700)"
          style={{
            flexShrink: 0,
            transform:  open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms',
          }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            aria-label="Select model"
            initial={{ opacity: 0, scaleY: 0.85, y: -4 }}
            animate={{ opacity: 1, scaleY: 1,    y:  0 }}
            exit={{    opacity: 0, scaleY: 0.9,  y: -4, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="kaya-scrollbar"
            style={{
              position:        'absolute',
              top:             'calc(100% + 4px)',
              left:            0,
              right:           0,
              zIndex:          50,
              maxHeight:       320,
              overflowY:       'auto',
              backgroundColor: 'var(--neutral-white)',
              border:          '1px solid var(--neutral-200)',
              borderRadius:    12,
              padding:         4,
              boxShadow:
                '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15)',
              transformOrigin: 'top center',
            }}
          >
            {Object.entries(grouped).map(([provider, providerModels]) => (
              <div key={provider} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div
                  style={{
                    padding:    '8px 8px 4px',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    fontSize:   11,
                    lineHeight: '16px',
                    color:      'var(--neutral-500)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {provider}
                </div>
                {providerModels.map((m) => {
                  const isSelected = !!selectedModel && (m.modelId ?? m.id) === (selectedModel.modelId ?? selectedModel.id)
                  return (
                    <button
                      key={String(m.modelId ?? m.id)}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => onSelect(m)}
                      style={{
                        display:         'flex',
                        alignItems:      'center',
                        gap:             8,
                        width:           '100%',
                        padding:         '8px',
                        border:          'none',
                        borderRadius:    8,
                        cursor:          'pointer',
                        backgroundColor: isSelected ? 'var(--neutral-100)' : 'transparent',
                        textAlign:       'left',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--neutral-50)'
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                      }}
                    >
                      <span style={{ flexShrink: 0, lineHeight: 0 }}>
                        <LlmIcon id={getModelLlmId(m.companyName, m.modelName) ?? ''} variant="color" size={20} />
                      </span>
                      <span
                        style={{
                          flex:         '1 0 0',
                          minWidth:     0,
                          fontFamily:   'var(--font-body)',
                          fontWeight:   500,
                          fontSize:     14,
                          lineHeight:   '22px',
                          color:        'var(--neutral-700)',
                          overflow:     'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace:   'nowrap',
                        }}
                      >
                        {m.modelName}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
            {models.length === 0 && (
              <div
                style={{
                  padding:    12,
                  fontFamily: 'var(--font-body)',
                  fontSize:   14,
                  color:      'var(--neutral-500)',
                }}
              >
                No models available
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Session-storage key ───────────────────────────────────────────────────────

function publishedKey(repoId: string) {
  return `persona_published_${repoId}`
}

// ── Main page content ─────────────────────────────────────────────────────────

function PersonaConfigureInstructionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL params - repoId/versionId present when editing existing persona
  const repoIdParam    = searchParams.get('repoId')    ?? ''
  const versionIdParam = searchParams.get('versionId') ?? ''

  // ── State ───────────────────────────────────────────────────────────────────

  const [repoId,    setRepoId]    = useState(repoIdParam)
  const [versionId, setVersionId] = useState(versionIdParam)
  const [personaName, setPersonaName] = useState('Persona Name')
  const {
    currentInstruction: instruction,
    setInstruction,
    undo: undoInstruction,
    redo: redoInstruction,
    canUndo,
    canRedo,
    reset: resetInstructionHistory,
  } = useInstructionHistory('')
  const [temperature, setTemperature] = useState(0.5)
  const [allModels,      setAllModels]      = useState<AIModel[]>([])
  const [selectedModel,  setSelectedModel]  = useState<AIModel | null>(null)
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false)
  const [imageUrl,    setImageUrl]    = useState<string | null>(null)
  const [isInitialising, setIsInitialising] = useState(true)
  const [isSaving,      setIsSaving]      = useState(false)
  const [isPublishing,  setIsPublishing]  = useState(false)
  const [testChatOpen,  setTestChatOpen]  = useState(false)
  const [exampleConvOpen, setExampleConvOpen] = useState(false)
  const [exampleConvExpanded, setExampleConvExpanded] = useState(false)
  const [exampleConversations, setExampleConversations] = useState<Array<{ id: string; userSays: string; personaReplies: string }>>([])
  const [republishModalOpen, setRepublishModalOpen] = useState(false)

  const hasPublishedRef   = useRef(false)
  const hasInitialisedRef = useRef(false)

  // ── Test-chat state ─────────────────────────────────────────────────────────

  type ChatMsg = { id: string; role: 'user' | 'assistant'; text: string; isStreaming?: boolean }
  const [chatMessages,  setChatMessages]  = useState<ChatMsg[]>([])
  const [testChatId,    setTestChatId]    = useState<string | null>(null)
  const [isStreaming,   setIsStreaming]   = useState(false)
  const abortStreamRef  = useRef<(() => void) | null>(null)
  const chatScrollRef   = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    const el = chatScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatMessages])

  async function handleTestChatSend(value: string) {
    if (!value.trim() || !repoId || isStreaming) return

    const userMsgId = `user-${Date.now()}`
    const asstMsgId = `asst-${Date.now()}`

    setChatMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user',      text: value.trim() },
      { id: asstMsgId, role: 'assistant', text: '', isStreaming: true },
    ])
    setIsStreaming(true)

    const callbacks: PersonaChatStreamCallbacks = {
      onChatId: (id) => setTestChatId(id),
      onChunk:  (delta) => setChatMessages(prev =>
        prev.map(m => m.id === asstMsgId ? { ...m, text: m.text + delta } : m)
      ),
      onDone: () => {
        setChatMessages(prev =>
          prev.map(m => m.id === asstMsgId ? { ...m, isStreaming: false } : m)
        )
        setIsStreaming(false)
      },
      onError: (err) => {
        setChatMessages(prev =>
          prev.map(m => m.id === asstMsgId ? { ...m, text: `⚠ ${err}`, isStreaming: false } : m)
        )
        setIsStreaming(false)
      },
    }

    try {
      const abort = testChatId
        ? await streamPersonaMessage(repoId, testChatId, value.trim(), callbacks)
        : await createAndStreamPersonaChat(repoId, value.trim(), callbacks)
      abortStreamRef.current = abort
    } catch (err) {
      callbacks.onError?.((err as Error).message ?? 'Failed to send message')
    }
  }

  // ── Initialise: fetch models, then create or load persona ──────────────────

  const initialise = useCallback(async () => {
    // Guard against React Strict Mode double-invocation: reading sessionStorage
    // a second time would find an empty draft (already removed on the first run)
    // and create a second repo named "Untitled Persona".
    if (hasInitialisedRef.current) return
    hasInitialisedRef.current = true
    setIsInitialising(true)
    try {
      // Read wizard state from sessionStorage (new-persona flow)
      // These are set by the basics wizard pages and cleared here after use
      let wizardName = ''
      let wizardPurpose = ''
      let wizardTone = ''
      if (typeof window !== 'undefined' && !repoIdParam) {
        try {
          const draft = JSON.parse(sessionStorage.getItem('persona_wizard_draft') ?? '{}')
          wizardName    = draft.name    ?? ''
          wizardPurpose = draft.purpose ?? ''
          wizardTone    = draft.tone    ?? ''
          sessionStorage.removeItem('persona_wizard_draft')
        } catch { /* ignore */ }
      }

      // Fetch all available models with proper normalization
      let fetchedModels: AIModel[] = []
      try {
        fetchedModels = await fetchModelsWithCache()
      } catch {
        // proceed without model list
      }
      setAllModels(fetchedModels)
      const firstModel = fetchedModels[0] ?? null

      if (repoIdParam && versionIdParam) {
        // ── Edit existing persona ─────────────────────────────────────────────
        const [repo, version] = await Promise.all([
          getPersonaRepo(repoIdParam),
          getVersion(repoIdParam, versionIdParam),
        ])
        setPersonaName(repo.name)
        resetInstructionHistory(version.prompt ?? '')
        setTemperature(version.temperature ?? 0.5)
        setImageUrl(version.image_url)
        // Match stored model_id to full model object; fall back to first available
        const matchedModel = version.model_id
          ? fetchedModels.find(m => String(m.modelId ?? m.id) === version.model_id) ?? firstModel
          : firstModel
        setSelectedModel(matchedModel)
        if (typeof window !== 'undefined') {
          hasPublishedRef.current = sessionStorage.getItem(publishedKey(repoIdParam)) === '1'
        }
      } else if (repoIdParam) {
        // ── Repo exists but no specific version - load active version ─────────
        const repo = await getPersonaRepo(repoIdParam)
        setPersonaName(repo.name)
        if (repo.active_version) {
          resetInstructionHistory(repo.active_version.prompt ?? '')
          setTemperature(repo.active_version.temperature ?? 0.5)
          setImageUrl(repo.active_version.image_url)
          setVersionId(repo.active_version.id)
          const matchedModel = repo.active_version.model_id
            ? fetchedModels.find(m => String(m.modelId ?? m.id) === repo.active_version!.model_id) ?? firstModel
            : firstModel
          setSelectedModel(matchedModel)
        } else {
          setSelectedModel(firstModel)
        }
        if (typeof window !== 'undefined') {
          hasPublishedRef.current = sessionStorage.getItem(publishedKey(repoIdParam)) === '1'
        }
      } else {
        // ── New persona - create repo + initial version ───────────────────────
        if (!firstModel) {
          toast.error('No AI models available. Please contact support.')
          router.push('/personas')
          return
        }
        setSelectedModel(firstModel)

        const effectiveName = wizardName || 'Untitled Persona'

        if (wizardName) setPersonaName(wizardName)

        // Purpose is stored as the persona description only - system instruction starts empty
        const initialPrompt = ''

        const repo = await createPersonaRepo({
          name:    effectiveName,
          modelId: String(firstModel.modelId ?? firstModel.id ?? ''),
          prompt:  initialPrompt,
        })

        const newRepoId    = repo.id
        const newVersionId = repo.active_version?.id ?? ''

        setRepoId(newRepoId)
        setVersionId(newVersionId)
        setPersonaName(repo.name)
        resetInstructionHistory(initialPrompt)

        // Update URL with IDs only - no user data in the URL
        window.history.replaceState(null, '', `?repoId=${newRepoId}&versionId=${newVersionId}`)
      }
    } catch (err) {
      console.error('[PersonaConfigure] init error:', err)
      toast.error('Failed to load persona. Please try again.')
    } finally {
      setIsInitialising(false)
    }
  }, []) // run once on mount

  useEffect(() => {
    initialise()
  }, [initialise])

  // ── Save version ─────────────────────────────────────────────────────────────

  async function handleSaveVersion() {
    const modelId = String(selectedModel?.modelId ?? selectedModel?.id ?? '')
    if (!repoId || !modelId) return
    setIsSaving(true)
    try {
      const version = await createVersion({
        repoId,
        name:        personaName,
        modelId,
        prompt:      instruction,
        temperature,
      })
      setVersionId(version.id)
      const params = new URLSearchParams(searchParams.toString())
      params.set('versionId', version.id)
      window.history.replaceState(null, '', `?${params.toString()}`)
      toast.success('Version saved')
    } catch (err) {
      console.error('[PersonaConfigure] save error:', err)
      toast.error('Failed to save version')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Publish ───────────────────────────────────────────────────────────────────

  async function handlePublish() {
    if (!repoId || !versionId) return

    if (hasPublishedRef.current) {
      setRepublishModalOpen(true)
      return
    }

    setIsPublishing(true)
    try {
      await setActiveVersion(repoId, versionId)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(publishedKey(repoId), '1')
      }
      hasPublishedRef.current = true
      router.push(`/personas/published?name=${encodeURIComponent(personaName)}&repoId=${repoId}`)
    } catch (err) {
      console.error('[PersonaConfigure] publish error:', err)
      toast.error('Failed to publish persona')
    } finally {
      setIsPublishing(false)
    }
  }

  const hasContent    = instruction.trim().length > 0
  const canPublish    = hasContent && !!repoId && !!versionId && !isPublishing
  const canSave       = hasContent && !!repoId && !!selectedModel && !isSaving

  const handleAddConversation    = (userSays: string, personaReplies: string) =>
    setExampleConversations(prev => [...prev, { id: crypto.randomUUID(), userSays, personaReplies }])
  const handleRemoveConversation = (id: string) =>
    setExampleConversations(prev => prev.filter(c => c.id !== id))

  // ── Tab navigation ────────────────────────────────────────────────────────────

  function navigateTab(tab: Tab) {
    const route = TAB_ROUTES[tab]
    if (!route) return
    const params = new URLSearchParams(searchParams.toString())
    if (repoId)    params.set('repoId',    repoId)
    if (versionId) params.set('versionId', versionId)
    router.push(`${route}?${params.toString()}`)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: 'flex',
        gap: 7,
        alignItems: 'stretch',
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      {/* ── Left configure panel ──────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: 'rgba(255,255,255,0.2)',
          border: '1px solid var(--neutral-200)',
          borderRadius: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          position: 'relative',
          paddingBottom: 12,
          paddingTop: 10,
          paddingLeft: 12,
          paddingRight: 12,
          height: '100%',
          flex: '1 0 0',
          minWidth: 0,
        }}
      >
        {/* ── Top navigation bar ─────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 36 }}>
            {/* Back arrow */}
            <div style={{ flexShrink: 0 }}>
              <IconButton
                variant="ghost"
                size="md"
                icon={<ArrowLeftOneIcon size={20} />}
                aria-label="Go back"
                onClick={() => router.back()}
              />
            </div>

            {/* Tabs */}
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'flex-start', flexShrink: 0 }}>
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 10,
                  backgroundColor: 'rgba(247,242,237,0.5)',
                  boxShadow:
                    'inset 0px -1px 0px 0px rgba(255,255,255,0.9), inset 0px 1px 0px 0px var(--neutral-100), inset 0px 0px 4px 0px rgba(209,198,189,0.5)',
                }}
              />
              <div style={{ position: 'relative', display: 'flex', gap: 4, alignItems: 'center' }}>
                {TABS.map(tab => {
                  const isActive = tab === 'Instructions'
                  return (
                    <button
                      key={tab}
                      onClick={() => navigateTab(tab)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '7px 8px',
                        borderRadius: 10,
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: isActive ? 'var(--neutral-white)' : 'transparent',
                        boxShadow: isActive
                          ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100), inset 0px -1px 0px 0px rgba(38,33,30,0.1)'
                          : 'none',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        fontSize: 14,
                        lineHeight: '22px',
                        color: isActive
                          ? 'var(--blue-600)'
                          : MUTED_TABS.has(tab)
                          ? 'var(--neutral-500)'
                          : 'var(--neutral-700)',
                        whiteSpace: 'nowrap',
                        transition: 'background-color 150ms, box-shadow 150ms, color 150ms',
                        position: 'relative',
                      }}
                    >
                      {isActive && (
                        <div
                          aria-hidden
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 'inherit',
                            boxShadow: 'inset 0px -1px 0px 0px rgba(38,33,30,0.1)',
                            pointerEvents: 'none',
                          }}
                        />
                      )}
                      {tab}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              <IconButton
                variant="outline"
                size="md"
                icon={<MoreHorizontalIcon size={20} />}
                aria-label="More options"
              />
              <IconButton
                variant="outline"
                size="md"
                icon={<QuillWriteOneIcon size={20} />}
                aria-label={isSaving ? 'Saving version…' : 'Save version'}
                onClick={handleSaveVersion}
                disabled={!canSave}
                loading={isSaving}
              />
              <Button
                variant="default"
                size="sm"
                disabled={!canPublish}
                rightIcon={<ArrowUpRightOneIcon size={16} />}
                onClick={handlePublish}
              >
                {isPublishing ? 'Publishing…' : 'Publish'}
              </Button>
            </div>
          </div>

          <div style={{ height: 32, flexShrink: 0 }} />
        </div>

        {/* ── Scrollable content area ────────────────────────────────────────── */}
        {isInitialising ? (
          <div style={{ flex: '1 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', margin: 0 }}>
              Loading…
            </p>
          </div>
        ) : (
          <div
            className="kaya-scrollbar"
            style={{
              flex: '1 0 0',
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', maxWidth: 714 }}>

              {/* ── Persona header ────────────────────────────────────────────── */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 65,
                    height: 65,
                    borderRadius: 8,
                    flexShrink: 0,
                    backgroundColor: 'var(--neutral-100)',
                    boxShadow:
                      '0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)',
                    overflow: 'hidden',
                  }}
                >
                  {imageUrl && (
                    <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p
                    style={{
                      fontFamily: 'var(--font-title)',
                      fontWeight: 400,
                      fontSize: 24,
                      lineHeight: '32px',
                      color: 'var(--neutral-900)',
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 220,
                    }}
                  >
                    {personaName || 'Persona Name'}
                  </p>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '2px',
                      borderRadius: 6,
                      alignSelf: 'flex-start',
                      backgroundColor: 'var(--neutral-100)',
                      boxShadow: '0px 1px 1.5px 0px rgba(18,12,8,0.2), 0px 0px 0px 1px rgba(106,98,93,0.5)',
                      position: 'relative',
                    }}
                  >
                    <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', boxShadow: 'inset 0px 1px 0px 0px rgba(247,242,237,0.7), inset 0px -1px 0px 0px rgba(106,98,93,0.1)', pointerEvents: 'none' }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-700)', padding: '0 2px', whiteSpace: 'nowrap' }}>
                      Private
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Model selector ────────────────────────────────────────────── */}
              <ModelDropdown
                models={allModels}
                selectedModel={selectedModel}
                open={modelSelectorOpen}
                onOpenChange={setModelSelectorOpen}
                onSelect={(m) => { setSelectedModel(m); setModelSelectorOpen(false) }}
              />

              {/* ── System instruction ────────────────────────────────────────── */}
              <EnhancePromptField
                value={instruction}
                onChange={setInstruction}
                footerLeft={
                  <UndoRedoGroup
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={undoInstruction}
                    onRedo={redoInstruction}
                  />
                }
              />

              {/* ── Temperature slider ────────────────────────────────────────── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: '#0a0a0a' }}>
                    Creativity level (Temperature)
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#0a0a0a' }}>
                    {getTemperatureLabel(temperature)}
                  </span>
                </div>
                <div style={{ position: 'relative', height: 4, borderRadius: 2, backgroundColor: 'white', cursor: 'pointer' }}>
                  <div aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${temperature * 100}%`, backgroundColor: 'var(--blue-600)', borderRadius: 2, pointerEvents: 'none' }} />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={temperature}
                    onChange={e => setTemperature(parseFloat(e.target.value))}
                    aria-label="Creativity level"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', margin: 0 }}
                  />
                  <div aria-hidden style={{ position: 'absolute', top: '50%', left: `${temperature * 100}%`, transform: 'translate(-50%, -50%)', width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--blue-600)', pointerEvents: 'none' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-800)' }}>0 (Precise &amp; consistent)</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-700)' }}>(Creative &amp; varied) 1</span>
                </div>
              </div>

              {/* ── Example conversations ─────────────────────────────────────── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setExampleConvExpanded(v => !v)}
                  aria-expanded={exampleConvExpanded}
                  aria-controls="example-conversations-panel"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    height: 64,
                    width: '100%',
                    border: '1px solid var(--neutral-200)',
                    borderRadius: 6,
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 0 0', minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        fontSize: 14,
                        lineHeight: '22px',
                        color: '#0a0a0a',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Example conversations ( optional )
                    </span>
                    {exampleConversations.length > 0 && (
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontWeight: 500,
                          fontSize: 11,
                          lineHeight: '16px',
                          color: 'var(--neutral-700)',
                          backgroundColor: 'var(--neutral-100)',
                          border: '1px solid rgba(106,98,93,0.3)',
                          borderRadius: 6,
                          padding: '1px 6px',
                          flexShrink: 0,
                        }}
                      >
                        {exampleConversations.length}
                      </span>
                    )}
                  </div>
                  <ArrowDownOneIcon
                    size={20}
                    color="var(--neutral-700)"
                    style={{
                      flexShrink: 0,
                      transform: exampleConvExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 150ms',
                    }}
                  />
                </button>

                {exampleConvExpanded && (
                  <div
                    id="example-conversations-panel"
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    {exampleConversations.map((conv) => (
                      <div
                        key={conv.id}
                        style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, borderRadius: 12, backgroundColor: 'var(--neutral-white)', border: '1px solid var(--neutral-200)', position: 'relative' }}
                      >
                        <button
                          onClick={() => handleRemoveConversation(conv.id)}
                          aria-label="Remove conversation"
                          style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 3, borderRadius: 6, border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
                        >
                          <CancelOneIcon size={14} color="var(--neutral-500)" />
                        </button>
                        {conv.userSays && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: '#ee3030' }}>User says</span>
                            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-700)', margin: 0 }}>{conv.userSays}</p>
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-600)' }}>Persona replies</span>
                          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-700)', margin: 0, paddingRight: 24 }}>{conv.personaReplies}</p>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<PlusSignIcon size={16} />}
                      onClick={() => setExampleConvOpen(true)}
                    >
                      Add conversation
                    </Button>
                  </div>
                )}
              </div>

              <div style={{ height: 24, flexShrink: 0 }} />
            </div>
          </div>
        )}

        {/* ── Floating vertical menu ─────────────────────────────────────────── */}
        <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
          <FloatingMenu testChatOpen={testChatOpen} onToggleTestChat={() => setTestChatOpen(v => !v)} />
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────────────── */}
      <ExampleConversationModal
        open={exampleConvOpen}
        onClose={() => setExampleConvOpen(false)}
        onAdd={handleAddConversation}
      />
      {republishModalOpen && (
        <RepublishModal
          personaName={personaName || 'Persona'}
          superLinkActive={false}
          onClose={() => setRepublishModalOpen(false)}
          onDone={() => {
            setRepublishModalOpen(false)
            router.push('/personas')
          }}
        />
      )}

      {/* ── Test chat panel ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {testChatOpen && (
          <motion.div
            key="test-chat"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 448, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 32, mass: 0.9 }}
            style={{
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              height: '100%',
              backgroundColor: 'var(--neutral-white)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 16,
              padding: 12,
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, backgroundColor: 'var(--neutral-100)', boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)', overflow: 'hidden' }}>
                  {imageUrl && <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0, whiteSpace: 'nowrap' }}>
                  {personaName || 'Name'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {/* <div style={{ opacity: 0.7 }}>
                  <Button variant="outline" size="sm" leftIcon={<ViewOffSlashIcon size={16} />} rightIcon={<ArrowDownOneIcon size={16} />}>
                    Mock connector
                  </Button>
                </div> */}
                {/* <IconButton variant="outline" size="md" icon={<ExpandIcon size={20} />} aria-label="Expand test chat" /> */}
                <IconButton variant="outline" size="md" icon={<CancelOneIcon size={20} />} aria-label="Close test chat" onClick={() => setTestChatOpen(false)} />
              </div>
            </div>
            <div ref={chatScrollRef} className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {chatMessages.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-600)', margin: 0 }}>
                  Hi! I&apos;m your persona. Test me here while you configure.
                </p>
              ) : (
                chatMessages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '85%',
                        padding: '8px 12px',
                        borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        backgroundColor: msg.role === 'user' ? 'var(--neutral-900)' : 'var(--neutral-100)',
                        color: msg.role === 'user' ? 'white' : 'var(--neutral-900)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 14,
                        lineHeight: '22px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.text || (msg.isStreaming ? '…' : '')}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div style={{ flexShrink: 0 }}>
              <ChatInput
                placeholder="Test your persona..."
                textareaLabel="Test message"
                modelName="Souvenir"
                onSend={handleTestChatSend}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function PersonaConfigureInstructionsPage() {
  return (
    <Suspense>
      <PersonaConfigureInstructionsContent />
    </Suspense>
  )
}
