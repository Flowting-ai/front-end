'use client'

import React, { Suspense } from 'react'
import Image from 'next/image'
import { AnimatePresence, m } from 'framer-motion'
import {
  UserAiIcon,
  AiIdeaIcon,
  FolderLibraryIcon,
  CancelOneIcon,
  ExpandIcon,
  ArrowShrinkTwoIcon,
} from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { ChatInput } from '@/components/ChatInput'
import { ChatAddMenu } from '@/components/chat/AddMenu'
import { AttachmentManager } from '@/components/chat/AttachmentManager'
import { ConnectPromptCard, PermissionPromptCard } from '@/components/chat/ConnectorPrompts'
import { ActivitiesSection } from '@/components/chat/ActivityRow'
import { ConnectorTogglesPanel } from '@/app/(app)/persona/configure/components/ConnectorTogglesPanel'
import { MessageBubble } from '@/components/MessageBubble'
import { StreamingMessageBubble } from '@/templates/Brain/StreamingMessageBubble'
import { PersonaConfigureProvider, usePersonaConfigure } from './context'
import { getAllVersionTags } from '@/lib/version-tags'
import { deleteVersion } from '@/lib/api/personas'
import { toast } from 'sonner'

// ── Tag color map (matches Chip/Pinboard design tokens) ──────────────────────

const TAG_COLORS: Record<string, { bg: string; text: string; shadow: string }> = {
  Instructions: { bg: 'var(--color-tag-Blue-bg)',    text: 'var(--color-tag-Blue-text)',    shadow: 'var(--color-tag-Blue-shadow)' },
  Model:        { bg: 'var(--color-tag-Purple-bg)',  text: 'var(--color-tag-Purple-text)',  shadow: 'var(--color-tag-Purple-shadow)' },
  Profile:      { bg: 'var(--color-tag-Green-bg-soft)', text: 'var(--color-tag-Green-text)', shadow: 'var(--color-tag-Green-shadow)' },
  Knowledge:    { bg: 'var(--color-tag-Yellow-bg)',  text: 'var(--color-tag-Yellow-text)',  shadow: 'var(--color-tag-Yellow-shadow)' },
  Connectors:   { bg: 'var(--color-tag-Brown-bg)',   text: 'var(--color-tag-Brown-text)',   shadow: 'var(--color-tag-Brown-shadow)' },
  Sharing:      { bg: 'var(--color-tag-Red-bg)',     text: 'var(--color-tag-Red-text)',     shadow: 'var(--color-tag-Red-shadow)' },
}
const DEFAULT_TAG_COLOR = { bg: 'var(--color-tag-Neutral-bg)', text: 'var(--color-tag-Neutral-text)', shadow: 'var(--color-tag-Neutral-shadow)' }

// ── Floating menu ─────────────────────────────────────────────────────────────

function FloatingMenuButton({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer', position: 'relative',
        backgroundColor: active ? 'rgba(237,225,215,0.6)' : 'transparent',
        boxShadow: active
          ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4)'
          : 'none',
        transition: 'background-color 150ms, box-shadow 150ms',
      }}
    >
      {active && (
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
            boxShadow: 'inset 0px 1px 0px 0px rgba(247,242,237,0.61), inset 0px -1px 0px 0px rgba(106,98,93,0.05)',
          }}
        />
      )}
      {children}
    </button>
  )
}

function FloatingMenu() {
  const { testChatOpen, toggleTestChat, aiSuggestOpen, toggleAiSuggest, versionsOpen, toggleVersions } = usePersonaConfigure()
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        backgroundColor: 'var(--neutral-white)', borderRadius: 12, padding: '4px 4px 6px',
        boxShadow: '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-200)',
        position: 'relative',
      }}
    >
      <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', boxShadow: 'inset 0px -2.182px 0.364px 0px var(--neutral-100)' }} />
      <FloatingMenuButton active={testChatOpen}  title={testChatOpen  ? 'Close test chat'      : 'Open test chat'}      onClick={toggleTestChat}>
        <UserAiIcon        size={20} color="var(--neutral-700)" animated />
      </FloatingMenuButton>
      <FloatingMenuButton active={aiSuggestOpen} title={aiSuggestOpen ? 'Close AI suggestions' : 'AI suggestions'}      onClick={toggleAiSuggest}>
        <AiIdeaIcon        size={20} color="var(--neutral-700)" animated />
      </FloatingMenuButton>
      <FloatingMenuButton active={versionsOpen}  title={versionsOpen  ? 'Close versions'       : 'View versions'}       onClick={toggleVersions}>
        <FolderLibraryIcon size={20} color="var(--neutral-700)" animated />
      </FloatingMenuButton>
    </div>
  )
}

