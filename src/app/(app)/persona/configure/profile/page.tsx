'use client'

import React, { useState, useRef, Suspense, useEffect } from 'react'
import Image from 'next/image'
import { AnimatePresence, m } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeftOneIcon,
  MoreVerticalIcon,
  QuillWriteOneIcon,
  ArrowUpRightOneIcon,
  UserAiIcon,
  AiIdeaIcon,
  FolderLibraryIcon,
  ArrowDownOneIcon,
  CancelOneIcon,
  ExpandIcon,
  ViewOffSlashIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { toast } from 'sonner'
import { ChatInput } from '@/components/ChatInput'
import ProfileTab from '@/app/(app)/persona/configure/components/ProfileTab'
import { DEFAULT_LANGUAGE } from '@/app/(app)/personas/new/constants'
import {
  getPersonaRepo, updateVersion, setActiveVersion,
  testVersionStream, listVersions,
  type PersonaChatStreamCallbacks,
  type PersonaVersionListItem,
} from '@/lib/api/personas'
import { fetchModelsWithCache } from '@/lib/ai-models'
import { ChatAddMenu, type SelectedPersonaInfo as AddMenuPersonaInfo } from '@/components/chat/AddMenu'
import { AttachmentManager, type PendingAttachment } from '@/components/chat/AttachmentManager'
import { useFileUpload } from '@/hooks/use-file-upload'
import type { PinFolder } from '@/lib/api/pins'
import { MessageBubble } from '@/components/MessageBubble'
import { StreamingMessageBubble } from '@/templates/Brain/StreamingMessageBubble'

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const bytes = atob(data)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new File([arr], filename, { type: mime })
}

const TABS = ['Instructions', 'Profile', 'Knowledge', 'Connectors', 'Sharing'] as const
type Tab = (typeof TABS)[number]

const MUTED_TABS = new Set<Tab>(['Sharing'])

const TAB_ROUTES: Partial<Record<Tab, string>> = {
  Instructions: '/persona/configure/instructions',
  Knowledge:    '/persona/configure/knowledge',
  Connectors:   '/persona/configure/connectors',
  Sharing:      '/persona/configure/sharing',
}

const MAX_VERSIONS = 5

