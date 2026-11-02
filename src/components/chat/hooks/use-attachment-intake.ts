import { useEffect, useRef, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { useFileDrop } from "@/hooks/use-file-drop";
import type { PendingAttachment } from "../AttachmentManager";

type ProcessFiles = (files: FileList | File[], prev: PendingAttachment[]) => PendingAttachment[];

/** Files coming into the composer's draft: drag-and-drop, the add menu, and the hidden file input. */
export function useAttachmentIntake({
  setAttachments,
  processFiles,
  addMenuFiles,
  initialPrompt,
}: {
  setAttachments: Dispatch<SetStateAction<PendingAttachment[]>>;
  processFiles: ProcessFiles;
  addMenuFiles: File[] | undefined;
  initialPrompt: string | null | undefined;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File drop (drag-and-drop into the chat area). Open while a reply streams
  // too: the next message can be queued, files and all.
  const { isDragging } = useFileDrop({
    onFiles: (files) => {
      setAttachments((prev) => processFiles(files, prev));
    },
  });

  // Absorb add-menu files into local attachments so AttachmentManager shows them.
  // onClearAddMenuFiles is intentionally NOT called here — it's called in handleSend
  // so the files stay in addMenuFiles until the user actually sends.
  // Skip only while initialPrompt is still pending: sendInitialPrompt consumes those
  // files directly, so absorbing here would duplicate them. Once initialPrompt is
  // cleared (in handleChatCreated on the page) this guard is lifted and subsequent
  // uploads in the same chat session are absorbed normally.
  useEffect(() => {
    if (!addMenuFiles || addMenuFiles.length === 0) return;
    // Any first message from the landing page (a prompt, or "" for files alone) owns these files until
    // the page clears initialPrompt once the chat exists; absorbing them here would put them back in the draft.
    if (initialPrompt != null) return;
    setAttachments((prev) => processFiles(addMenuFiles, prev));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the add-menu files or the pending prompt change
  }, [addMenuFiles, initialPrompt]);

  // Attachment via hidden file input (triggered by onAdd on the ChatInput)
  const handleAdd = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments((prev) => processFiles(e.target.files!, prev));
      e.target.value = "";
    }
  };

  return { isDragging, fileInputRef, handleAdd, handleFileSelect };
}
