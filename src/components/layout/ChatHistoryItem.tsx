"use client";

import { useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { SidebarMenuItem } from "@/components/ui";
import type { Chat } from "@/types/chat";
import { openDeleteChatDialog } from "./AppDialogs";
import { MoveToProjectModal }    from "@/components/MoveToProjectModal";
import { useProjects }           from "@/context/projects-context";
import { useChatHistoryContext } from "@/context/chat-history-context";
import { addChatToProject }      from "@/lib/api/projects";
import { toast }                 from "sonner";
import { FolderOneIcon, PenOneIcon, StarIcon } from "@strange-huge/icons";

// ── Shared dropdown item style ────────────────────────────────────────────────

const menuItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "7px 10px",
  borderRadius: "8px",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  fontWeight: "var(--font-weight-medium)",
  fontSize: "var(--font-size-body)",
  lineHeight: "var(--line-height-body)",
  color: "var(--neutral-700)",
  outline: "none",
  userSelect: "none",
};

const menuItemDestructiveStyle: React.CSSProperties = {
  ...menuItemStyle,
  color: "var(--red-500)",
};

// ── Component ─────────────────────────────────────────────────────────────────

interface ChatHistoryItemProps {
  chat: Chat;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRename: (chatId: string, title: string) => Promise<void>;
  onDelete: (chatId: string) => Promise<void>;
  onStar: (chatId: string) => Promise<void>;
}

export function ChatHistoryItem({
  chat,
  isActive,
  onSelect,
  onRename,
  onDelete,
  onStar,
}: ChatHistoryItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Prevents Radix from stealing focus back to the trigger when rename is clicked.
  // Set to true in the Rename onSelect; cleared in onCloseAutoFocus after e.preventDefault().
  const pendingRenameRef = useRef(false);

  const { projects, addChat } = useProjects();
  const { removeLocal }       = useChatHistoryContext();

  const handleCommit = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== chat.title) {
      void onRename(chat.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleMoreClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
    setMenuOpen(true);
  };

  const handleDelete = () => {
    openDeleteChatDialog({
      chatId: chat.id,
      chatTitle: chat.title,
      onConfirm: () => onDelete(chat.id),
    });
  };

  const handleMoveToProject = async (projectId: string) => {
    setMoveModalOpen(false);
    try {
      await addChatToProject(projectId, chat.id);
      addChat(projectId, chat.id, chat.title);
      removeLocal(chat.id);
      const project = projects.find((p) => p.id === projectId);
      toast.success(`Moved to "${project?.name ?? "project"}"`);
    } catch {
      toast.error("Failed to move chat — please try again.");
    }
  };

  return (
    <>
    <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
      <div style={{ position: "relative", width: "100%" }}>
        <SidebarMenuItem
          fluid
          variant={isEditing ? "chat-item-edit" : "chat-item"}
          label={chat.title}
          selected={isActive}
          href={isEditing ? undefined : `/chat?id=${chat.id}`}
          onClick={() => {
            if (!isEditing) onSelect(chat.id);
          }}
          onMoreClick={handleMoreClick}
          onRename={() => setIsEditing(true)}
          onCommit={handleCommit}
          onCancel={() => setIsEditing(false)}
        />
        {/* Zero-size Radix trigger anchored to the right edge */}
        <DropdownMenu.Trigger
          ref={triggerRef}
          style={{
            position: "absolute",
            right: "8px",
            top: "50%",
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: "none",
            border: "none",
            background: "none",
            padding: 0,
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
              e.preventDefault();
              pendingRenameRef.current = false;
            }
          }}
          style={{
            backgroundColor: "var(--neutral-white)",
            borderRadius: "12px",
            padding: "4px",
            boxShadow:
              "0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
            zIndex: 5,
            minWidth: "168px",
            outline: "none",
          }}
        >
          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={() => {
              pendingRenameRef.current = true;
              setIsEditing(true);
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor =
                "var(--neutral-50)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor =
                "transparent")
            }
          >
            <PenOneIcon animated size={14} color="var(--neutral-600)" />
            Rename
          </DropdownMenu.Item>

          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={() => void onStar(chat.id)}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor =
                "var(--neutral-50)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor =
                "transparent")
            }
          >
            <StarIcon animated size={14} color="var(--neutral-600)" />
            {chat.starred ? "Unstar" : "Star"}
          </DropdownMenu.Item>

          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={() => setMoveModalOpen(true)}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor =
                "var(--neutral-50)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor =
                "transparent")
            }
          >
            <FolderOneIcon size={14} color="var(--neutral-600)" variant="static" />
            Move to project
          </DropdownMenu.Item>

          <DropdownMenu.Separator
            style={{
              height: "1px",
              backgroundColor: "var(--neutral-100)",
              margin: "4px 0",
            }}
          />

          <DropdownMenu.Item
            style={menuItemDestructiveStyle}
            onSelect={handleDelete}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor =
                "var(--red-50, #fff5f5)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor =
                "transparent")
            }
          >
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>

    <MoveToProjectModal
      open={moveModalOpen}
      onClose={() => setMoveModalOpen(false)}
      onConfirm={handleMoveToProject}
      projects={projects.map((p) => ({ id: p.id, name: p.name, description: p.description }))}
      chatCount={1}
    />
    </>
  );
}
