"use client";

import { useEffect, useState } from "react";
import { DeleteChatDialog } from "./DeleteChatDialog";

// ── Event types ───────────────────────────────────────────────────────────────

interface DeleteChatPayload {
  chatId: string;
  chatTitle: string;
  onConfirm: () => Promise<void>;
}

const DIALOG_DELETE_CHAT = "dialog:delete-chat";

// ── Public imperative API ─────────────────────────────────────────────────────

export function openDeleteChatDialog(payload: DeleteChatPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<DeleteChatPayload>(DIALOG_DELETE_CHAT, {
      detail: payload,
    }),
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AppDialogs() {
  const [deleteChatState, setDeleteChatState] =
    useState<DeleteChatPayload | null>(null);

  useEffect(() => {
    const handleDeleteChat = (e: Event) => {
      const { detail } = e as CustomEvent<DeleteChatPayload>;
      setDeleteChatState(detail);
    };

    window.addEventListener(DIALOG_DELETE_CHAT, handleDeleteChat);
    return () =>
      window.removeEventListener(DIALOG_DELETE_CHAT, handleDeleteChat);
  }, []);

  return (
    <>
      {deleteChatState && (
        <DeleteChatDialog
          open
          chatTitle={deleteChatState.chatTitle}
          onConfirm={async () => {
            await deleteChatState.onConfirm();
            setDeleteChatState(null);
          }}
          onCancel={() => setDeleteChatState(null)}
        />
      )}
    </>
  );
}
