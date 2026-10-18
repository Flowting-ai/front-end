"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, m } from "framer-motion";
import { DeleteChatDialog } from "./DeleteChatDialog";
import { DeleteChatWithFilesDialog } from "@/components/Library/chat/DeleteChatFiles";
import { useChatSavedFiles } from "@/components/Library/chat/useChatSavedFiles";
import { toast } from "sonner";
import { CHAT_MESSAGES } from "@/lib/library/messages";
import { ApiError } from "@/lib/api/client";
import { getChatMessages } from "@/lib/api/chat";
// CompareModels (a large component) only renders once the compare dialog is
// opened (see the `isOpen &&` guard below) — a static import here would make every
// page pay for it, since AppDialogs mounts globally via AppLayout. Deferred
// so the chunk only loads on the first actual open.
const CompareModels = dynamic(() => import("@/components/compare/CompareModels"), {
  ssr: false,
  // The chunk is large; show the modal's frame at once instead of a blank wait.
  loading: () => <CompareModelsLoading />,
});
import { useCompare } from "@/context/compare-context";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { Skeleton } from "@/components/Skeleton";
import { useModelSelectorContext } from "@/context/model-selector-context";
import type { AIModel } from "@/types/ai-model";

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

function CompareModelsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading model comparison"
      style={{ width: "min(1212px, 96vw)", height: "98vh", borderRadius: 20, padding: 24, boxSizing: "border-box", backgroundColor: "var(--neutral-white)", display: "flex", flexDirection: "column", gap: 16 }}
    >
      <Skeleton width="30%" height={28} radius={8} />
      <Skeleton width="100%" height={44} radius={10} />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, alignContent: "start" }}>
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} height={120} radius={12} />)}
      </div>
    </div>
  );
}

function CompareDialog() {
  const { isOpen, close } = useCompare();
  const { selectModel } = useModelSelectorContext();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Keeps Tab inside the modal, restores focus on close, and closes on Esc.
  useFocusTrap(dialogRef, isOpen, close);

  const handleModelSelect = (model: AIModel) => {
    selectModel(model);
    close();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <m.div
            key="compare-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            style={{
              position:        "fixed",
              inset:           0,
              zIndex:          20,
              backgroundColor: "color-mix(in srgb, var(--static-black) 50%, transparent)",
            }}
          />
          {/* Dialog */}
          <m.div
            key="compare-dialog"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{    opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            style={{
              position:        "fixed",
              inset:           0,
              zIndex:          21,
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              pointerEvents:   "none",
            }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Compare models"
              style={{ pointerEvents: "auto", position: "relative" }}
            >
              <CompareModels
                onClose={close}
                onModelSelect={handleModelSelect}
              />
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}

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
  if (saved.status === "unknown") {
    return (
      <DeleteChatDialog
        open
        chatTitle={state.chatTitle}
        onConfirm={async () => {
          await state.onConfirm();
          onClose();
          if (!(await chatStillExists(state.chatId))) toast(CHAT_MESSAGES.chatDeleted);
        }}
        onCancel={onClose}
      />
    );
  }
  return (
    <DeleteChatWithFilesDialog
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
      <CompareDialog />
    </>
  );
}
