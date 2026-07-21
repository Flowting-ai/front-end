'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { toast } from 'sonner'
import { ShareOneIcon, CancelOneIcon, ArrowDownOneIcon } from '@strange-huge/icons'
import { Dropdown, DropdownFloat } from '@/components/Dropdown'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { ModelFeaturedCard } from '@/components/ModelFeaturedCard'
import { Tooltip } from '@/components/Tooltip'
import { copyChat } from '@/lib/api/chat'
import { createChatShare, listChatShares, deleteChatShare, type ChatShare, type ChatShareMode } from '@/lib/api/chat-shares'
import { useOrg } from '@/context/org-context'
import { useAuth } from '@/context/auth-context'
import { useProjects } from '@/context/projects-context'

// ── Top-right chat overlay: Share button + modal for chat owners, ──────────
// "Create a copy" button for viewers of a chat shared/published to them. ────

interface ChatShareOverlayProps {
  chatId:    string | undefined
  /** True when the current user owns this chat and may manage its shares. */
  canManage: boolean
  /** True when this chat was shared/published to the current user (not owned by them). */
  readOnly:  boolean
  onCopied:  (copy: { chatId: string; chatTitle: string }) => void
}

export function ChatShareOverlay({ chatId, canManage, readOnly, onCopied }: ChatShareOverlayProps) {
  const { orgId, teams: orgTeams, members: orgMembers } = useOrg()
  const { user } = useAuth()
  const { projects } = useProjects()

  const [chatShareOpen,       setChatShareOpen]       = useState(false)
  const [chatShareVisibility, setChatShareVisibility] = useState<'private' | 'team'>('private')
  const [chatShareTeamId,     setChatShareTeamId]     = useState('')
  const [sharesListOpen,      setSharesListOpen]      = useState(true)
  const [shareTeamDropOpen,   setShareTeamDropOpen]   = useState(false)
  const [existingShares,      setExistingShares]      = useState<ChatShare[]>([])
  const [sharesLoading,       setSharesLoading]       = useState(false)
  const [revokingShareId,     setRevokingShareId]     = useState<string | null>(null)
  const [shareTargetType,     setShareTargetType]     = useState<'user' | 'project'>('user')
  const [shareTargetId,       setShareTargetId]       = useState('')
  const [shareMode,           setShareMode]           = useState<ChatShareMode>('read_only')
  const [shareModeDropOpen,   setShareModeDropOpen]   = useState(false)
  const [shareTargetDropOpen, setShareTargetDropOpen] = useState(false)
  const [creatingShare,       setCreatingShare]       = useState(false)
  const [copyingChat,         setCopyingChat]         = useState(false)

  const editableTeams    = orgTeams.filter(team => !team.archived && team.canEdit)
  const shareableProjects = projects.filter(project => project.canEdit)

  function handleOpenChatShare() {
    setChatShareVisibility('private')
    setChatShareTeamId('')
    setExistingShares([])
    setShareTargetId('')
    setShareTargetType(orgId ? 'user' : 'project')
    setSharesListOpen(true)
    setChatShareOpen(true)
    if (chatId) {
      setSharesLoading(true)
      listChatShares(chatId)
        .then(setExistingShares)
        .catch(console.error)
        .finally(() => setSharesLoading(false))
    }
  }

  async function handleCreateShare() {
    if (!chatId || !shareTargetId) return
    setCreatingShare(true)
    try {
      const share = await createChatShare({
        chatId,
        mode:      shareMode,
        userId:    shareTargetType === 'user' ? shareTargetId : undefined,
        projectId: shareTargetType === 'project' ? shareTargetId : undefined,
      })
      setExistingShares(prev => [...prev, share])
      setShareTargetId('')
      toast.success('Chat shared')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to share chat')
    } finally {
      setCreatingShare(false)
    }
  }

  async function handleRevokeShare(shareId: string) {
    setRevokingShareId(shareId)
    try {
      await deleteChatShare(shareId)
      setExistingShares(prev => prev.filter(s => s.id !== shareId))
      toast.success('Share revoked')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke share')
    } finally {
      setRevokingShareId(null)
    }
  }

  async function handleCopyReadableChat() {
    if (!chatId || copyingChat) return
    setCopyingChat(true)
    try {
      const copy = await copyChat(chatId)
      onCopied(copy)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to copy chat')
    } finally {
      setCopyingChat(false)
    }
  }

  useEffect(() => {
    if (!chatShareOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setChatShareOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [chatShareOpen])

  return (
    <>
      {chatId && canManage && !chatShareOpen && !!orgId && (
        <div style={{ position: 'absolute', top: 8, right: 12, zIndex: 10 }}>
          <Tooltip content="Share" side="bottom">
            <IconButton
              variant="ghost"
              aria-label="Share chat"
              icon={<ShareOneIcon animated />}
              onClick={handleOpenChatShare}
            />
          </Tooltip>
        </div>
      )}
      {chatId && readOnly && (
        <div style={{ position: 'absolute', top: 8, right: 12, zIndex: 10 }}>
          <Button variant="secondary" size="sm" loading={copyingChat} onClick={() => void handleCopyReadableChat()}>
            Create a copy
          </Button>
        </div>
      )}

      <AnimatePresence>
        {chatShareOpen && (
          <m.div
            key="share-chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setChatShareOpen(false)}
            style={{
              position:        'fixed',
              inset:           0,
              zIndex:          51,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              backgroundColor: 'rgba(26,23,20,0.4)',
              backdropFilter:  'blur(2px)',
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', maxWidth: 'calc(100vw - 32px)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <m.div
                key="share-chat-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Share chat"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1,    y: 0 }}
                exit={{    opacity: 0, scale: 0.96, y: 8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 32, mass: 0.8 }}
                style={{
                  background:    'var(--neutral-white)',
                  borderRadius:  '20px',
                  boxShadow:     '0px 8px 32px 0px rgba(26,23,20,0.24), 0px 0px 0px 1px rgba(59,54,50,0.12)',
                  width:         '460px',
                  display:       'flex',
                  flexDirection: 'column',
                  overflow:      'hidden',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px', flexShrink: 0 }}>
                  <p style={{ fontFamily: 'var(--font-title)', fontWeight: 'var(--font-weight-regular)', fontSize: '24px', lineHeight: '32px', color: '#1a1714', margin: 0 }}>
                    Share chat
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      active={sharesListOpen}
                      onClick={() => setSharesListOpen(prev => !prev)}
                    >
                      {existingShares.length > 0 ? `Shared with ${existingShares.length}` : 'View active shares'}
                    </Button>
                    <IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close" onClick={() => setChatShareOpen(false)} />
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--neutral-100)', flexShrink: 0 }} />

                {/* Body */}
                <div className="kaya-scrollbar" style={{ maxHeight: 'min(620px, calc(100vh - 180px))', overflowY: 'auto', paddingTop: '20px', paddingBottom: '20px' }}>
                  {/* Horizontal padding lives on this inner wrapper, not the
                      scrolling element above — keeps the scrollbar flush with
                      the overlay's edge. */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 20px' }}>

                  {/* Visibility: Private / Team — side-by-side muse cards */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <ModelFeaturedCard
                      selected={chatShareVisibility === 'private'}
                      title="Private"
                      description="Only you can see this chat."
                      onClick={() => { setChatShareVisibility('private'); setShareTargetType('user'); setShareTargetId('') }}
                      style={{ flex: 1 }}
                    />
                    <ModelFeaturedCard
                      selected={chatShareVisibility === 'team'}
                      title="Team"
                      description="Editors and admins in this team can access it."
                      onClick={orgId ? () => { setChatShareVisibility('team'); setShareTargetType('project'); setShareTargetId('') } : undefined}
                      aria-disabled={!orgId}
                      style={{ flex: 1, ...(!orgId && { opacity: 0.4, pointerEvents: 'none', cursor: 'not-allowed' }) }}
                    />
                  </div>

                  {/* Team selector */}
                  {chatShareVisibility === 'team' && (
                    <DropdownFloat
                      open={shareTeamDropOpen}
                      onOpenChange={setShareTeamDropOpen}
                      placement="bottom-start"
                      offset={4}
                      trigger={
                        <button
                          type="button"
                          style={{
                            display:         'flex',
                            alignItems:      'center',
                            justifyContent:  'space-between',
                            gap:             '8px',
                            width:           '100%',
                            padding:         '9px 12px',
                            borderRadius:    '10px',
                            border:          'none',
                            backgroundColor: 'var(--neutral-white)',
                            boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)',
                            cursor:          'pointer',
                            outline:         'none',
                          }}
                        >
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', lineHeight: '22px', color: chatShareTeamId ? 'var(--neutral-900)' : 'var(--neutral-400)' }}>
                            {chatShareTeamId
                              ? (orgTeams.find(t => t.id === chatShareTeamId)?.name ?? 'Select team…')
                              : 'Select team…'}
                          </span>
                          <ArrowDownOneIcon size={16} color="var(--neutral-400)" />
                        </button>
                      }
                    >
                      <Dropdown style={{ width: '420px', padding: '3px' }}>
                        {editableTeams.length === 0
                          ? <Dropdown.Item fluid label="No teams available" />
                          : editableTeams.map(t => (
                              <Dropdown.Item
                                key={t.id}
                                fluid
                                label={t.name}
                                selected={chatShareTeamId === t.id}
                                onClick={() => { setChatShareTeamId(t.id); setShareTargetId(''); setShareTeamDropOpen(false) }}
                              />
                            ))
                        }
                      </Dropdown>
                    </DropdownFloat>
                  )}

                  <div style={{ height: '1px', background: 'var(--neutral-100)' }} />

                  {/* Specific share */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--neutral-700)', margin: 0 }}>
                        {chatShareVisibility === 'team' ? 'Projects' : 'Person'}
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '18px', color: 'var(--neutral-500)', margin: '2px 0 0' }}>
                        {chatShareVisibility === 'team'
                          ? 'Select a project under this team to share the chat with.'
                          : 'Share this chat directly with a specific person.'}
                      </p>
                    </div>

                    {/* Access mode dropdown */}
                    <DropdownFloat
                      open={shareModeDropOpen}
                      onOpenChange={setShareModeDropOpen}
                      placement="bottom-start"
                      offset={4}
                      trigger={
                        <button
                          type="button"
                          style={{
                            display:         'flex',
                            alignItems:      'center',
                            justifyContent:  'space-between',
                            gap:             '8px',
                            width:           '100%',
                            padding:         '9px 12px',
                            borderRadius:    '10px',
                            border:          'none',
                            backgroundColor: 'var(--neutral-white)',
                            boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)',
                            cursor:          'pointer',
                            outline:         'none',
                          }}
                        >
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', lineHeight: '22px', color: 'var(--neutral-900)' }}>
                            {shareMode === 'read_only' ? 'Read only' : 'Can create a copy'}
                          </span>
                          <ArrowDownOneIcon size={16} color="var(--neutral-400)" />
                        </button>
                      }
                    >
                      <Dropdown style={{ width: '420px', padding: '3px' }}>
                        <Dropdown.Item fluid label="Read only"         selected={shareMode === 'read_only'} onClick={() => { setShareMode('read_only'); setShareModeDropOpen(false) }} />
                        <Dropdown.Item fluid label="Can create a copy" selected={shareMode === 'editable'}  onClick={() => { setShareMode('editable');  setShareModeDropOpen(false) }} />
                      </Dropdown>
                    </DropdownFloat>

                    {/* Target selector dropdown */}
                    <DropdownFloat
                      open={shareTargetDropOpen}
                      onOpenChange={setShareTargetDropOpen}
                      placement="bottom-start"
                      offset={4}
                      trigger={
                        <button
                          type="button"
                          style={{
                            display:         'flex',
                            alignItems:      'center',
                            justifyContent:  'space-between',
                            gap:             '8px',
                            width:           '100%',
                            padding:         '9px 12px',
                            borderRadius:    '10px',
                            border:          'none',
                            backgroundColor: 'var(--neutral-white)',
                            boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)',
                            cursor:          'pointer',
                            outline:         'none',
                          }}
                        >
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', lineHeight: '22px', color: shareTargetId ? 'var(--neutral-900)' : 'var(--neutral-400)' }}>
                            {shareTargetId
                              ? chatShareVisibility === 'team'
                                ? (shareableProjects.find(p => p.id === shareTargetId)?.name || 'Project')
                                : (orgMembers.find(m => m.id === shareTargetId)?.name || orgMembers.find(m => m.id === shareTargetId)?.email || 'Person')
                              : chatShareVisibility === 'team' ? 'Select project…' : 'Select person…'}
                          </span>
                          <ArrowDownOneIcon size={16} color="var(--neutral-400)" />
                        </button>
                      }
                    >
                      <Dropdown style={{ width: '420px', padding: '3px' }} maxHeight="min(248px, calc(100dvh - 120px))">
                        {chatShareVisibility === 'team'
                          ? (() => {
                              const teamProjects = shareableProjects.filter(p => p.teamId === chatShareTeamId)
                              return teamProjects.length === 0
                                ? <Dropdown.Item fluid label={chatShareTeamId ? 'No editable projects in this team' : 'Select a team first'} disabled />
                                : teamProjects.map(project => (
                                    <Dropdown.Item
                                      key={project.id}
                                      fluid
                                      label={project.name}
                                      selected={shareTargetId === project.id}
                                      onClick={() => { setShareTargetId(project.id); setShareTargetDropOpen(false) }}
                                    />
                                  ))
                            })()
                          : orgMembers
                              .filter(member => member.email.toLowerCase() !== user?.email?.toLowerCase())
                              .map(member => (
                                <Dropdown.Item
                                  key={member.id}
                                  fluid
                                  label={member.name || member.email}
                                  selected={shareTargetId === member.id}
                                  onClick={() => { setShareTargetId(member.id); setShareTargetDropOpen(false) }}
                                />
                              ))
                        }
                      </Dropdown>
                    </DropdownFloat>
                  </div>
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--neutral-100)', flexShrink: 0 }} />

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', padding: '16px 20px', flexShrink: 0 }}>
                  <Button variant="ghost" onClick={() => setChatShareOpen(false)}>Cancel</Button>
                  <Button variant="secondary" size="sm" loading={creatingShare} disabled={!shareTargetId || creatingShare} onClick={() => void handleCreateShare()}>
                    Share
                  </Button>
                </div>
              </m.div>

              {/* Shares list side panel */}
              <AnimatePresence>
                {sharesListOpen && (
                  <m.div
                    key="shares-list-panel"
                    initial={{ opacity: 0, scale: 0.96, x: 8 }}
                    animate={{ opacity: 1, scale: 1,    x: 0 }}
                    exit={{    opacity: 0, scale: 0.96, x: 8 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 32, mass: 0.8 }}
                    style={{
                      background:    'var(--neutral-white)',
                      borderRadius:  '20px',
                      boxShadow:     '0px 8px 32px 0px rgba(26,23,20,0.24), 0px 0px 0px 1px rgba(59,54,50,0.12)',
                      width:         '280px',
                      display:       'flex',
                      flexDirection: 'column',
                      overflow:      'hidden',
                    }}
                  >
                    <div style={{ padding: '16px 20px 14px', flexShrink: 0 }}>
                      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: '14px', lineHeight: '20px', color: 'var(--neutral-800)', margin: 0 }}>
                        Active shares
                      </p>
                    </div>
                    <div style={{ height: '1px', background: 'var(--neutral-100)', flexShrink: 0 }} />
                    <div className="kaya-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', maxHeight: '480px', overflowY: 'auto', flex: 1 }}>
                      {sharesLoading ? (
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--neutral-400)', margin: 0 }}>Loading…</p>
                      ) : existingShares.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '32px 8px', textAlign: 'center' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ShareOneIcon size={20} color="var(--neutral-400)" />
                          </div>
                          <div>
                            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: '13px', lineHeight: '18px', color: 'var(--neutral-700)', margin: 0 }}>
                              No active shares
                            </p>
                            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', lineHeight: '18px', color: 'var(--neutral-400)', margin: '4px 0 0' }}>
                              Use the form to share this chat with a person or project.
                            </p>
                          </div>
                        </div>
                      ) : (
                        existingShares.map(share => {
                          const label = share.targetTeamId
                            ? (orgTeams.find(t => t.id === share.targetTeamId)?.name ?? 'Team')
                            : share.targetProjectId
                              ? (projects.find(project => project.id === share.targetProjectId)?.name ?? 'Project')
                              : (share.targetUserName || share.targetUserEmail || 'Person')
                          const isRevoking = revokingShareId === share.id
                          return (
                            <div
                              key={share.id}
                              style={{
                                display:         'flex',
                                alignItems:      'center',
                                justifyContent:  'space-between',
                                padding:         '10px 12px',
                                borderRadius:    '10px',
                                backgroundColor: 'var(--neutral-50)',
                                boxShadow:       '0px 0px 0px 1px var(--neutral-100)',
                                gap:             '8px',
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: '13px', lineHeight: '18px', color: 'var(--neutral-800)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {label}
                                </p>
                                <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', lineHeight: '16px', color: 'var(--neutral-400)', margin: '2px 0 0', textTransform: 'capitalize' }}>
                                  {share.mode.replace('_', ' ')}
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                loading={isRevoking}
                                disabled={isRevoking}
                                onClick={() => void handleRevokeShare(share.id)}
                              >
                                Revoke
                              </Button>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}
