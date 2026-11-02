"use client";

import { useState } from "react";
import { useGuardedRouter } from "@/context/nav-guard-context";
import { DeleteTwoIcon, FolderLibraryIcon, FolderOneIcon, PenOneIcon, PinIcon, ShareOneIcon } from "@strange-huge/icons";
import { FlatSidebarRow } from "@/components/ui";
import { Dropdown } from "@/components/Dropdown";
import { Divider } from "@/components/Divider";
import { useChatHistoryContext } from "@/context/chat-history-context";
import { useProjects } from "@/context/projects-context";
import { MoveToProjectModal } from "@/components/Projects/lazy-modals";
import { addChatToProject } from "@/lib/api/projects";
import { openDeleteChatDialog } from "../AppDialogs";
import { Badge } from "@/components/Badge";
import { toast } from "sonner";
import type { Chat } from "@/types/chat";
import { DontSaveChatItem } from "@/components/Library/chat/DontSaveChatItem";

// ── Flat sidebar (Souvenir V1.5) — new render layer, same data/hooks ──────────
// Everything below renders onto the new FlatSidebar primitives instead of the
// old Sidebar/SidebarMenuItem/SidebarProjectsSection. It deliberately reuses the
// exact same hooks, constants (PROJECT_LIMIT, CHAT_LIMIT...), and business logic
// as the section components above — only the container components differ, per
// docs/features/sidebar-current-state-audit.md's migration checklist. The
// components above this line are UNTOUCHED and keep serving Admin/
// team-settings pages via the old <Sidebar>.

// -- FlatChatHistoryItem — rename/star/delete dropdown, onto FlatSidebarRow ----
// Deliberately scoped down vs. ChatHistoryItem: "Move to project" is deferred
// for this first pass (not in the locked v1.5 destinations/projects/recents
// scope) — flagged here rather than silently dropped.

interface FlatChatHistoryItemProps {
  chat: Chat
  isActive: boolean
  onSelect: (id: string) => void
  onRename: (chatId: string, title: string) => Promise<void>
  onDelete: (chatId: string) => Promise<void>
  onStar: (chatId: string) => Promise<void>
  onArchive: (chatId: string) => Promise<void>
}

