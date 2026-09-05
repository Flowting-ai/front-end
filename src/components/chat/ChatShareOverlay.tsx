'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { toast } from 'sonner'
import { ShareOneIcon, CancelOneIcon, ArrowDownOneIcon } from '@strange-huge/icons'
import { Dropdown, DropdownFloat } from '@/components/Dropdown'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/Tabs'
import { Tooltip } from '@/components/Tooltip'
import { copyChat } from '@/lib/api/chat'
import { createChatShare, listChatShares, deleteChatShare, type ChatShare } from '@/lib/api/chat-shares'
import { useOrg } from '@/context/org-context'
import { useAuth } from '@/context/auth-context'

// ── Top-right chat overlay: Share button + modal for chat owners, ──────────
// "Create a copy" button for viewers of a chat shared/published to them. ────
// One card, two tabs: Share (person picker) and Active shares (revoke list).
// Standalone chat sharing is person-to-person only — the backend dropped
// project/team targets and the editable/read-only mode entirely (migration
// c8d1e4f7a2b5): in-project chats inherit the whole project as their
// audience via a separate mechanism (POST /chats/{id}/share), and every
// standalone share is now uniformly "view read-only, then optionally fork
// your own copy" — there's nothing left to toggle for either dimension.

interface ChatShareOverlayProps {
  chatId:    string | undefined
  /** True when the current user owns this chat and may manage its shares. */
  canManage: boolean
  /** True when this chat was shared/published to the current user (not owned by them). */
  readOnly:  boolean
  onCopied:  (copy: { chatId: string; chatTitle: string }) => void
  /** Opens the share modal as soon as `chatId`/`canManage` are ready — e.g. a
   *  `?share=1` deep link from the sidebar's "Share" menu item. Fires once per
   *  value change, not on every render (see the effect below), so closing the
   *  modal doesn't cause it to reopen on an unrelated re-render. */
  autoOpen?: boolean
}

type ChatShareTab = 'share' | 'manage'

// Modal card is `width: 460px` capped at `calc(100vw - 32px)`, with 20px of
// horizontal padding inside — so a dropdown panel that's meant to span the
// card's content width needs the same responsive cap, not a bare "420px"
// that can overflow a narrow viewport once the card itself has shrunk.
const DROPDOWN_PANEL_WIDTH = 'min(420px, calc(100vw - 72px))'

// Modal height is fixed (matching the one other tabbed dialog in this
// codebase, SuperLinkDrawer) rather than left to size to content — the
// Share tab (a couple of rows) and Active shares tab (an empty state or a
// list) have different natural heights, so letting the card free-size would
// make it visibly resize on every tab switch. 480px comfortably fits the
// Share tab's content with a little breathing room, and the Active shares
// tab scrolls internally past that via its own `overflowY: auto`.
const MODAL_HEIGHT = 480

