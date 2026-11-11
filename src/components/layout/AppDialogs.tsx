"use client";

import { useEffect, useState } from "react";
import { DeleteChatDialog } from "./DeleteChatDialog";
import { DeleteChatWithFilesDialog } from "@/components/Library/chat/DeleteChatFiles";
import { useChatSavedFiles } from "@/components/Library/chat/useChatSavedFiles";
import { useQueryClient } from "@tanstack/react-query";
import { chatDeletedToast } from "@/components/Library/chat/chat-deleted-toast";
import { useLibraryViewer } from "@/lib/library/viewer";
import { CHAT_MESSAGES } from "@/lib/library/messages";
import { ApiError } from "@/lib/api/client";
import { getChatMessages } from "@/lib/api/chat";

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

// The chat is gone when its messages answer 404. The callers' own delete reports failure by toasting, not
// by throwing, so this is how "Also delete these files" knows not to touch files of a chat that is still there.
async function chatStillExists(chatId: string): Promise<boolean> {
  try {
    await getChatMessages(chatId);
    return true;
  } catch (error) {
    return !(error instanceof ApiError && error.status === 404);
  }
}

/** Delete chat: asks about the files the chat saved to Library, or the plain confirm when they can't be told. */
function DeleteChatHost({ state, onClose }: { state: DeleteChatPayload; onClose: () => void }) {
  const saved = useChatSavedFiles(state.chatId);
  const queryClient = useQueryClient();
  const { orgKey } = useLibraryViewer();
  if (saved.status === "unknown") {
    return (
      <DeleteChatDialog
        open
        chatTitle={state.chatTitle}
        onConfirm={async () => {
          await state.onConfirm();
          onClose();
          if (!(await chatStillExists(state.chatId))) chatDeletedToast(CHAT_MESSAGES.chatDeleted, state.chatId, queryClient, orgKey);
        }}
        onCancel={onClose}
      />
    );
  }
  return (
    <DeleteChatWithFilesDialog
      chatId={state.chatId}
      chatTitle={state.chatTitle}
      files={saved.status === "ready" ? saved.files : []}
      loading={saved.status === "loading"}
      onDeleteChat={async () => {
        await state.onConfirm();
        if (await chatStillExists(state.chatId)) throw new Error("chat not deleted");
      }}
      onClose={onClose}
    />
  );
}

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
        <DeleteChatHost state={deleteChatState} onClose={() => setDeleteChatState(null)} />
      )}
    </>
  );
}
