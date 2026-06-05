'use client'

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  Suspense,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  testVersionStream,
  guidePersonaStream,
  listVersions,
  getVersion,
  type PersonaChatStreamCallbacks,
  type PersonaVersionListItem,
  type PersonaVersionResponse,
  type GuideMessage,
  type PersonaConnectPrompt,
  type PersonaPermissionPrompt,
  type PersonaActivityItem,
} from '@/lib/api/personas'
import { fetchModelsWithCache } from '@/lib/ai-models'
import { useFileUpload } from '@/hooks/use-file-upload'
import type { PinFolder } from '@/lib/api/pins'
import type { PendingAttachment } from '@/components/chat/AttachmentManager'
import type { ActivityItem } from '@/hooks/use-chat-state'

// ── Types ─────────────────────────────────────────────────────────────────────

export type GuideMsg = {
  id: string
  role: 'user' | 'assistant'
  text: string
  isStreaming?: boolean
}

export type ChatMsg = {
  id: string
  role: 'user' | 'assistant'
  text: string
  isStreaming?: boolean
  connectPrompts?: PersonaConnectPrompt[]
  permissionPrompts?: PersonaPermissionPrompt[]
  activities?: ActivityItem[]
  attachments?: Array<{ file_name: string; mime_type: string; file_size?: number }>
}

export interface PersonaInfo {
  repoId: string
  versionId: string
  personaName: string
  imageUrl: string | null
  connectorSlugs: string[]
  disabledConnectorSlugs: string[]
  guidePrompt: string
  guideModelId: string | null
  guideTemperature: number
  guideModelName: string
}

interface PersonaConfigureContextValue {
  personaInfo: PersonaInfo
  updatePersonaInfo: (patch: Partial<PersonaInfo>) => void

  // Help panel open state — shared so the panels island and the tab card can be positioned independently
  helpOpen: boolean
  setHelpOpen: (v: boolean) => void
  helpActiveId: string
  setHelpActiveId: (id: string) => void

  // Configure progress (A)
  knowledgeFileCount: number
  setKnowledgeFileCount: (n: number) => void
  hasShareLink: boolean
  setHasShareLink: (v: boolean) => void

  // Auto-save on tab switch
  registerAutoSave: (fn: (() => Promise<void>) | null) => void

  // Leave-confirm guard (shared across all 5 configure tabs)
  needsRepublish: boolean
  setNeedsRepublish: (v: boolean) => void
  leaveConfirmHref: string | null
  setLeaveConfirmHref: (href: string | null) => void
  safeNavigate: (href: string) => void
  safeBack: () => void
  hasPublishAndLeave: boolean
  setOnPublishAndLeave: (fn: (() => void) | null) => void
  handlePublishAndLeave: () => void

  // Panel state
  testChatOpen: boolean
  testChatExpanded: boolean
  aiSuggestOpen: boolean
  guideExpanded: boolean
  versionsOpen: boolean
  anyPanelOpen: boolean

  // Toggles
  toggleTestChat: () => void
  toggleAiSuggest: () => void
  toggleVersions: () => void
  setTestChatOpen: React.Dispatch<React.SetStateAction<boolean>>
  setTestChatExpanded: React.Dispatch<React.SetStateAction<boolean>>
  setGuideExpanded: React.Dispatch<React.SetStateAction<boolean>>
  setVersionsOpen: (open: boolean) => void
  setAiSuggestOpen: React.Dispatch<React.SetStateAction<boolean>>

  // Guide
  guideMessages: GuideMsg[]
  guideIsStreaming: boolean
  guideScrollRef: React.RefObject<HTMLDivElement | null>
  handleGuideSend: (value: string) => void

