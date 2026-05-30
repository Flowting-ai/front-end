"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { DeleteChatDialog } from "./DeleteChatDialog";
import CompareModels from "@/components/compare/CompareModels";
import { useCompare } from "@/context/compare-context";
import { useModelSelectorContext } from "@/context/model-selector-context";
import { CreditsExhaustedModal } from "@/components/shared/CreditsExhaustedModal";
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

function CompareDialog() {
  const { isOpen, close } = useCompare();
  const { selectModel } = useModelSelectorContext();

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
              backgroundColor: "rgba(0, 0, 0, 0.5)",
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
            <div style={{ pointerEvents: "auto", position: "relative" }}>
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
      <CompareDialog />
      <CreditsExhaustedModal />
    </>
  );
}