// ── Test chat panel ───────────────────────────────────────────────────────────

function formatVersionDate(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

function nameInitials(name: string) {
  return (name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function TestChatPanelContent({ expanded }: { expanded: boolean }) {
  const {
    personaInfo, setTestChatExpanded, setTestChatOpen, updatePersonaInfo,
    chatMessages, isStreaming, chatScrollRef, handleTestChatSend,
    testChatWebSearch, setTestChatWebSearch, testChatStyleId, setTestChatStyleId,
    testChatFolders, setTestChatFolders, testChatPersonaId, setTestChatPersonaId,
    testChatAttachments, setTestChatAttachments, handleTestChatAddFiles, handleTestChatFileChange,
    testChatFileInputRef, FILE_ACCEPT,
  } = usePersonaConfigure()
  const { repoId, versionId, personaName, imageUrl, guideModelName } = personaInfo

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: '1 1 0', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ position: 'relative', width: 36, height: 36, borderRadius: 10, flexShrink: 0, backgroundColor: 'var(--neutral-100)', boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)', overflow: 'hidden' }}>
            {imageUrl && <Image src={imageUrl} alt="" fill sizes="36px" style={{ objectFit: 'cover' }} unoptimized />}
          </div>
          <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {personaName || 'Name'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {expanded
            ? <IconButton variant="outline" size="md" icon={<ArrowShrinkTwoIcon size={20} />} aria-label="Collapse test chat" onClick={() => setTestChatExpanded(false)} />
            : <IconButton variant="outline" size="md" icon={<ExpandIcon size={20} />} aria-label="Expand test chat" onClick={() => setTestChatExpanded(true)} />
          }
          <IconButton variant="outline" size="md" icon={<CancelOneIcon size={20} />} aria-label="Close test chat" onClick={() => { setTestChatOpen(false); setTestChatExpanded(false) }} />
        </div>
      </div>

      {/* Connector toggles (updates connectorSlugs in context) */}
      {repoId && versionId && (
        <ConnectorTogglesPanel
          repoId={repoId}
          versionId={versionId}
          onConnectorsChange={(slugs) => updatePersonaInfo({ connectorSlugs: slugs })}
        />
      )}

      {/* Messages */}
      <div ref={chatScrollRef} className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 8px' }}>
        {chatMessages.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-600)', margin: 0 }}>
            Hi! I&apos;m your agent. Test me here while you configure.
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
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                      {msg.attachments.map((att, i) => (
                        <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 8, backgroundColor: 'rgba(59,54,50,0.07)', border: '1px solid rgba(59,54,50,0.10)', maxWidth: 200 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--neutral-500)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            {att.mime_type.startsWith('image/') ? (
                              <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>
                            ) : (
                              <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>
                            )}
                          </svg>
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, color: 'var(--neutral-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {att.file_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <MessageBubble role={msg.role} content={msg.text} maxWidth="85%" hideActions />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input */}
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
          placeholder="Test your agent..."
          textareaLabel="Test message"
          modelName={guideModelName}
          hideModelSelector
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
              onFolderToggle={(folder) => setTestChatFolders(prev =>
                prev.some(f => f.id === folder.id) ? prev.filter(f => f.id !== folder.id) : [...prev, folder]
              )}
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
    </>
  )
}

// ── AI suggestions panel content ──────────────────────────────────────────────

function AiSuggestPanelContent({ expanded }: { expanded: boolean }) {
  const {
    personaInfo, setGuideExpanded, setAiSuggestOpen,
    guideMessages, guideIsStreaming, guideScrollRef, handleGuideSend,
  } = usePersonaConfigure()

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: '1 1 0', minWidth: 0, overflow: 'hidden' }}>
          <AiIdeaIcon size={20} color="var(--neutral-700)" animated />
          <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>AI suggestions</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {expanded
            ? <IconButton variant="outline" size="md" icon={<ArrowShrinkTwoIcon size={20} />} aria-label="Collapse AI suggestions" onClick={() => setGuideExpanded(false)} />
            : <IconButton variant="outline" size="md" icon={<ExpandIcon size={20} />} aria-label="Expand AI suggestions" onClick={() => setGuideExpanded(true)} />
          }
          <IconButton variant="outline" size="md" icon={<CancelOneIcon size={20} />} aria-label="Close AI suggestions" onClick={() => { setAiSuggestOpen(false); setGuideExpanded(false) }} />
        </div>
      </div>
      <div ref={guideScrollRef} className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 8px' }}>
        {guideMessages.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            Ask me anything about improving your agent — I&apos;ll review your current draft and give you tailored advice.
          </p>
        ) : (
          guideMessages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'assistant' ? (
                <StreamingMessageBubble content={msg.text} isComplete={!msg.isStreaming} />
              ) : (
                <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: 12, backgroundColor: 'var(--neutral-100)', fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', wordBreak: 'break-word' }}>
                  {msg.text}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <div style={{ flexShrink: 0 }}>
        <ChatInput
          placeholder="Ask for guidance…"
          textareaLabel="Ask for AI guidance"
          modelName={personaInfo.guideModelName}
          hideModelSelector
          onSend={handleGuideSend}
        />
      </div>
    </>
  )
}

// ── Versions panel ────────────────────────────────────────────────────────────

function VersionsPanel() {
  const {
    personaInfo, setVersionsOpen,
    versions, versionsLoading, restoringId, handleRestoreVersion,
    pendingChangeTags, refreshVersions,
  } = usePersonaConfigure()
  const { versionId, personaName, repoId } = personaInfo
  // Read all version tags from localStorage (client-only)
  const allVersionTags = typeof window !== 'undefined' ? getAllVersionTags() : {}
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  async function handleDeleteVersion(id: string) {
    if (!repoId || deletingId) return
    setDeletingId(id)
    try {
      await deleteVersion(repoId, id)
      toast.success('Version deleted')
      refreshVersions()
    } catch (err) {
      console.error('[VersionsPanel] delete error:', err)
      toast.error('Failed to delete version')
    } finally {
      setDeletingId(null)
    }
  }

  return (
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
          <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0, whiteSpace: 'nowrap' }}>
            Versions
          </p>
        </div>
        <IconButton variant="outline" size="md" icon={<CancelOneIcon size={20} />} aria-label="Close versions" onClick={() => setVersionsOpen(false)} />
      </div>

      {/* ── Pending changes indicator ── */}
      {pendingChangeTags.length > 0 && (
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', borderRadius: 12, backgroundColor: 'var(--blue-50, #eff6ff)', border: '1px solid var(--blue-200, #bfdbfe)' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: 'var(--blue-600, #2563eb)', margin: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Unsaved changes</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {pendingChangeTags.map(tag => {
              const c = TAG_COLORS[tag] ?? DEFAULT_TAG_COLOR
              return (
                <span
                  key={tag}
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '2px 8px', borderRadius: 6,
                    fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px',
                    color: c.text,
                    backgroundColor: c.bg,
                    boxShadow: c.shadow,
                  }}
                >
                  {tag}
                </span>
              )
            })}
          </div>
        </div>
      )}

      <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 4 }}>
        {versionsLoading ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: 0 }}>Loading…</p>
        ) : versions.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: '24px 0', textAlign: 'center' }}>
            No versions yet. Use &ldquo;Save version&rdquo; to create one.
          </p>
        ) : versions.map((v, i) => {
          const isCurrent = v.id === versionId
          const vNum      = versions.length - i
          const vLabel    = `v${String(vNum).padStart(3, '0')}`
          const handle    = v.handler ? `@${v.handler}\u00b7${vLabel}` : vLabel
          const dateStr   = formatVersionDate(v.created_at)
          const initials  = nameInitials(v.name || personaName)
          const changeTags = allVersionTags[v.id] ?? []
          return (
            <div
              key={v.id}
              style={{
                display: 'flex', flexDirection: 'column', gap: 9, padding: 12, borderRadius: 16, flexShrink: 0,
                backgroundColor: isCurrent ? 'var(--neutral-white)' : 'var(--neutral-50)',
                border:          isCurrent ? 'none' : '1px dashed var(--neutral-300)',
                boxShadow:       isCurrent ? '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)' : 'none',
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%' }}>
                <div style={{ width: 37, height: 37, borderRadius: 8, flexShrink: 0, backgroundColor: 'var(--neutral-100)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--neutral-600)', lineHeight: 1 }}>{initials}</span>
                </div>
                <div style={{ flex: '1 0 0', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', whiteSpace: 'nowrap', width: '100%', gap: 8 }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '55%' }}>
                      {v.name || personaName}
                    </p>
                    <p style={{ fontFamily: 'monospace', fontWeight: 400, fontSize: 13, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0, flexShrink: 0 }}>
                      {dateStr}
                    </p>
                  </div>
                  <p style={{ fontFamily: 'monospace', fontWeight: 400, fontSize: 13, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {handle}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', gap: 8 }}>
                {/* Change tags */}
                {changeTags.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 0', minWidth: 0 }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Changes</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {changeTags.map(tag => {
                        const c = TAG_COLORS[tag] ?? DEFAULT_TAG_COLOR
                        return (
                          <span
                            key={tag}
                            style={{
                              display: 'inline-flex', alignItems: 'center',
                              padding: '2px 7px', borderRadius: 6,
                              fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px',
                              color: c.text,
                              backgroundColor: c.bg,
                              boxShadow: c.shadow,
                            }}
                          >
                            {tag}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ) : <div style={{ flex: '1 1 0' }} />}
                {isCurrent ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px 6px', borderRadius: 8, flexShrink: 0, cursor: 'default', background: 'linear-gradient(180deg, #524b47 0%, #26211e 100%)', boxShadow: '0px 0px 0px 1px black, 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4)', position: 'relative' }}>
                    <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', boxShadow: 'inset 0px 1px 0.364px 0px rgba(247,242,237,0.3), inset 0px -2.182px 0.364px 0px #120c08, inset 0px -2.545px 4px -2.182px rgba(247,242,237,0.5)' }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#f7f2ed', whiteSpace: 'nowrap', textShadow: '0px -0.727px 0.364px rgba(0,0,0,0.25), 0px 0.364px 0.364px rgba(255,255,255,0.25)' }}>Current</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      onClick={() => handleDeleteVersion(v.id)}
                      disabled={!!deletingId || !!restoringId}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '5px 8px', borderRadius: 8, border: 'none', flexShrink: 0, cursor: (deletingId || restoringId) ? 'not-allowed' : 'pointer', backgroundColor: 'transparent', boxShadow: '0px 0px 0px 1px rgba(220,38,38,0.4)', opacity: (deletingId || restoringId) ? 0.5 : 1, transition: 'opacity 150ms' }}
                    >
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--red-600, #dc2626)', whiteSpace: 'nowrap' }}>
                        {deletingId === v.id ? 'Deleting…' : 'Delete'}
                      </span>
                    </button>
                    <button
                      onClick={() => handleRestoreVersion(v.id)}
                      disabled={!!restoringId || !!deletingId}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '5px 8px', borderRadius: 8, border: 'none', flexShrink: 0, cursor: (restoringId || deletingId) ? 'not-allowed' : 'pointer', backgroundColor: 'transparent', boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)', opacity: (restoringId || deletingId) ? 0.5 : 1, transition: 'opacity 150ms' }}
                    >
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', whiteSpace: 'nowrap' }}>
                        {restoringId === v.id ? 'Restoring…' : 'Restore'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </m.div>
  )
}

// ── Expanded overlays ─────────────────────────────────────────────────────────

function TestChatExpandedOverlay() {
  const { setTestChatExpanded } = usePersonaConfigure()
  return (
    <m.div
      key="test-chat-expanded"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
      style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) setTestChatExpanded(false) }}
    >
      <m.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.7, delay: 0.04 }}
        style={{ width: 'min(780px, 90vw)', height: 'min(680px, 85vh)', display: 'flex', flexDirection: 'column', gap: 16, backgroundColor: 'var(--neutral-white)', border: '1px solid var(--neutral-200)', borderRadius: 20, padding: 16, overflow: 'hidden', boxShadow: '0px 24px 48px rgba(0,0,0,0.18), 0px 0px 0px 1px rgba(59,54,50,0.08)' }}
      >
        <TestChatPanelContent expanded />
      </m.div>
    </m.div>
  )
}

function AiSuggestExpandedOverlay() {
  const { setGuideExpanded } = usePersonaConfigure()
  return (
    <m.div
      key="ai-suggest-expanded"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
      style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) setGuideExpanded(false) }}
    >
      <m.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.7, delay: 0.04 }}
        style={{ width: 'min(780px, 90vw)', height: 'min(680px, 85vh)', display: 'flex', flexDirection: 'column', gap: 16, backgroundColor: 'var(--neutral-white)', border: '1px solid var(--neutral-200)', borderRadius: 20, padding: 16, overflow: 'hidden', boxShadow: '0px 24px 48px rgba(0,0,0,0.18), 0px 0px 0px 1px rgba(59,54,50,0.08)' }}
      >
        <AiSuggestPanelContent expanded />
      </m.div>
    </m.div>
  )
}