  // Test chat
  chatMessages: ChatMsg[]
  isStreaming: boolean
  chatScrollRef: React.RefObject<HTMLDivElement | null>
  handleTestChatSend: (value: string) => void
  testChatWebSearch: boolean
  testChatStyleId: string | null
  testChatFolders: PinFolder[]
  testChatPersonaId: string | null
  testChatAttachments: PendingAttachment[]
  setTestChatWebSearch: React.Dispatch<React.SetStateAction<boolean>>
  setTestChatStyleId: React.Dispatch<React.SetStateAction<string | null>>
  setTestChatFolders: React.Dispatch<React.SetStateAction<PinFolder[]>>
  setTestChatPersonaId: React.Dispatch<React.SetStateAction<string | null>>
  setTestChatAttachments: React.Dispatch<React.SetStateAction<PendingAttachment[]>>
  handleTestChatAddFiles: () => void
  handleTestChatFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  testChatFileInputRef: React.RefObject<HTMLInputElement | null>
  FILE_ACCEPT: string

  // Versions
  versions: PersonaVersionListItem[]
  versionsLoading: boolean
  restoringId: string | null
  handleRestoreVersion: (id: string) => void
  refreshVersions: () => void
  registerVersionRestoreCallback: (fn: ((version: PersonaVersionResponse) => void) | null) => void

  // Pending change tags (auto-detected as user edits)
  pendingChangeTags: string[]
  addPendingChangeTag: (tag: string) => void
  setPendingChangeTags: (tags: string[]) => void
}

const PersonaConfigureContext = createContext<PersonaConfigureContextValue | null>(null)

export function usePersonaConfigure() {
  const ctx = useContext(PersonaConfigureContext)
  if (!ctx) throw new Error('usePersonaConfigure must be used within PersonaConfigureProvider')
  return ctx
}

// ── Provider (inner — uses hooks that need Suspense) ─────────────────────────

