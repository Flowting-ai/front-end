'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { copyChat } from '@/lib/api/chat'
import { createChatShare, listChatShares, deleteChatShare, type ChatShare } from '@/lib/api/chat-shares'
import { useOrg } from '@/context/org-context'
import { useAuth } from '@/context/auth-context'

// ── Top-right chat overlay: Share button + modal for chat owners, ──────────
// "Create a copy" button for viewers of a chat shared/published to them. ────
// One card, two tabs: Share (multiselect workspace member list) and Active
// shares (revoke list).
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
  /** True when this chat was shared/published to the current user (not owned by them),
   *  OR when it's archived — an owned-but-archived chat is folded into the same
   *  read-only treatment (see the `readOnly` computation in chat/page.tsx). */
  readOnly:  boolean
  onCopied:  (copy: { chatId: string; chatTitle: string }) => void
  /** Opens the share modal as soon as `chatId`/`canManage` are ready — e.g. a
   *  `?share=1` deep link from the sidebar's "Share" menu item. Fires once per
   *  value change, not on every render (see the effect below), so closing the
   *  modal doesn't cause it to reopen on an unrelated re-render. */
  autoOpen?: boolean
}

type ChatShareTab = 'share' | 'manage'

/** State and actions for ChatShareOverlay (moved out of the view unchanged). */
export function useChatShare({ chatId, canManage, onCopied, autoOpen }: Omit<ChatShareOverlayProps, 'readOnly'>) {
  const { orgId, members: orgMembers } = useOrg()
  const { user } = useAuth()

  const [chatShareOpen,       setChatShareOpen]       = useState(false)
  const [activeTab,           setActiveTab]           = useState<ChatShareTab>('share')
  const [existingShares,      setExistingShares]      = useState<ChatShare[]>([])
  const [sharesLoading,       setSharesLoading]       = useState(false)
  const [revokingShareId,     setRevokingShareId]     = useState<string | null>(null)
  const [selectedIds,         setSelectedIds]         = useState<Set<string>>(new Set())
  const [creatingShare,       setCreatingShare]       = useState(false)
  const [copyingChat,         setCopyingChat]         = useState(false)

  function handleOpenChatShare() {
    setExistingShares([])
    setSelectedIds(new Set())
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

  function toggleSelected(userId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  // Fires one createChatShare per selected person — there's no batch-create
  // endpoint. Partial failures keep only the failed ids selected (so Share
  // can just be pressed again for those), and the toast reflects exactly
  // what happened rather than a blanket success/failure.
  async function handleCreateShare() {
    if (!chatId || selectedIds.size === 0) return
    setCreatingShare(true)
    const ids = Array.from(selectedIds)
    const settled = await Promise.allSettled(ids.map(id => createChatShare({ chatId, userId: id })))
    const created: ChatShare[] = []
    const failedIds = new Set<string>()
    settled.forEach((result, i) => {
      if (result.status === 'fulfilled') created.push(result.value)
      else failedIds.add(ids[i]!)
    })
    if (created.length > 0) setExistingShares(prev => [...prev, ...created])
    setSelectedIds(failedIds)
    if (failedIds.size === 0) {
      toast.success(created.length === 1 ? 'Chat shared' : `Chat shared with ${created.length} people`)
    } else if (created.length > 0) {
      toast.error(`Shared with ${created.length}, failed for ${failedIds.size}`)
    } else {
      toast.error('Failed to share chat')
    }
    setCreatingShare(false)
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

  // Eligible for a new share: everyone in the org except me and anyone who
  // already has an active share of this chat (they're already covered in
  // the Active shares tab — offering them again here would just 400).
  const alreadySharedIds = new Set(existingShares.map(s => s.targetUserId))
  const shareableMembers = orgMembers.filter(
    member => member.email.toLowerCase() !== user?.email?.toLowerCase() && !alreadySharedIds.has(member.id),
  )

  const memberRowStyle: React.CSSProperties = {
    display:      'flex',
    alignItems:   'center',
    gap:          10,
    width:        '100%',
    padding:      '8px 10px',
    borderRadius: 10,
    boxSizing:    'border-box',
  }

  return { orgId, orgMembers, user, chatShareOpen, setChatShareOpen, activeTab, setActiveTab, existingShares, setExistingShares, sharesLoading, setSharesLoading, revokingShareId, setRevokingShareId, selectedIds, setSelectedIds, creatingShare, setCreatingShare, copyingChat, setCopyingChat, handleOpenChatShare, toggleSelected, handleCreateShare, handleRevokeShare, handleCopyReadableChat, alreadySharedIds, shareableMembers, memberRowStyle }
}
