"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

interface DeleteChatDialogProps {
  open: boolean;
  chatTitle: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function DeleteChatDialog({
  open,
  chatTitle,
  onConfirm,
  onCancel,
}: DeleteChatDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v && !isDeleting) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "var(--neutral-900-40, rgba(0,0,0,0.4))",
            backdropFilter: "blur(2px)",
            zIndex: 100,
          }}
        />
        <Dialog.Content
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "var(--neutral-white)",
            borderRadius: "16px",
            padding: "24px",
            width: "min(420px, 90vw)",
            zIndex: 101,
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <Dialog.Title
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: "var(--font-weight-semibold)",
                fontSize: "var(--font-size-body-lg, 16px)",
                lineHeight: "var(--line-height-body)",
                color: "var(--neutral-900)",
                margin: 0,
              }}
            >
              Delete chat?
            </Dialog.Title>
            <Dialog.Description
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: "var(--font-weight-regular)",
                fontSize: "var(--font-size-body)",
                lineHeight: "var(--line-height-body)",
                color: "var(--neutral-500)",
                margin: 0,
              }}
            >
              &ldquo;{chatTitle.length > 60 ? chatTitle.slice(0, 60) + "…" : chatTitle}&rdquo; will
              be permanently deleted. This can&rsquo;t be undone.
            </Dialog.Description>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              disabled={isDeleting}
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: "var(--font-weight-medium)",
                fontSize: "var(--font-size-body)",
                color: "var(--neutral-700)",
                backgroundColor: "var(--neutral-100)",
                border: "none",
                borderRadius: "10px",
                padding: "8px 16px",
                cursor: isDeleting ? "not-allowed" : "pointer",
                opacity: isDeleting ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isDeleting}
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: "var(--font-weight-medium)",
                fontSize: "var(--font-size-body)",
                color: "var(--neutral-white)",
                backgroundColor: "var(--red-500)",
                border: "none",
                borderRadius: "10px",
                padding: "8px 16px",
                cursor: isDeleting ? "not-allowed" : "pointer",
                opacity: isDeleting ? 0.7 : 1,
                minWidth: "80px",
              }}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
