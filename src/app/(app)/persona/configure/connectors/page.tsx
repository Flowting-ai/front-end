'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { updateVersion, getVersion, listVersions, testVersionStream, type PersonaVersionListItem, type PersonaChatStreamCallbacks } from '@/lib/api/personas'
import { ConnectPromptCard, PermissionPromptCard } from '@/components/chat/ConnectorPrompts'
import { ActivitiesSection } from '@/components/chat/ActivityRow'
import type { PersonaConnectPrompt, PersonaPermissionPrompt, PersonaActivityItem } from '@/lib/api/personas'
import type { ActivityItem } from '@/hooks/use-chat-state'
import { MessageBubble } from '@/components/MessageBubble'
import { StreamingMessageBubble } from '@/templates/Brain/StreamingMessageBubble'
import {
  ArrowLeftOneIcon,
  MoreVerticalIcon,
  QuillWriteOneIcon,
  ArrowUpRightOneIcon,
  UserAiIcon,
  AiIdeaIcon,
  FolderLibraryIcon,
  CancelOneIcon,
  ExpandIcon,
  ArrowShrinkTwoIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { ChatInput } from '@/components/ChatInput'
import ConnectorsTab from '@/app/(app)/persona/configure/components/ConnectorsTab'
import { VersionCard } from '@/components/VersionCard'

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = ['Instructions', 'Profile', 'Knowledge', 'Connectors', 'Sharing'] as const
type Tab = (typeof TABS)[number]

const MUTED_TABS = new Set<Tab>(['Sharing'])

const TAB_ROUTES: Partial<Record<Tab, string>> = {
  Instructions: '/persona/configure/instructions',
  Profile:      '/persona/configure/profile',
  Knowledge:    '/persona/configure/knowledge',
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

// ── Floating menu ─────────────────────────────────────────────────────────────

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

// ── Main page content ─────────────────────────────────────────────────────────

function PersonaConfigureConnectorsContent() {
  const { push, back } = useRouter()
  const searchParams = useSearchParams()
  const personaName = searchParams.get('name')      ?? ''
  const repoId      = searchParams.get('repoId')    ?? ''
  const versionId   = searchParams.get('versionId') ?? ''

  const [testChatOpen,       setTestChatOpen]       = useState(false)
  const [testChatExpanded,   setTestChatExpanded]   = useState(false)
  const [connectorSlugs,     setConnectorSlugs]     = useState<string[] | null>(null)
  const [versionsOpen,       setVersionsOpen]       = useState(false)
  const anyPanelOpen = testChatOpen || versionsOpen
  const [versions,           setVersions]           = useState<PersonaVersionListItem[]>([])
  const [versionsLoading,    setVersionsLoading]    = useState(false)
  const [restoringId,        setRestoringId]        = useState<string | null>(null)
  const [isSaving,           setIsSaving]           = useState(false)

  type ChatMsg = { id: string; role: 'user' | 'assistant'; text: string; isStreaming?: boolean; connectPrompts?: PersonaConnectPrompt[]; permissionPrompts?: PersonaPermissionPrompt[]; activities?: ActivityItem[] }
  const [chatMessages,  setChatMessages]  = useState<ChatMsg[]>([])
  // eslint-disable-next-line react-doctor/rerender-state-only-in-handlers -- isStreaming guards send to prevent duplicate submissions
  const [isStreaming,   setIsStreaming]   = useState(false)
  const abortStreamRef  = useRef<(() => void) | null>(null)
  const chatScrollRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = chatScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatMessages])

  useEffect(() => {
    if (!repoId || !versionId) return
    getVersion(repoId, versionId)
      .then(v => { if (v.connector_slugs != null) setConnectorSlugs(v.connector_slugs) })
      .catch(() => {})
  }, [repoId, versionId])

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
      onChunk: (delta) => setChatMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, text: m.text + delta } : m)),
      onDone:  ()      => { setChatMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, isStreaming: false } : m)); setIsStreaming(false) },
      onError: (err)   => { setChatMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, text: `⚠ ${err}`, isStreaming: false } : m)); setIsStreaming(false) },
      onConnectPrompt: (prompt) => setChatMessages(prev =>
        prev.map(m => m.id === asstMsgId ? { ...m, connectPrompts: [...(m.connectPrompts ?? []), prompt] } : m)
      ),
      onPermissionPrompt: (prompt) => setChatMessages(prev =>
        prev.map(m => m.id === asstMsgId ? { ...m, permissionPrompts: [...(m.permissionPrompts ?? []), prompt] } : m)
      ),
      onToolActivity: (item: PersonaActivityItem) => setChatMessages(prev =>
        prev.map(m => {
          if (m.id !== asstMsgId) return m
          const acts = m.activities ?? []
          const idx  = acts.findIndex(a => a.id === item.id)
          if (idx >= 0) {
            const updated = [...acts]; updated[idx] = { ...acts[idx], ...item } as ActivityItem
            return { ...m, activities: updated }
          }
          return { ...m, activities: [...acts, item as ActivityItem] }
        })
      ),
    }
    try {
      abortStreamRef.current = await testVersionStream(repoId, versionId, value.trim(), callbacks, { connectorSlugs: connectorSlugs ?? undefined })
    } catch (err) {
      callbacks.onError?.((err as Error).message ?? 'Failed to send message')
    }
  }

  useEffect(() => {
    if (!versionsOpen || !repoId) return
    setVersionsLoading(true)
    listVersions(repoId)
      .then(v => setVersions(v.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, MAX_VERSIONS)))
      .catch(() => {})
      .finally(() => setVersionsLoading(false))
  }, [versionsOpen, repoId])

  function handleRestoreVersion(targetId: string) {
    if (!repoId || restoringId) return
    setRestoringId(targetId)
    push(`/persona/configure/instructions?repoId=${repoId}&versionId=${targetId}&name=${encodeURIComponent(personaName)}`)
  }

  async function handleSaveVersion() {
    if (!repoId || !versionId) return
    setIsSaving(true)
    try {
      await updateVersion({ repoId, versionId, name: personaName || undefined })
      toast.success('Version saved')
    } catch (err) {
      console.error('[ConnectorsPage] save error:', err)
      toast.error('Failed to save version')
    } finally {
      setIsSaving(false)
    }
  }

  const handleTabClick = (tab: Tab) => {
    const route = TAB_ROUTES[tab]
    if (route) push(`${route}?${searchParams.toString()}`)
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
      {/* ── Left configure panel ─────────────────────────────────────────────── */}
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
        {/* ── Top navigation bar ────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: anyPanelOpen ? 'flex-start' : 'space-between',
              gap: anyPanelOpen ? 8 : 0,
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

            {/* Tabs — absolutely centered so left/right items don't affect positioning */}
            <div style={anyPanelOpen ? { display: 'inline-flex', alignItems: 'flex-start' } : { position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'inline-flex', alignItems: 'flex-start' }}>
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
                  const isActive = tab === 'Connectors'
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
                        cursor: isActive ? 'default' : (TAB_ROUTES[tab] ? 'pointer' : 'default'),
                        backgroundColor: isActive ? 'var(--neutral-white)' : 'transparent',
                        boxShadow: isActive
                          ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100), inset 0px -1px 0px 0px rgba(38,33,30,0.1)'
                          : 'none',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        fontSize: 14,
                        lineHeight: '22px',
                        color: isActive ? 'var(--blue-600)' : 'var(--neutral-700)',
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
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginLeft: anyPanelOpen ? 'auto' : undefined }}>
              <IconButton
                variant="outline"
                size="md"
                icon={<MoreVerticalIcon size={20} />}
                aria-label="More options"
              />
              {anyPanelOpen ? (
                <IconButton
                  variant="outline"
                  size="sm"
                  icon={<QuillWriteOneIcon size={16} />}
                  aria-label="Save version"
                  onClick={handleSaveVersion}
                  disabled={true}
                  loading={isSaving}
                />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<QuillWriteOneIcon size={16} />}
                  onClick={handleSaveVersion}
                  disabled={true}
                  loading={isSaving}
                >
                  {isSaving ? 'Saving…' : 'Save version'}
                </Button>
              )}
              <Button variant="default" size="sm" rightIcon={<ArrowUpRightOneIcon size={16} />}>
                Publish
              </Button>
            </div>
          </div>

          {/* Spacer below nav */}
          <div style={{ height: 32, flexShrink: 0 }} />
        </div>

        {/* ── Scrollable content area ────────────────────────────────────────── */}
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
              maxWidth: 714,
              paddingBottom: 32,
            }}
          >
            <ConnectorsTab repoId={repoId || undefined} versionId={versionId || undefined} />
          </div>
        </div>

        {/* ── Floating vertical menu ────────────────────────────────────────── */}
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

      {/* ── Test chat panel (slides in from right) ─────────────────────────── */}
      <AnimatePresence>
        {testChatOpen && !testChatExpanded && (
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
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    flexShrink: 0,
                    backgroundColor: 'var(--neutral-100)',
                    boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)',
                    overflow: 'hidden',
                  }}
                />
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
                  {personaName || 'Name'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <IconButton
                  variant="outline"
                  size="md"
                  icon={testChatExpanded ? <ArrowShrinkTwoIcon size={20} /> : <ExpandIcon size={20} />}
                  aria-label={testChatExpanded ? 'Collapse test chat' : 'Expand test chat'}
                  onClick={() => setTestChatExpanded(e => !e)}
                />
                <IconButton
                  variant="outline"
                  size="md"
                  icon={<CancelOneIcon size={20} />}
                  aria-label="Close test chat"
                  onClick={() => { setTestChatOpen(false); setTestChatExpanded(false) }}
                />
              </div>
            </div>

            {/* Messages area */}
            <div ref={chatScrollRef} className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 8px' }}>
              {chatMessages.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-600)', margin: 0 }}>
                  {`Hi! I'm ${personaName || 'your persona'}. Test me here while you configure.`}
                </p>
              ) : (
                chatMessages.map(msg => (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.role === 'assistant' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                        {msg.activities && msg.activities.length > 0 && <ActivitiesSection activities={msg.activities} />}
                        {msg.text && <StreamingMessageBubble content={msg.text} isComplete={!msg.isStreaming} />}
                        {msg.connectPrompts?.map(p => <ConnectPromptCard key={p.request_id} prompt={p} />)}
                        {msg.permissionPrompts?.map(p => <PermissionPromptCard key={p.request_id} prompt={p} />)}
                      </div>
                    ) : <MessageBubble role={msg.role} content={msg.text} maxWidth="85%" hideActions />}
                  </div>
                ))
              )}
            </div>

            {/* Chat input */}
            <div style={{ flexShrink: 0 }}>
              <ChatInput
                placeholder={`Message ${personaName || 'persona'}...`}
                textareaLabel="Test message"
                modelName="Souvenir"
                onSend={handleTestChatSend}
              />
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* ── Test chat expanded overlay ──────────────────────────────────────── */}
      <AnimatePresence>
        {testChatOpen && testChatExpanded && (
          <m.div
            key="test-chat-expanded"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setTestChatExpanded(false) }}
          >
            <m.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.7, delay: 0.04 }}
              style={{
                width: 'min(780px, 90vw)',
                height: 'min(680px, 85vh)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                backgroundColor: 'var(--neutral-white)',
                border: '1px solid var(--neutral-200)',
                borderRadius: 20,
                padding: 16,
                overflow: 'hidden',
                boxShadow: '0px 24px 48px rgba(0,0,0,0.18), 0px 0px 0px 1px rgba(59,54,50,0.08)',
              }}
            >
              {/* Expanded chat header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, backgroundColor: 'var(--neutral-100)', boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)', overflow: 'hidden' }} />
                  <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0, whiteSpace: 'nowrap' }}>
                    {personaName || 'Name'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <IconButton
                    variant="outline"
                    size="md"
                    icon={<ArrowShrinkTwoIcon size={20} />}
                    aria-label="Collapse test chat"
                    onClick={() => setTestChatExpanded(false)}
                  />
                  <IconButton
                    variant="outline"
                    size="md"
                    icon={<CancelOneIcon size={20} />}
                    aria-label="Close test chat"
                    onClick={() => { setTestChatOpen(false); setTestChatExpanded(false) }}
                  />
                </div>
              </div>

              {/* Messages area */}
              <div ref={chatScrollRef} className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 8px' }}>
                {chatMessages.length === 0 ? (
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-600)', margin: 0 }}>
                    {`Hi! I'm ${personaName || 'your persona'}. Test me here while you configure.`}
                  </p>
                ) : (
                  chatMessages.map(msg => (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      {msg.role === 'assistant' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                          {msg.text && <StreamingMessageBubble content={msg.text} isComplete={!msg.isStreaming} />}
                          {msg.connectPrompts?.map(p => <ConnectPromptCard key={p.request_id} prompt={p} />)}
                          {msg.permissionPrompts?.map(p => <PermissionPromptCard key={p.request_id} prompt={p} />)}
                        </div>
                      ) : <MessageBubble role={msg.role} content={msg.text} maxWidth="85%" hideActions />}
                    </div>
                  ))
                )}
              </div>

              {/* Chat input */}
              <div style={{ flexShrink: 0 }}>
                <ChatInput
                  placeholder={`Message ${personaName || 'persona'}...`}
                  textareaLabel="Test message"
                  modelName="Souvenir"
                  onSend={handleTestChatSend}
                />
              </div>
            </m.div>
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
                return (
                  <VersionCard
                    key={v.id}
                    variant={isCurrent ? 'default' : 'restore'}
                    personaName={v.name || personaName}
                    timestamp={dateStr}
                    versionSlug={handle}
                    onRestore={() => handleRestoreVersion(v.id)}
                    disabled={!isCurrent && !!restoringId}
                    style={{ flexShrink: 0 }}
                  />
                )
              })}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function PersonaConfigureConnectorsPage() {
  return (
    <Suspense>
      <PersonaConfigureConnectorsContent />
    </Suspense>
  )
}
