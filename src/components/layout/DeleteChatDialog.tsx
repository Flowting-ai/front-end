"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ChatBoard } from "./app-layout";

interface DeleteChatDialogProps {
  /** The chat board pending deletion, or `null` when the dialog should be closed. */
  chatToDelete: ChatBoard | null;
  /** While `true` the action buttons are disabled and the CTA shows a spinner label. */
  isDeletingChatBoard: boolean;
  /** Called when the AlertDialog visibility changes (e.g. outside-click / Esc). */
  onOpenChange: (open: boolean) => void;
  /** Called when the user clicks Cancel. Should clear `chatToDelete`. */
  onCancel: () => void;
  /** Called when the user confirms the deletion. */
  onConfirm: () => void;
}

/**
 * Confirmation dialog for permanently deleting a chat board.
 *
 * Shows a contextual warning when the board is starred or contains pinned
 * messages so the user understands secondary data that will also be lost.
 *
 * This component is the single canonical implementation — the previous
 * codebase had two slightly different inline copies (mobile and desktop).
 */
export function DeleteChatDialog({
  chatToDelete,
  isDeletingChatBoard,
  onOpenChange,
  onCancel,
  onConfirm,
}: DeleteChatDialogProps) {
  return (
    <AlertDialog
      open={!!chatToDelete}
      onOpenChange={(open) => !open && onOpenChange(false)}
    >
      <AlertDialogContent className="rounded-[8px] bg-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[#171717] text-lg font-semibold">
            Delete Chat Board?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-[#6B7280] space-y-3">
              <p>
                Are you sure you want to delete{" "}
                <span className="font-semibold text-[#171717]">
                  &quot;{chatToDelete?.name}&quot;
                </span>
                ?
              </p>
              <p className="text-sm">
                This action cannot be undone. This will permanently delete this
                chat board and all its messages.
              </p>
              {chatToDelete &&
                (chatToDelete.isStarred ||
                  (chatToDelete.pinCount != null &&
                    chatToDelete.pinCount > 0)) && (
                  <div className="mt-3 space-y-2 rounded-lg bg-[#FEF3C7] border border-[#FDE047] p-3">
                    <p className="text-sm font-medium text-[#92400E]">
                      ⚠️ Warning:
                    </p>
                    <ul className="text-sm text-[#92400E] space-y-1 ml-4 list-disc">
                      {chatToDelete.isStarred && (
                        <li>
                          This chat is <strong>starred</strong>
                        </li>
                      )}
                      {chatToDelete.pinCount != null &&
                        chatToDelete.pinCount > 0 && (
                          <li>
                            This chat contains{" "}
                            <strong>
                              {chatToDelete.pinCount} pinned{" "}
                              {chatToDelete.pinCount === 1
                                ? "message"
                                : "messages"}
                            </strong>
                          </li>
                        )}
                    </ul>
                  </div>
                )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel
            className="rounded-lg px-4 text-[#171717] hover:bg-[#f5f5f5] border-[#d4d4d4]"
            onClick={onCancel}
            disabled={isDeletingChatBoard}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-lg px-4 bg-red-600 text-white hover:bg-red-700"
            onClick={onConfirm}
            disabled={isDeletingChatBoard}
          >
            {isDeletingChatBoard ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
