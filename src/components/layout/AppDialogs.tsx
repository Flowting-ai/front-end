"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, m } from "framer-motion";
import { DeleteChatDialog } from "./DeleteChatDialog";
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
    </>
  );
}