export function ChatShareOverlay({ chatId, canManage, readOnly, onCopied, autoOpen }: ChatShareOverlayProps) {
  const { orgId, members: orgMembers } = useOrg()
  const { user } = useAuth()

  const [chatShareOpen,       setChatShareOpen]       = useState(false)
  const [activeTab,           setActiveTab]           = useState<ChatShareTab>('share')
  const [existingShares,      setExistingShares]      = useState<ChatShare[]>([])
  const [sharesLoading,       setSharesLoading]       = useState(false)
  const [revokingShareId,     setRevokingShareId]     = useState<string | null>(null)
  const [shareTargetId,       setShareTargetId]       = useState('')
  const [shareTargetDropOpen, setShareTargetDropOpen] = useState(false)
  const [creatingShare,       setCreatingShare]       = useState(false)
  const [copyingChat,         setCopyingChat]         = useState(false)

  function handleOpenChatShare() {
    setExistingShares([])
    setShareTargetId('')
    setActiveTab('share')
    setChatShareOpen(true)
    if (chatId) {
      setSharesLoading(true)
      listChatShares(chatId)
        .then(setExistingShares)
        .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load active shares'))
        .finally(() => setSharesLoading(false))
    }
  }

  async function handleCreateShare() {
    if (!chatId || !shareTargetId) return
    setCreatingShare(true)
    try {
      const share = await createChatShare({ chatId, userId: shareTargetId })
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

  // Deep-link open — fires once when autoOpen/chatId/canManage settle true
  // (e.g. canManage flips true once the chat record finishes loading), not on
  // every render, so dismissing the modal doesn't reopen it on an unrelated
  // re-render of the parent. This effect's whole purpose is opening the
  // modal in response to a one-time deep-link signal, not synchronizing
  // render-derived state — hence the two rule exceptions below.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoOpen && chatId && canManage) handleOpenChatShare()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, chatId, canManage])

  const dropdownTriggerStyle: React.CSSProperties = {
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
  }

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
            <m.div
              key="share-chat-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Share chat"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{    opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32, mass: 0.8 }}
              style={{
                background:    'var(--neutral-white)',
                borderRadius:  '20px',
                boxShadow:     '0px 8px 32px 0px rgba(26,23,20,0.24), 0px 0px 0px 1px rgba(59,54,50,0.12)',
                width:         '460px',
                maxWidth:      'calc(100vw - 32px)',
                height:        MODAL_HEIGHT,
                maxHeight:     'calc(100vh - 64px)',
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
                <IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close" onClick={() => setChatShareOpen(false)} />
              </div>

              <div style={{ height: '1px', background: 'var(--neutral-100)', flexShrink: 0 }} />

              <Tabs
                value={activeTab}
                onValueChange={(v: string) => setActiveTab(v as ChatShareTab)}
                style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0 }}
              >
                <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
                  <TabsList size="small">
                    <TabsTrigger value="share">Share</TabsTrigger>
                    <TabsTrigger value="manage">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        Active shares
                        {existingShares.length > 0 && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px',
                            backgroundColor: 'var(--blue-100)', fontFamily: 'var(--font-body)',
                            fontWeight: 600, fontSize: 9, color: 'var(--blue-700)', flexShrink: 0,
                          }}>
                            {existingShares.length}
                          </span>
                        )}
                      </span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* ── Share tab — create a new share ── */}
                <TabsContent
                  value="share"
                  className="kaya-scrollbar"
                  style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', paddingTop: '16px', paddingBottom: '20px' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 20px' }}>

                    {/* Person-to-person only — the backend dropped both the
                        project/team target and the editable/read-only mode
                        (see the file header comment). Viewing is always
                        read-only-in-place; the recipient can always fork
                        their own copy from there, so there's nothing left
                        to pick beyond who to share with. */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0 }}>
                        Share with
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '18px', color: 'var(--neutral-500)', margin: 0 }}>
                        They can view this chat and make their own copy of it.
                      </p>
                      <DropdownFloat
                        open={shareTargetDropOpen}
                        onOpenChange={setShareTargetDropOpen}
                        placement="bottom-start"
                        offset={4}
                        trigger={
                          <button type="button" style={dropdownTriggerStyle}>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', lineHeight: '22px', color: shareTargetId ? 'var(--neutral-900)' : 'var(--neutral-400)' }}>
                              {shareTargetId
                                ? (orgMembers.find(m => m.id === shareTargetId)?.name || orgMembers.find(m => m.id === shareTargetId)?.email || 'Person')
                                : 'Select person…'}
                            </span>
                            <ArrowDownOneIcon size={16} color="var(--neutral-400)" />
                          </button>
                        }
                      >
                        <Dropdown style={{ width: DROPDOWN_PANEL_WIDTH }} maxHeight={false}>
                          <Dropdown.Section fluid>
                            {orgMembers
                              .filter(member => member.email.toLowerCase() !== user?.email?.toLowerCase())
                              .map(member => (
                                <Dropdown.Item
                                  key={member.id}
                                  fluid
                                  label={member.name || member.email}
                                  selected={shareTargetId === member.id}
                                  onClick={() => { setShareTargetId(member.id); setShareTargetDropOpen(false) }}
                                />
                              ))}
                          </Dropdown.Section>
                        </Dropdown>
                      </DropdownFloat>
                    </div>
                  </div>
                </TabsContent>

                {/* ── Active shares tab — manage / revoke ── */}
                <TabsContent
                  value="manage"
                  className="kaya-scrollbar"
                  style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', paddingTop: '16px', paddingBottom: '20px' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 20px' }}>
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
                            Use the Share tab to share this chat with a person or project.
                          </p>
                        </div>
                      </div>
                    ) : (
                      existingShares.map(share => {
                        const label = share.targetUserName || share.targetUserEmail || 'Person'
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
                              {share.targetUserName && share.targetUserEmail && (
                                <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', lineHeight: '16px', color: 'var(--neutral-400)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {share.targetUserEmail}
                                </p>
                              )}
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
                </TabsContent>
              </Tabs>

              <div style={{ height: '1px', background: 'var(--neutral-100)', flexShrink: 0 }} />

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', padding: '16px 20px', flexShrink: 0 }}>
                <Button variant="ghost" onClick={() => setChatShareOpen(false)}>
                  {activeTab === 'share' ? 'Cancel' : 'Close'}
                </Button>
                {activeTab === 'share' && (
                  <Button variant="secondary" size="sm" loading={creatingShare} disabled={!shareTargetId || creatingShare} onClick={() => void handleCreateShare()}>
                    Share
                  </Button>
                )}
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}
