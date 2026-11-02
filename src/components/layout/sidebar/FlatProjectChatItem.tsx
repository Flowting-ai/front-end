"use client";

import { useState } from "react";
import { DeleteTwoIcon, FolderOneIcon, PenOneIcon } from "@strange-huge/icons";
import { FlatSidebarRow } from "@/components/ui";
import { Dropdown } from "@/components/Dropdown";
import { Divider } from "@/components/Divider";
import { openDeleteChatDialog } from "../AppDialogs";
import type { ProjectChat } from "@/context/projects-context";
import { toast } from "sonner";

// -- FlatProjectChatItem — onto FlatSidebarProjectGroup's nested children -----

interface FlatProjectChatItemProps {
  chat: ProjectChat
  isActive: boolean
  href?: string
  onSelect: () => void
  onRename: (chatId: string, title: string) => Promise<void>
  onDelete: (chatId: string) => Promise<void>
  onRemoveFromProject: (chatId: string) => Promise<void>
}

export function FlatProjectChatItem({ chat, isActive, href, onSelect, onRename, onDelete, onRemoveFromProject }: FlatProjectChatItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleCommit = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== chat.title) void onRename(chat.id, trimmed)
    setIsEditing(false)
  }
  const handleDelete = () => {
    setMenuOpen(false)
    openDeleteChatDialog({
      chatId: chat.id,
      chatTitle: chat.title,
      // Awaiting the real delete (not just firing it) is what makes the
      // dialog's Delete button show a loading state for the actual duration
      // of the request, instead of resolving instantly. The dialog itself
      // toasts "Chat deleted" with Undo, so no second toast here.
      onConfirm: async () => {
        try {
          await onDelete(chat.id)
        } catch {
          toast.error("Failed to delete chat")
        }
      },
    })
  }

  return (
    // display:flex for the same reason as FlatChatHistoryItem — see the note there.
    <div style={{ position: "relative", width: "100%", display: "flex", flexDirection: "column" }}>
      <FlatSidebarRow
        variant={isEditing ? "chat-item-edit" : "chat-item"}
        label={chat.title}
        selected={isActive}
        href={isEditing ? undefined : href}
        onClick={() => { if (!isEditing) onSelect() }}
        onMoreClick={(e) => { e.stopPropagation(); setMenuOpen(true) }}
        onRename={() => setIsEditing(true)}
        onCommit={handleCommit}
        onCancel={() => setIsEditing(false)}
      />
      <Dropdown.Float
        open={menuOpen}
        onOpenChange={setMenuOpen}
        placement="right-start"
        // Same reasoning as FlatChatHistoryItem's identical dropdown above —
        // these chat rows live inside an expandable, arbitrary-length project
        // group and can end up anywhere in the sidebar.
        autoFlipVertical
        trigger={<span aria-hidden style={{ position: "absolute", right: "8px", top: "50%", width: 1, height: 1, pointerEvents: "none" }} />}
      >
        <Dropdown maxHeight={false}>
          <Dropdown.Section fluid>
            <Dropdown.Item fluid icon={<PenOneIcon animated color="var(--neutral-600)" />} label="Rename" onClick={() => { setMenuOpen(false); setIsEditing(true) }} />
            {/* Keeps the chat; the context toasts the result. */}
            <Dropdown.Item fluid icon={<FolderOneIcon color="var(--neutral-600)" variant="static" />} label="Remove from project" onClick={() => { setMenuOpen(false); onRemoveFromProject(chat.id).catch(() => {}) }} />
            <Divider decorative />
            <Dropdown.Item fluid variant="danger" icon={<DeleteTwoIcon color="var(--red-500)" />} label="Delete" onClick={handleDelete} />
          </Dropdown.Section>
        </Dropdown>
      </Dropdown.Float>
    </div>
  )
}