function formatVersionDate(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${date} · ${time}`
}

function nameInitials(name: string): string {
  return (name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function FloatingMenu({
  testChatOpen,
  onToggleTestChat,
  versionsOpen,
  onToggleVersions,
}: {
  testChatOpen: boolean
  onToggleTestChat: () => void
  versionsOpen: boolean
  onToggleVersions: () => void
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
      {/* Icon 1 - test persona chat */}
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

      {/* Icon 2 - AI idea */}
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

      {/* Icon 3 - versions */}
      <button
        onClick={onToggleVersions}
        title={versionsOpen ? 'Close versions' : 'View versions'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 6,
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          backgroundColor: versionsOpen ? 'rgba(237,225,215,0.6)' : 'transparent',
          boxShadow: versionsOpen
            ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4)'
            : 'none',
          transition: 'background-color 150ms, box-shadow 150ms',
        }}
      >
        {versionsOpen && (
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
        <FolderLibraryIcon size={20} color="var(--neutral-700)" animated />
      </button>
    </div>
  )
}

function PersonaConfigureProfileContent() {
  const { push, back } = useRouter()
  const searchParams = useSearchParams()
  const nameParam  = searchParams.get('name')      ?? ''
  const repoId     = searchParams.get('repoId')    ?? ''
  const versionId  = searchParams.get('versionId') ?? ''

  // Session-storage key scoped to this persona (or 'new' while creating)
  const PROFILE_KEY = `persona_profile_${repoId || 'new'}`

  // Helper: read saved draft (runs synchronously â€” client only)
  function loadDraft() {
    if (typeof window === 'undefined') return null
    try { return JSON.parse(sessionStorage.getItem(PROFILE_KEY) ?? 'null') as Record<string, unknown> | null }
    catch { return null }
  }

  const [testChatOpen,    setTestChatOpen]    = useState(false)
  const [versionsOpen,    setVersionsOpen]    = useState(false)
  const [versions,        setVersions]        = useState<PersonaVersionListItem[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [restoringId,     setRestoringId]     = useState<string | null>(null)
  const [isSaving,        setIsSaving]        = useState(false)
  const [isPublishing,    setIsPublishing]    = useState(false)

  // ── Test-chat streaming state ────────────────────────────────────────────────
  const [personaModelName,  setPersonaModelName]  = useState<string>('AI')
  type ChatMsg = { id: string; role: 'user' | 'assistant'; text: string; isStreaming?: boolean }
  const [chatMessages,  setChatMessages]  = useState<ChatMsg[]>([])
  // eslint-disable-next-line react-doctor/rerender-state-only-in-handlers -- isStreaming guards the send handler to prevent duplicate submissions
  const [isStreaming,   setIsStreaming]   = useState(false)
  const abortStreamRef  = useRef<(() => void) | null>(null)
  const chatScrollRef   = useRef<HTMLDivElement>(null)

  // ── Test-chat add-menu state ──────────────────────────────────────────────────
  const [testChatWebSearch,   setTestChatWebSearch]   = useState(false)
  const [testChatStyleId,     setTestChatStyleId]     = useState<string | null>(null)
  const [testChatFolders,     setTestChatFolders]     = useState<PinFolder[]>([])
  const [testChatPersonaId,   setTestChatPersonaId]   = useState<string | null>(null)
  const [testChatAttachments, setTestChatAttachments] = useState<PendingAttachment[]>([])
  const testChatFileInputRef = useRef<HTMLInputElement>(null)
  const { processFiles, FILE_ACCEPT } = useFileUpload()

  // ProfileTab state â€” initialise from sessionStorage on first render
  const [avatarUrl,          setAvatarUrl]          = useState<string | null>(() => { const d = loadDraft(); return (d?.avatarUrl as string | null) ?? null })
  const [personaName,        setPersonaName]        = useState<string>(() => { const d = loadDraft(); return (d?.personaName as string) || nameParam || 'Persona Name' })
  const [personaHandle,      setPersonaHandle]      = useState<string>(() => { const d = loadDraft(); return (d?.personaHandle as string) ?? '' })
  const [personaDescription, setPersonaDescription] = useState<string>(() => {
    const d = loadDraft()
    if (d?.personaDescription as string | undefined) return d!.personaDescription as string
    // Seed from wizard purpose saved by instructions page after creating the persona
    if (repoId && typeof window !== 'undefined') {
      try {
        const seed = sessionStorage.getItem(`persona_wizard_purpose_${repoId}`)
        if (seed) return seed
      } catch { /* ignore */ }
    }
    return ''
  })
  const [personaTags,        setPersonaTags]        = useState<string[]>(() => { const d = loadDraft(); return (d?.personaTags as string[]) ?? ['Internal', 'Legal'] })
  const [isMultilingual,     setIsMultilingual]     = useState<boolean>(() => { const d = loadDraft(); return (d?.isMultilingual as boolean) ?? false })
  const [selectedLanguages,  setSelectedLanguages]  = useState<Set<string>>(() => {
    const d = loadDraft()
    const arr = d?.selectedLanguages as string[] | undefined
    return arr ? new Set(arr) : new Set([DEFAULT_LANGUAGE])
  })

  // Gate auto-save so we never persist placeholder defaults before the API has
  // had a chance to load the real persona data.
  // â€¢ No repoId (still in wizard): initialize as true â€” save whatever the user types.
  // â€¢ Has repoId (editing existing): start false, flip to true after API resolves.
  const [isInitialized, setIsInitialized] = useState(!repoId)
  // Ref mirrors the state so the auto-save effect can gate on it without listing
  // isInitialized as a dep (which would create an effect chain: fetch sets
  // isInitialized â†’ auto-save effect triggers solely because isInitialized changed).
  const isInitializedRef = useRef(!repoId)

  // â”€â”€ Load real persona data from API on first visit (no meaningful draft yet) â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!repoId) { isInitializedRef.current = true; setIsInitialized(true); return }

    // Wizard purpose has been consumed into state â€” clean up the one-shot key
    try { sessionStorage.removeItem(`persona_wizard_purpose_${repoId}`) } catch { /* ignore */ }

    // If the user already has meaningful profile data saved, skip the API call
    const draft = loadDraft()
    const hasMeaningfulDraft = !!draft && (
      !!(draft.personaHandle as string | undefined) ||
      !!(draft.personaDescription as string | undefined) ||
      !!(draft.avatarUrl as string | null | undefined) ||
      ((draft.personaName as string | undefined) ?? 'Persona Name') !== 'Persona Name'
    )
    if (hasMeaningfulDraft) { isInitializedRef.current = true; setIsInitialized(true); return }

    getPersonaRepo(repoId)
      .then(repo => {
        const v = repo.active_version
        // Overwrite defaults with real API data
        setPersonaName(repo.name || 'Persona Name')
        if (v?.handler)   setPersonaHandle(`@${v.handler}`)
        if (v?.image_url) setAvatarUrl(v.image_url)
        // Use the prompt as description only if it's short enough â€” on a brand-new
        // persona the prompt is just the one-sentence wizard purpose.
        if (v?.prompt && v.prompt.trim().length <= 120) {
          setPersonaDescription(v.prompt.trim())
        }
        // Load model name for test-chat display (informational, fire-and-forget)
        if (v?.model_id) {
          fetchModelsWithCache()
            .then(models => {
              const m = models.find(m => String(m.modelId ?? m.id) === v!.model_id)
              if (m) setPersonaModelName(m.modelName)
            })
            .catch(() => {})
        }
      })
      .catch(err => console.error('[ProfilePage] API load error:', err))
      .finally(() => { isInitializedRef.current = true; setIsInitialized(true) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId])

  // Auto-save to sessionStorage whenever any profile field changes.
  // Uses isInitializedRef (not state) so this effect is not triggered by the
  // initialization itself â€” only by actual field edits after loading completes.
  useEffect(() => {
    if (!isInitializedRef.current) return
    try {
      sessionStorage.setItem(PROFILE_KEY, JSON.stringify({
        avatarUrl,
        personaName,
        personaHandle,
        personaDescription,
        personaTags,
        isMultilingual,
        selectedLanguages: [...selectedLanguages],
      }))
    } catch { /* storage quota exceeded â€” ignore */ }
  }, [PROFILE_KEY, avatarUrl, personaName, personaHandle, personaDescription, personaTags, isMultilingual, selectedLanguages])

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    const el = chatScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatMessages])

  async function handleTestChatSend(value: string) {
    if (!value.trim() || !repoId || !versionId || isStreaming) return

    const userMsgId = `user-${Date.now()}`
    const asstMsgId = `asst-${Date.now()}`

    setChatMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user',      text: value.trim() },
      { id: asstMsgId, role: 'assistant', text: '', isStreaming: true },
    ])
    setIsStreaming(true)

    const callbacks: PersonaChatStreamCallbacks = {
      onChunk: (delta) => setChatMessages(prev =>
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
      abortStreamRef.current = await testVersionStream(repoId, versionId, value.trim(), callbacks)
    } catch (err) {
      callbacks.onError?.((err as Error).message ?? 'Failed to send message')
    }
  }

  function handleTestChatAddFiles() { testChatFileInputRef.current?.click() }

  function handleTestChatFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      const captured = Array.from(e.target.files)
      e.target.value = ''
      setTestChatAttachments(prev => processFiles(captured, prev))
    }
  }

  function handleTestChatFolderToggle(folder: PinFolder) {
    setTestChatFolders(prev =>
      prev.some(f => f.id === folder.id)
        ? prev.filter(f => f.id !== folder.id)
        : [...prev, folder]
    )
  }

  // Load versions when panel opens
  useEffect(() => {
    if (!versionsOpen || !repoId) return
    setVersionsLoading(true)
    listVersions(repoId)
      .then(v => setVersions(
        v.slice()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, MAX_VERSIONS)
      ))
      .catch(() => {})
      .finally(() => setVersionsLoading(false))
  }, [versionsOpen, repoId])

  function handleRestoreVersion(targetId: string) {
    if (!repoId || restoringId) return
    setRestoringId(targetId)
    const params = new URLSearchParams()
    params.set('repoId', repoId)
    params.set('versionId', targetId)
    if (personaName) params.set('name', encodeURIComponent(personaName))
    push(`/persona/configure/instructions?repoId=${repoId}&versionId=${targetId}&name=${encodeURIComponent(personaName)}`)
  }

  async function handleSaveVersion() {
    if (!repoId || !versionId) return
    setIsSaving(true)
    try {
      let imageFile: File | undefined
      if (avatarUrl?.startsWith('data:')) {
        imageFile = dataUrlToFile(avatarUrl, 'avatar.jpg')
      }
      await updateVersion({ repoId, versionId, name: personaName, prompt: personaDescription, ...(imageFile ? { image: imageFile } : {}) })
      toast.success('Profile saved')
    } catch (err) {
      console.error('[ProfilePage] save error:', err)
      toast.error('Failed to save profile')
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePublish() {
    if (!repoId || !versionId) return
    setIsPublishing(true)
    try {
      let imageFile: File | undefined
      if (avatarUrl?.startsWith('data:')) {
        imageFile = dataUrlToFile(avatarUrl, 'avatar.jpg')
      }
      if (imageFile || personaName || personaDescription) {
        await updateVersion({ repoId, versionId, name: personaName, prompt: personaDescription, ...(imageFile ? { image: imageFile } : {}) })
      }
      await setActiveVersion(repoId, versionId)
      push(`/personas/published?name=${encodeURIComponent(personaName)}&repoId=${repoId}`)
    } catch (err) {
      console.error('[ProfilePage] publish error:', err)
      toast.error('Failed to publish')
    } finally {
      setIsPublishing(false)
    }
  }

  const handleTabClick = (tab: Tab) => {
    const route = TAB_ROUTES[tab]
    if (route) {
      push(`${route}?${searchParams.toString()}`)
    }
  }

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
      {/* â”€â”€ Left configure panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
        {/* â”€â”€ Top navigation bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{ flexShrink: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 36,
              position: 'relative',
            }}
          >
            {/* Back arrow */}
            <div style={{ flexShrink: 0 }}>
              <IconButton
                variant="ghost"
                size="md"
                icon={<ArrowLeftOneIcon size={20} />}
                aria-label="Go back"
                onClick={() => back()}
              />
            </div>

            {/* Tabs â€” absolutely centered so left/right items don't affect positioning */}
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'inline-flex', alignItems: 'flex-start' }}>
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
                  const isActive = tab === 'Profile'
                  return (
                    <button
                      key={tab}
                      onClick={() => handleTabClick(tab)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '7px 8px',
                        borderRadius: 10,
                        border: 'none',
                        cursor: TAB_ROUTES[tab] || !isActive ? 'pointer' : 'default',
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
                icon={<MoreVerticalIcon size={20} />}
                aria-label="More options"
              />
              {testChatOpen ? (
                <IconButton
                  variant="outline"
                  size="sm"
                  icon={<QuillWriteOneIcon size={16} />}
                  aria-label="Save version"
                  onClick={handleSaveVersion}
                  disabled={!repoId || !versionId || isSaving}
                  loading={isSaving}
                />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<QuillWriteOneIcon size={16} />}
                  onClick={handleSaveVersion}
                  disabled={!repoId || !versionId || isSaving}
                  loading={isSaving}
                >
                  {isSaving ? 'Saving…' : 'Save version'}
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                rightIcon={<ArrowUpRightOneIcon size={16} />}
                onClick={handlePublish}
                disabled={!repoId || !versionId || isPublishing}
              >
                {isPublishing ? 'Publishing…' : 'Publish'}
              </Button>
            </div>
          </div>

          <div style={{ height: 32, flexShrink: 0 }} />
        </div>

        {/* â”€â”€ Scrollable profile form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              width: '100%',
              maxWidth: 429,
              paddingBottom: 32,
            }}
          >
            <ProfileTab
              avatarUrl={avatarUrl}
              onAvatarChange={setAvatarUrl}
              personaName={personaName}
              onPersonaNameChange={setPersonaName}
              personaHandle={personaHandle}
              onPersonaHandleChange={setPersonaHandle}
              personaDescription={personaDescription}
              onPersonaDescriptionChange={setPersonaDescription}
              personaTags={personaTags}
              onPersonaTagsChange={setPersonaTags}
              isMultilingual={isMultilingual}
              onIsMultilingualChange={setIsMultilingual}
              selectedLanguages={selectedLanguages}
              onSelectedLanguagesChange={setSelectedLanguages}
            />
            <div style={{ height: 24, flexShrink: 0 }} />
          </div>
        </div>

        {/* â”€â”€ Floating vertical menu (pinboard-style: always anchored to right of configure panel) */}
        <div
          style={{
            position: 'absolute',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
          }}
        >
          <FloatingMenu
            testChatOpen={testChatOpen}
            onToggleTestChat={() => setTestChatOpen(v => !v)}
            versionsOpen={versionsOpen}
            onToggleVersions={() => setVersionsOpen(v => !v)}
          />
        </div>
      </div>

      {/* â”€â”€ Test chat panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AnimatePresence>
        {testChatOpen && (
          <m.div
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
            {/* Chat panel header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div
                  style={{
                    position: 'relative',
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    flexShrink: 0,
                    backgroundColor: avatarUrl ? undefined : 'var(--neutral-100)',
                    boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)',
                    overflow: 'hidden',
                  }}
                >
                  {avatarUrl && (
                    <Image src={avatarUrl} alt="" fill unoptimized style={{ objectFit: 'cover' }} />
                  )}
                </div>
                <p
                  style={{
                    fontFamily: 'var(--font-title)',
                    fontWeight: 400,
                    fontSize: 24,
                    lineHeight: '32px',
                    color: '#1a1916',
                    margin: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {personaName}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {/* <div style={{ opacity: 0.7 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<ViewOffSlashIcon size={16} />}
                    rightIcon={<ArrowDownOneIcon size={16} />}
                  >
                    Mock connector
                  </Button>
                </div>
                <IconButton
                  variant="outline"
                  size="md"
                  icon={<ExpandIcon size={20} />}
                  aria-label="Expand test chat"
                /> */}
                <IconButton
                  variant="outline"
                  size="md"
                  icon={<CancelOneIcon size={20} />}
                  aria-label="Close test chat"
                  onClick={() => setTestChatOpen(false)}
                />
              </div>
            </div>

            {/* Messages area */}
            <div
              ref={chatScrollRef}
              className="kaya-scrollbar"
              style={{
                flex: '1 0 0',
                minHeight: 0,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: '4px 8px',
              }}
            >
              {chatMessages.length === 0 ? (
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontSize: 16,
                    lineHeight: '22px',
                    color: 'var(--neutral-600)',
                    margin: 0,
                  }}
                >
                  {`Hi! I'm ${personaName}. Test me here while you configure.`}
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
                    {msg.role === 'assistant' ? (
                      <StreamingMessageBubble
                        content={msg.text}
                        isComplete={!msg.isStreaming}
                      />
                    ) : (
                      <MessageBubble
                        role={msg.role}
                        content={msg.text}
                        maxWidth="85%"
                        hideActions
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Chat input */}
            <div style={{ flexShrink: 0 }}>
              <input
                ref={testChatFileInputRef}
                type="file"
                multiple
                accept={FILE_ACCEPT}
                onChange={handleTestChatFileChange}
                style={{ display: 'none' }}
                aria-hidden="true"
              />
              <ChatInput
                placeholder={`Message ${personaName}...`}
                textareaLabel="Test message"
                modelName={personaModelName}
                hideModelSelector={true}
                webSearch={testChatWebSearch}
                onWebSearchChange={setTestChatWebSearch}
                addMenu={
                  <ChatAddMenu
                    webSearchEnabled={testChatWebSearch}
                    onWebSearchChange={setTestChatWebSearch}
                    onAddFilesClick={handleTestChatAddFiles}
                    selectedStyleId={testChatStyleId}
                    onStyleChange={setTestChatStyleId}
                    selectedFolders={testChatFolders}
                    onFolderToggle={handleTestChatFolderToggle}
                    selectedPersonaId={testChatPersonaId}
                    onPersonaChange={(p) => setTestChatPersonaId(p?.id ?? null)}
                  />
                }
                attachmentsSlot={
                  <AttachmentManager
                    attachments={testChatAttachments}
                    onAttachmentsChange={setTestChatAttachments}
                  />
                }
                onSend={handleTestChatSend}
              />
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* ── Versions panel ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {versionsOpen && (
          <m.div
            key="versions-panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 400, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 32, mass: 0.9 }}
            style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', paddingLeft: 5, paddingRight: 5, paddingTop: 12, paddingBottom: 12, overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                  <FolderLibraryIcon size={20} color="var(--neutral-700)" animated />
                </div>
                <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0, whiteSpace: 'nowrap' }}>Versions</p>
              </div>
              <IconButton variant="outline" size="md" icon={<CancelOneIcon size={20} />} aria-label="Close versions" onClick={() => setVersionsOpen(false)} />
            </div>
            <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 4 }}>
              {versionsLoading ? (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: 0 }}>Loading…</p>
              ) : versions.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: '24px 0', textAlign: 'center' }}>No versions yet. Use &ldquo;Save version&rdquo; to create one.</p>
              ) : versions.map((v, i) => {
                const isCurrent = v.id === versionId
                const vNum = versions.length - i
                const vLabel = `v${String(vNum).padStart(3, '0')}`
                const handle = v.handler ? `@${v.handler}·${vLabel}` : vLabel
                const dateStr = formatVersionDate(v.created_at)
                const initials = nameInitials(v.name || personaName)
                return (
                  <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: 12, borderRadius: 16, backgroundColor: isCurrent ? 'var(--neutral-white)' : 'var(--neutral-50)', border: isCurrent ? 'none' : '1px dashed var(--neutral-300)', boxShadow: isCurrent ? '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)' : 'none', flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%' }}>
                      <div style={{ width: 37, height: 37, borderRadius: 8, flexShrink: 0, backgroundColor: 'var(--neutral-100)', boxShadow: '0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--neutral-600)', lineHeight: 1 }}>{initials}</span>
                      </div>
                      <div style={{ flex: '1 0 0', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', whiteSpace: 'nowrap', width: '100%' }}>
                          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '55%' }}>{v.name || personaName}</p>
                          <p style={{ fontFamily: 'monospace', fontWeight: 400, fontSize: 13, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0, flexShrink: 0 }}>{dateStr}</p>
                        </div>
                        <p style={{ fontFamily: 'monospace', fontWeight: 400, fontSize: 13, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{handle}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', width: '100%' }}>
                      {isCurrent ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px 6px', borderRadius: 8, flexShrink: 0, cursor: 'default', background: 'linear-gradient(180deg, #524b47 0%, #26211e 100%)', boxShadow: '0px 0px 0px 1px black, 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4)', position: 'relative' }}>
                          <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', boxShadow: 'inset 0px 1px 0.364px 0px rgba(247,242,237,0.3), inset 0px -2.182px 0.364px 0px #120c08, inset 0px -2.545px 4px -2.182px rgba(247,242,237,0.5)', pointerEvents: 'none' }} />
                          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#f7f2ed', whiteSpace: 'nowrap', textShadow: '0px -0.727px 0.364px rgba(0,0,0,0.25), 0px 0.364px 0.364px rgba(255,255,255,0.25)' }}>Current</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRestoreVersion(v.id)}
                          disabled={!!restoringId}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '5px 8px', borderRadius: 8, border: 'none', flexShrink: 0, cursor: restoringId ? 'not-allowed' : 'pointer', backgroundColor: 'transparent', boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)', opacity: restoringId ? 0.5 : 1, transition: 'opacity 150ms' }}
                        >
                          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', whiteSpace: 'nowrap' }}>
                            {restoringId === v.id ? 'Loading…' : 'Restore'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </m.div>
        )}
      </AnimatePresence>

    </div>
  )
}

export default function PersonaConfigureProfilePage() {
  return (
    <Suspense>
      <PersonaConfigureProfileContent />
    </Suspense>
  )
}
