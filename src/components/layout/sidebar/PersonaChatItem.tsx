"use client";

import React, { useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { SidebarMenuItem } from "@/components/ui";
import { renamePersonaChat, deletePersonaChat } from "@/lib/api/personas";
import type { PersonaChat } from "@/lib/api/personas";
import { openDeleteChatDialog } from "../AppDialogs";
import { existingAgentChatHref } from "@/lib/agent-chat-handoff";
import { toast } from "sonner";

// -- PersonaChatItem — rename / delete dropdown for individual persona chats ---

const personaChatMenuItemStyle: React.CSSProperties = {
  display:     "flex",
  alignItems:  "center",
  gap:         "8px",
  padding:     "7px 10px",
  borderRadius:"8px",
  cursor:      "pointer",
  fontFamily:  "var(--font-body)",
  fontWeight:  "var(--font-weight-medium)",
  fontSize:    "var(--font-size-body)",
  lineHeight:  "var(--line-height-body)",
  color:       "var(--neutral-700)",
  outline:     "none",
  userSelect:  "none",
};

const personaChatMenuItemDestructiveStyle: React.CSSProperties = {
  ...personaChatMenuItemStyle,
  color: "var(--red-500)",
};

interface PersonaChatItemProps {
  personaId: string
  chat:      PersonaChat
  isActive:  boolean
  onSelect:  () => void
  onRename:  (chatId: string, title: string) => void
  onDelete:  (chatId: string) => void
}

export function PersonaChatItem({
  personaId,
  chat,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: PersonaChatItemProps) {
  const [isEditing,  setIsEditing]  = useState(false)
  const [menuOpen,   setMenuOpen]   = useState(false)
  const triggerRef                  = useRef<HTMLButtonElement>(null)
  const pendingRenameRef            = useRef(false)

  const handleCommit = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== chat.title) {
      void renamePersonaChat(personaId, chat.id, trimmed)
        .then(() => { onRename(chat.id, trimmed); toast.success("Chat renamed") })
        .catch(() => toast.error("Failed to rename chat"))
    }
    setIsEditing(false)
  }

  const handleMoreClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation()
    setMenuOpen(true)
  }

  const handleDelete = () => {
    openDeleteChatDialog({
      chatId:    chat.id,
      chatTitle: chat.title,
      onConfirm: async () => {
        await deletePersonaChat(personaId, chat.id)
          .then(() => { onDelete(chat.id); toast.success("Chat deleted") })
          .catch(() => { toast.error("Failed to delete chat") })
      },
    })
  }

  return (
    <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
      <div style={{ position: "relative", width: "100%" }}>
        <SidebarMenuItem
          fluid
          variant={isEditing ? "chat-item-edit" : "chat-item"}
          label={chat.title}
          selected={isActive}
          href={isEditing ? undefined : existingAgentChatHref(chat.id)}
          onClick={() => { if (!isEditing) onSelect() }}
          onMoreClick={handleMoreClick}
          onRename={() => setIsEditing(true)}
          onCommit={handleCommit}
          onCancel={() => setIsEditing(false)}
        />
        <DropdownMenu.Trigger
          ref={triggerRef}
          style={{
            position:      "absolute",
            right:         "8px",
            top:           "50%",
            width:         1,
            height:        1,
            opacity:       0,
            pointerEvents: "none",
            border:        "none",
            background:    "none",
            padding:       0,
          }}
        />
      </div>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="end"
          sideOffset={4}
          onCloseAutoFocus={(e) => {
            if (pendingRenameRef.current) {
              e.preventDefault()
              pendingRenameRef.current = false
            }
          }}
          style={{
            backgroundColor: "var(--popover-bg)",
            borderRadius:    "12px",
            padding:         "4px",
            boxShadow:       "0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
            zIndex:          5,
            minWidth:        "168px",
            outline:         "none",
          }}
        >
          <DropdownMenu.Item
            style={personaChatMenuItemStyle}
            onSelect={() => { pendingRenameRef.current = true; setIsEditing(true) }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--neutral-50)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
          >
            Rename
          </DropdownMenu.Item>

          <DropdownMenu.Separator
            style={{ height: "1px", backgroundColor: "var(--neutral-100)", margin: "4px 0" }}
          />

          <DropdownMenu.Item
            style={personaChatMenuItemDestructiveStyle}
            onSelect={handleDelete}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--red-50, #fff5f5)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
          >
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