// ── Shell (renders panels + FloatingMenu overlay) ─────────────────────────────

function PersonaConfigureShell({ children }: { children: React.ReactNode }) {
  const {
    testChatOpen, testChatExpanded,
    aiSuggestOpen, guideExpanded,
    versionsOpen,
  } = usePersonaConfigure()

  return (
    <div
      style={{
        display: 'flex', gap: 7, alignItems: 'stretch',
        width: '100%', height: '100%', position: 'relative',
      }}
    >
      {/* Left configure panel (page content) with FloatingMenu overlay */}
      <div style={{ flex: '1 0 0', minWidth: 0, position: 'relative' }}>
        {children}
        <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
          <FloatingMenu />
        </div>
      </div>

      {/* ── Test chat panel (collapsed) ────────────────────────────────────── */}
      <AnimatePresence>
        {testChatOpen && !testChatExpanded && (
          <m.div
            key="test-chat"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 448, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 32, mass: 0.9 }}
            style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', backgroundColor: 'var(--neutral-white)', border: '1px solid var(--neutral-200)', borderRadius: 16, padding: 12, overflow: 'hidden' }}
          >
            <TestChatPanelContent expanded={false} />
          </m.div>
        )}
      </AnimatePresence>

      {/* ── Test chat expanded overlay ──────────────────────────────────────── */}
      <AnimatePresence>
        {testChatOpen && testChatExpanded && <TestChatExpandedOverlay />}
      </AnimatePresence>

      {/* ── AI suggestions panel (collapsed) ───────────────────────────────── */}
      <AnimatePresence>
        {aiSuggestOpen && !guideExpanded && (
          <m.div
            key="ai-suggest-panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 400, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 32, mass: 0.9 }}
            style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', backgroundColor: 'var(--neutral-white)', border: '1px solid var(--neutral-200)', borderRadius: 16, padding: 12, overflow: 'hidden' }}
          >
            <AiSuggestPanelContent expanded={false} />
          </m.div>
        )}
      </AnimatePresence>

      {/* ── AI suggestions expanded overlay ────────────────────────────────── */}
      <AnimatePresence>
        {aiSuggestOpen && guideExpanded && <AiSuggestExpandedOverlay />}
      </AnimatePresence>

      {/* ── Versions panel ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {versionsOpen && <VersionsPanel />}
      </AnimatePresence>
    </div>
  )
}

// ── Layout export ─────────────────────────────────────────────────────────────

export default function PersonaConfigureLayout({ children }: { children: React.ReactNode }) {
  return (
    <PersonaConfigureProvider>
      <Suspense>
        <PersonaConfigureShell>{children}</PersonaConfigureShell>
      </Suspense>
    </PersonaConfigureProvider>
  )
}