export function FlatChatHistoryItem({ chat, isActive, onSelect, onRename, onDelete, onStar, onArchive }: FlatChatHistoryItemProps) {
  const { push } = useGuardedRouter()
  const { projects, addChat } = useProjects()
  const { removeLocal } = useChatHistoryContext()
  const isReadOnly = chat.can_edit === false && chat.visibility === 'team'
  const [isEditing, setIsEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [isMoving,      setIsMoving]      = useState(false)
  const [isStarring,    setIsStarring]    = useState(false)
  const [isArchiving,   setIsArchiving]   = useState(false)

  const handleCommit = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== chat.title) void onRename(chat.id, trimmed)
    setIsEditing(false)
  }
  const handleDelete = () => {
    setMenuOpen(false)
    openDeleteChatDialog({ chatId: chat.id, chatTitle: chat.title, onConfirm: () => onDelete(chat.id) })
  }
  const handleStar = async () => {
    setIsStarring(true)
    try { await onStar(chat.id) } finally { setIsStarring(false) }
  }
  const handleArchive = async () => {
    setIsArchiving(true)
    try { await onArchive(chat.id) } finally { setIsArchiving(false) }
  }
  // Same flow as the old ChatHistoryItem.tsx's "Move to project".
  const handleMoveToProject = async (projectId: string) => {
    setIsMoving(true)
    try {
      await addChatToProject(projectId, chat.id)
      addChat(projectId, chat.id, chat.title, { skipLink: true })
      removeLocal(chat.id)
      const project = projects.find((p) => p.id === projectId)
      toast.success(`Moved to "${project?.name ?? "project"}"`)
      setMoveModalOpen(false)
    } catch {
      toast.error("Failed to move chat — please try again.")
    } finally {
      setIsMoving(false)
    }
  }

  return (
    <>
    {/* display:flex blockifies Dropdown.Float's inline-flex trigger wrapper. Left
        inline it generates a line box (--line-height-body, 22px) under the 32px
        row — the row's own height plus a phantom second line. */}
    <div style={{ position: "relative", width: "100%", display: "flex", flexDirection: "column", opacity: isArchiving ? 0.5 : 1, transition: "opacity 150ms", pointerEvents: isArchiving ? "none" : undefined }}>
      <FlatSidebarRow
        variant={isEditing ? "chat-item-edit" : "chat-item"}
        label={chat.title}
        selected={isActive}
        href={isEditing ? undefined : `/chat?id=${chat.id}`}
        badge={!isEditing && chat.can_edit === false && chat.visibility === 'team' ? <Badge color="Red" label="Read only" /> : undefined}
        onClick={() => { if (!isEditing) onSelect(chat.id) }}
        onMoreClick={isReadOnly ? undefined : (e) => { e.stopPropagation(); setMenuOpen(true) }}
        onPinClick={(e) => { e.stopPropagation(); void handleStar() }}
        pinned={chat.starred}
        onRename={isReadOnly ? undefined : () => setIsEditing(true)}
        onCommit={handleCommit}
        onCancel={() => setIsEditing(false)}
      />
      <Dropdown.Float
        open={menuOpen}
        onOpenChange={setMenuOpen}
        placement="right-start"
        // Chat rows can sit anywhere in a scrollable, arbitrary-length list —
        // a chat near the bottom of the sidebar had this menu run off the
        // bottom of the viewport with the fixed placement every other
        // Dropdown.Float uses. Flips to open upward instead when it would.
        autoFlipVertical
        trigger={<span aria-hidden style={{ position: "absolute", right: "8px", top: "50%", width: 1, height: 1, pointerEvents: "none" }} />}
      >
        <Dropdown maxHeight={false}>
          <Dropdown.Section fluid>
            <Dropdown.Item fluid icon={<ShareOneIcon color="var(--neutral-600)" />} label="Share" onClick={() => { setMenuOpen(false); push(`/chat?id=${chat.id}&share=1`) }} />
            <Dropdown.Item fluid icon={<PenOneIcon animated color="var(--neutral-600)" />} label="Rename" onClick={() => { setMenuOpen(false); setIsEditing(true) }} />
            {/* User-facing "Pin chat"/"Unpin chat" — the underlying field/API stays `starred` (see chat.starred, chatHistory.star). */}
            <Dropdown.Item fluid icon={<PinIcon animated color="var(--neutral-600)" />} label={chat.starred ? "Unpin chat" : "Pin chat"} loading={isStarring} onClick={() => { setMenuOpen(false); void handleStar() }} />
            <Dropdown.Item fluid icon={<FolderOneIcon color="var(--neutral-600)" variant="static" />} label="Move to project" onClick={() => { setMenuOpen(false); setMoveModalOpen(true) }} />
            <Dropdown.Item fluid icon={<FolderLibraryIcon color="var(--neutral-600)" />} label="Archive" loading={isArchiving} onClick={() => { setMenuOpen(false); void handleArchive() }} />
            <DontSaveChatItem chatId={chat.id} />
            <Divider decorative />
            <Dropdown.Item fluid variant="danger" icon={<DeleteTwoIcon color="var(--red-500)" />} label="Delete" onClick={handleDelete} />
          </Dropdown.Section>
        </Dropdown>
      </Dropdown.Float>
    </div>
    <MoveToProjectModal
      open={moveModalOpen}
      loading={isMoving}
      onClose={() => setMoveModalOpen(false)}
      onConfirm={handleMoveToProject}
      projects={projects.map((p) => ({ id: p.id, name: p.name, description: p.description }))}
      chatCount={1}
    />
    </>
  )
}