function PersonaConfigureProviderInner({ children }: { children: React.ReactNode }) {
  const { push, back } = useRouter()
  const searchParams = useSearchParams()

  const [personaInfo, _setPersonaInfo] = useState<PersonaInfo>(() => ({
    repoId:           searchParams.get('repoId')    ?? '',
    versionId:        searchParams.get('versionId') ?? '',
    personaName:      '',
    imageUrl:         null,
    connectorSlugs:          [],
    disabledConnectorSlugs:  [],
    guidePrompt:      '',
    guideModelId:     null,
    guideTemperature: 0.5,
    guideModelName:   'AI',
  }))

  const updatePersonaInfo = useCallback((patch: Partial<PersonaInfo>) => {
    _setPersonaInfo(prev => ({ ...prev, ...patch }))
  }, [])

  // Keep a ref so handlers always read the latest values without stale closures
  const infoRef = useRef(personaInfo)
  useEffect(() => { infoRef.current = personaInfo }, [personaInfo])

  // ── Eagerly bootstrap guide model from the saved version ────────────────────
  // This ensures the AI suggestions panel has the correct model_id even before
  // the instructions tab mounts (e.g. when the user is on the profile tab).
  useEffect(() => {
    const repoId    = personaInfo.repoId
    const versionId = personaInfo.versionId
    if (!repoId || !versionId) return

    let cancelled = false
    ;(async () => {
      try {
        const [version, models] = await Promise.all([
          getVersion(repoId, versionId),
          fetchModelsWithCache(),
        ])
        if (cancelled) return
        const vModelId = version.model_id ?? null
        if (!vModelId) return

        const matched = models.find(m =>
          (m.modelId != null && String(m.modelId) !== 'undefined' && String(m.modelId) === vModelId) ||
          (m.id     != null && String(m.id)      !== 'undefined' && String(m.id)      === vModelId),
        )
        const modelName = matched?.modelName ?? 'AI'

        // Always use the raw version.model_id — that's the exact value the backend stored
        // and expects back for the guide endpoint.
        _setPersonaInfo(prev => {
          if (prev.guideModelId) return prev
          return { ...prev, guideModelId: vModelId, guideModelName: modelName }
        })
      } catch { /* version or models fetch failed — guide will rely on pre-fetch in guidePersonaStream */ }
    })()
    return () => { cancelled = true }
  }, [personaInfo.repoId, personaInfo.versionId])

  // ── Help panel state ─────────────────────────────────────────────────────────

  const [helpOpen,    setHelpOpen]    = useState(false)
  const [helpActiveId, setHelpActiveId] = useState('')

  // ── Configure progress ───────────────────────────────────────────────────────

  const [knowledgeFileCount, setKnowledgeFileCount] = useState(0)
  const [hasShareLink,       setHasShareLink]       = useState(false)

  // ── Auto-save on tab switch ──────────────────────────────────────────────────

  const autoSaveRef = useRef<(() => Promise<void>) | null>(null)
  const registerAutoSave = useCallback((fn: (() => Promise<void>) | null) => {
    autoSaveRef.current = fn
  }, [])

  // ── Leave-confirm guard ──────────────────────────────────────────────────────

  const needsRepublishRef = useRef(false)
  const [needsRepublish,   _setNeedsRepublish]   = useState(false)
  const [leaveConfirmHref, setLeaveConfirmHref]  = useState<string | null>(null)
  const [hasPublishAndLeave, setHasPublishAndLeave] = useState(false)
  const onPublishAndLeaveRef = useRef<(() => void) | null>(null)

  const setNeedsRepublish = useCallback((v: boolean) => {
    needsRepublishRef.current = v
    _setNeedsRepublish(v)
  }, [])

  const setOnPublishAndLeave = useCallback((fn: (() => void) | null) => {
    onPublishAndLeaveRef.current = fn
    setHasPublishAndLeave(fn !== null)
  }, [])

  const handlePublishAndLeave = useCallback(() => {
    onPublishAndLeaveRef.current?.()
  }, [])

  const safeNavigate = useCallback((href: string) => {
    // Tab-to-tab navigation stays within configure — no publish guard needed
    if (needsRepublishRef.current && !href.includes('/persona/configure/')) {
      setLeaveConfirmHref(href)
      return
    }
    const save = autoSaveRef.current
    if (save) {
      save().catch(() => {}).finally(() => push(href))
    } else {
      push(href)
    }
  }, [push])

  const safeBack = useCallback(() => {
    if (needsRepublishRef.current) { setLeaveConfirmHref('__back__'); return }
    const save = autoSaveRef.current
    if (save) {
      save().catch(() => {}).finally(() => back())
    } else {
      back()
    }
  }, [back])

  // ── Panel state ─────────────────────────────────────────────────────────────

  const [testChatOpen,     setTestChatOpen]      = useState(false)
  const [testChatExpanded, setTestChatExpanded]  = useState(false)
  const [aiSuggestOpen,    setAiSuggestOpen]     = useState(false)
  const [guideExpanded,    setGuideExpanded]     = useState(false)
  const [versionsOpen,     _setVersionsOpen]     = useState(false)
  const anyPanelOpen = testChatOpen || aiSuggestOpen || versionsOpen

  // Wrapped setter: opening versions always closes test-chat and AI-suggest first
  // so at most one panel is visible at any time (including after Save Version).
  const setVersionsOpen = useCallback((open: boolean) => {
    if (open) { setTestChatOpen(false); setAiSuggestOpen(false) }
    _setVersionsOpen(open)
  }, [])

  const toggleTestChat = useCallback(() => {
    setTestChatOpen(prev => { const next = !prev; if (next) { setAiSuggestOpen(false); _setVersionsOpen(false) }; return next })
  }, [])

  const toggleAiSuggest = useCallback(() => {
    setAiSuggestOpen(prev => { const next = !prev; if (next) { setTestChatOpen(false); _setVersionsOpen(false) }; return next })
  }, [])

  const toggleVersions = useCallback(() => {
    _setVersionsOpen(prev => { const next = !prev; if (next) { setTestChatOpen(false); setAiSuggestOpen(false) }; return next })
  }, [])

  // ── Guide state ─────────────────────────────────────────────────────────────

  const [guideMessages,    setGuideMessages]    = useState<GuideMsg[]>([])
  const [guideHistory,     setGuideHistory]     = useState<GuideMessage[]>([])
  const [guideIsStreaming, setGuideIsStreaming] = useState(false)
  const guideStreamingRef = useRef(false)
  const guideHistoryRef   = useRef<GuideMessage[]>([])
  const guideScrollRef    = useRef<HTMLDivElement | null>(null)

  useEffect(() => { guideHistoryRef.current = guideHistory }, [guideHistory])
  useEffect(() => {
    const el = guideScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [guideMessages])

  const handleGuideSend = useCallback(async (value: string) => {
    const question = value.trim()
    const { repoId } = infoRef.current
    if (!question || !repoId || guideStreamingRef.current) return

    const userMsgId = `guide-user-${Date.now()}`
    const asstMsgId = `guide-asst-${Date.now()}`
    const historySnapshot = guideHistoryRef.current.slice()
    const info = infoRef.current

    setGuideMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user',      text: question },
      { id: asstMsgId, role: 'assistant', text: '', isStreaming: true },
    ])
    guideStreamingRef.current = true
    setGuideIsStreaming(true)

    let accumulated = ''
    const callbacks: PersonaChatStreamCallbacks = {
      onChunk: (delta) => {
        accumulated += delta
        setGuideMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, text: m.text + delta } : m))
      },
      onDone: () => {
        setGuideMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, isStreaming: false } : m))
        setGuideHistory(prev => [
          ...prev,
          { role: 'user',      content: question    },
          { role: 'assistant', content: accumulated },
        ])
        guideStreamingRef.current = false
        setGuideIsStreaming(false)
      },
      onError: (err) => {
        setGuideMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, text: `⚠ ${err}`, isStreaming: false } : m))
        guideStreamingRef.current = false
        setGuideIsStreaming(false)
      },
    }

    try {
      await guidePersonaStream(
        repoId,
        {
          question,
          prompt:      info.guidePrompt,
          name:        info.personaName || null,
          model_id:    info.guideModelId,
          temperature: info.guideTemperature,
          connectors:  info.connectorSlugs,
          history:     historySnapshot,
        },
        callbacks,
      )
    } catch (err) {
      callbacks.onError?.((err as Error).message ?? 'Failed to get suggestions')
    }
  }, [])

  // ── Test chat state ─────────────────────────────────────────────────────────

  const [chatMessages,  setChatMessages]  = useState<ChatMsg[]>([])
  const [isStreaming,   setIsStreaming]   = useState(false)
  const chatStreamingRef   = useRef(false)
  const abortStreamRef     = useRef<(() => void) | null>(null)
  const chatScrollRef      = useRef<HTMLDivElement | null>(null)
  const testChatFileInputRef = useRef<HTMLInputElement | null>(null)
  const { processFiles, FILE_ACCEPT } = useFileUpload()

  const [testChatWebSearch,   setTestChatWebSearch]   = useState(false)
  const [testChatStyleId,     setTestChatStyleId]     = useState<string | null>(null)
  const [testChatFolders,     setTestChatFolders]     = useState<PinFolder[]>([])
  const [testChatPersonaId,   setTestChatPersonaId]   = useState<string | null>(null)
  const [testChatAttachments, setTestChatAttachments] = useState<PendingAttachment[]>([])

  // Refs for mutable test chat options so handleTestChatSend is stable
  const testChatOptsRef = useRef({
    webSearch: false, styleId: null as string | null,
    folders: [] as PinFolder[], personaId: null as string | null,
    attachments: [] as PendingAttachment[],
  })
  useEffect(() => {
    testChatOptsRef.current = {
      webSearch: testChatWebSearch, styleId: testChatStyleId,
      folders: testChatFolders, personaId: testChatPersonaId,
      attachments: testChatAttachments,
    }
  }, [testChatWebSearch, testChatStyleId, testChatFolders, testChatPersonaId, testChatAttachments])

  useEffect(() => {
    const el = chatScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatMessages])

  const handleTestChatAddFiles = useCallback(() => {
    testChatFileInputRef.current?.click()
  }, [])

  const handleTestChatFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const captured = Array.from(e.target.files)
      e.target.value = ''
      setTestChatAttachments(prev => processFiles(captured, prev))
    }
  }, [processFiles])

  const handleTestChatSend = useCallback(async (value: string) => {
    const trimmedValue = value.trim()
    const { repoId, versionId, connectorSlugs, disabledConnectorSlugs } = infoRef.current
    const { attachments } = testChatOptsRef.current
    const filesToSend = attachments.map(a => a.file)
    if ((!trimmedValue && filesToSend.length === 0) || !repoId || !versionId || chatStreamingRef.current) return

    setTestChatAttachments([])

    const userMsgId = `user-${Date.now()}`
    const asstMsgId = `asst-${Date.now()}`

    setChatMessages(prev => [
      ...prev,
      {
        id: userMsgId, role: 'user', text: trimmedValue,
        attachments: filesToSend.length > 0
          ? filesToSend.map(f => ({ file_name: f.name, mime_type: f.type, file_size: f.size }))
          : undefined,
      },
      { id: asstMsgId, role: 'assistant', text: '', isStreaming: true },
    ])
    chatStreamingRef.current = true
    setIsStreaming(true)

    const callbacks: PersonaChatStreamCallbacks = {
      onChunk: (delta) => setChatMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, text: m.text + delta } : m)),
      onDone:  ()      => { setChatMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, isStreaming: false } : m)); chatStreamingRef.current = false; setIsStreaming(false) },
      onError: (err)   => { setChatMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, text: `⚠ ${err}`, isStreaming: false } : m)); chatStreamingRef.current = false; setIsStreaming(false) },
      onConnectPrompt:    (prompt) => setChatMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, connectPrompts:    [...(m.connectPrompts    ?? []), prompt] } : m)),
      onPermissionPrompt: (prompt) => setChatMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, permissionPrompts: [...(m.permissionPrompts ?? []), prompt] } : m)),
      onToolActivity: (item: PersonaActivityItem) => setChatMessages(prev => prev.map(m => {
        if (m.id !== asstMsgId) return m
        const acts = m.activities ?? []
        const idx  = acts.findIndex(a => a.id === item.id)
        if (idx >= 0) { const u = [...acts]; u[idx] = { ...acts[idx], ...item } as ActivityItem; return { ...m, activities: u } }
        return { ...m, activities: [...acts, item as ActivityItem] }
      })),
    }

    try {
      abortStreamRef.current = await testVersionStream(
        repoId, versionId, trimmedValue, callbacks,
        {
          files:                filesToSend.length > 0 ? filesToSend : undefined,
          connectorSlugs:       connectorSlugs.length > 0 ? connectorSlugs : undefined,
          disabledConnectors:   disabledConnectorSlugs.length > 0 ? disabledConnectorSlugs : undefined,
        },
      )
    } catch (err) {
      callbacks.onError?.((err as Error).message ?? 'Failed to send message')
    }
  }, [])

  // ── Versions state ──────────────────────────────────────────────────────────

  const [versions,          setVersions]          = useState<PersonaVersionListItem[]>([])
  const [versionsLoading,   setVersionsLoading]   = useState(false)
  const [restoringId,       setRestoringId]       = useState<string | null>(null)
  const [pendingChangeTags, _setPendingChangeTags] = useState<string[]>([])
  const versionRestoreCallbackRef = useRef<((version: PersonaVersionResponse) => void) | null>(null)
  const restoringRef = useRef(false)

  const addPendingChangeTag = useCallback((tag: string) => {
    _setPendingChangeTags(prev => prev.includes(tag) ? prev : [...prev, tag])
  }, [])
  const setPendingChangeTags = useCallback((tags: string[]) => {
    _setPendingChangeTags(tags)
  }, [])

  const registerVersionRestoreCallback = useCallback(
    (fn: ((version: PersonaVersionResponse) => void) | null) => {
      versionRestoreCallbackRef.current = fn
    },
    [],
  )

  useEffect(() => {
    if (!versionsOpen) return
    const repoId = infoRef.current.repoId
    if (!repoId) return
    setVersionsLoading(true)
    listVersions(repoId)
      .then(v => setVersions(
        v.slice()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5),
      ))
      .catch(() => {})
      .finally(() => setVersionsLoading(false))
  }, [versionsOpen])

  const refreshVersions = useCallback(() => {
    const repoId = infoRef.current.repoId
    if (!repoId) return
    listVersions(repoId)
      .then(v => setVersions(
        v.slice()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5),
      ))
      .catch(() => {})
  }, [])

  const handleRestoreVersion = useCallback(async (targetId: string) => {
    const repoId = infoRef.current.repoId
    if (!repoId || restoringRef.current) return
    restoringRef.current = true
    setRestoringId(targetId)
    try {
      const full = await getVersion(repoId, targetId)
      // Update URL without navigating
      const params = new URLSearchParams(window.location.search)
      params.set('versionId', targetId)
      window.history.replaceState(null, '', `?${params.toString()}`)
      // Update shared guide prompt
      updatePersonaInfo({ versionId: targetId, guidePrompt: full.prompt ?? '' })
      // Reorder versions list
      setVersions(prev => {
        const target = prev.find(x => x.id === targetId)
        if (!target) return prev
        return [target, ...prev.filter(x => x.id !== targetId)]
      })
      // Delegate page-specific side effects (editor update, model switch, etc.)
      if (versionRestoreCallbackRef.current) {
        versionRestoreCallbackRef.current(full)
        toast.success('Version restored — click Publish to make it live')
      } else {
        // Not on Instructions tab — navigate there so the editor picks up the restore
        toast.success('Version restored — click Publish to make it live')
        push(`/persona/configure/instructions?repoId=${repoId}&versionId=${targetId}`)
      }
    } catch {
      toast.error('Failed to restore version')
    } finally {
      restoringRef.current = false
      setRestoringId(null)
    }
  }, [push, updatePersonaInfo])

  // ── Context value ───────────────────────────────────────────────────────────

  const value: PersonaConfigureContextValue = {
    personaInfo,
    updatePersonaInfo,

    helpOpen,
    setHelpOpen,
    helpActiveId,
    setHelpActiveId,

    knowledgeFileCount,
    setKnowledgeFileCount,
    hasShareLink,
    setHasShareLink,

    registerAutoSave,

    needsRepublish,
    setNeedsRepublish,
    leaveConfirmHref,
    setLeaveConfirmHref,
    safeNavigate,
    safeBack,
    hasPublishAndLeave,
    setOnPublishAndLeave,
    handlePublishAndLeave,

    testChatOpen,
    testChatExpanded,
    aiSuggestOpen,
    guideExpanded,
    versionsOpen,
    anyPanelOpen,

    toggleTestChat,
    toggleAiSuggest,
    toggleVersions,
    setTestChatOpen,
    setTestChatExpanded,
    setGuideExpanded,
    setVersionsOpen,
    setAiSuggestOpen,

    guideMessages,
    guideIsStreaming,
    guideScrollRef,
    handleGuideSend,

    chatMessages,
    isStreaming,
    chatScrollRef,
    handleTestChatSend,
    testChatWebSearch,
    testChatStyleId,
    testChatFolders,
    testChatPersonaId,
    testChatAttachments,
    setTestChatWebSearch,
    setTestChatStyleId,
    setTestChatFolders,
    setTestChatPersonaId,
    setTestChatAttachments,
    handleTestChatAddFiles,
    handleTestChatFileChange,
    testChatFileInputRef,
    FILE_ACCEPT,

    versions,
    versionsLoading,
    restoringId,
    handleRestoreVersion,
    refreshVersions,
    registerVersionRestoreCallback,

    pendingChangeTags,
    addPendingChangeTag,
    setPendingChangeTags,
  }

  return (
    <PersonaConfigureContext.Provider value={value}>
      {children}
    </PersonaConfigureContext.Provider>
  )
}

// ── Public provider (wraps inner in Suspense for useSearchParams) ─────────────

export function PersonaConfigureProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <PersonaConfigureProviderInner>{children}</PersonaConfigureProviderInner>
    </Suspense>
  )
}
