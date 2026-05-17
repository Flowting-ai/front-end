"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createPin,
  deletePin,
  listPins,
  listPinFolders,
  getPin,
  updatePinTags as updatePinTags_api,
  type PinComment,
} from "@/lib/api/pins";

// ── Pin Data Shape ────────────────────────────────────────────────────────────

export type PinCategory =
  | "Code"
  | "Research"
  | "Creative"
  | "Planning"
  | "Tasks"
  | "Quote"
  | "Workflow";

export type { PinComment };

export interface PinFolderView {
  id: string;
  label: string;
}

export interface PinItem {
  id: string;
  content: string;
  title: string;
  category: PinCategory;
  tags?: string[];
  chatId?: string;
  chatName?: string;
  messageId: string;
  modelName?: string;
  createdAt: string;
  folderId?: string;
  folderName?: string;
  comments?: PinComment[];
}

// ── Context ───────────────────────────────────────────────────────────────────

interface PinboardContextValue {
  pins: PinItem[];
  folders: PinFolderView[];
  isLoading: boolean;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  addPin: (pin: Omit<PinItem, "id" | "createdAt">) => void;
  clonePin: (original: PinItem) => Promise<void>;
  removePin: (id: string) => void;
  removePinByMessage: (messageId: string) => void;
  isPinned: (messageId: string) => boolean;
  updatePinCategory: (id: string, category: PinCategory) => void;
  updatePinFolder: (id: string, folderId: string | null, folderName?: string) => void;
  updatePinTags: (id: string, tags: string[]) => void;
  addFolder: (folder: PinFolderView) => void;
  removeFolder: (folderId: string) => void;
  renameFolder: (folderId: string, name: string) => void;
}

const PinboardContext = createContext<PinboardContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function PinboardProvider({ children }: { children: React.ReactNode }) {
  const [pins,      setPins]      = useState<PinItem[]>([]);
  const [folders,   setFolders]   = useState<PinFolderView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen,    setIsOpen]    = useState(false);

  const open   = useCallback(() => setIsOpen(true), []);
  const close  = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  // ── Load pins + folders in parallel on mount ────────────────────────────
  useEffect(() => {
    Promise.all([listPins(), listPinFolders()])
      .then(async ([apiPins, apiFolders]) => {
        const items: PinItem[] = apiPins.map((p) => ({
          id:         p.id,
          content:    p.content,
          title:      p.title,
          category:   (p.category as PinCategory) ?? "Code",
          tags:       p.tags,
          messageId:  p.message_id ?? p.id,
          chatId:     p.chat_id,
          createdAt:  p.created_at,
          modelName:  p.model_name,
          folderId:   p.folder_id,
          folderName: p.folder_name,
          comments:   p.comments,
        }));

        setFolders(apiFolders.map((f) => ({ id: f.id, label: f.name })));
        setPins(items);
        setIsLoading(false); // unblock FCP — pins render immediately with whatever the list returned

        // Background tag + comment enrichment.
        // The list endpoint may omit tags; the detail endpoint always has them.
        // This second pass is intentionally non-blocking: pins are visible before it completes.
        const pinsWithoutTags = items.filter((p) => !p.tags || p.tags.length === 0);
        if (!pinsWithoutTags.length) return;

        const enrichments = await Promise.all(
          pinsWithoutTags.map(async (pin) => {
            try {
              const detail   = await getPin(pin.id);
              const hasTags  = detail.tags     && detail.tags.length     > 0;
              const hasCmts  = detail.comments && detail.comments.length > 0;
              if (!hasTags && !hasCmts) return null;
              return {
                id:       pin.id,
                tags:     hasTags ? detail.tags     : undefined,
                comments: hasCmts ? detail.comments : undefined,
              };
            } catch {
              return null;
            }
          }),
        );

        const valid = enrichments.filter(Boolean) as Array<{
          id: string;
          tags?: string[];
          comments?: PinComment[];
        }>;
        if (!valid.length) return;

        const enrichMap = new Map(valid.map((e) => [e.id, e]));
        setPins((prev) =>
          prev.map((p) => {
            const e = enrichMap.get(p.id);
            if (!e) return p;
            return {
              ...p,
              ...(e.tags     ? { tags:     e.tags     } : {}),
              ...(e.comments ? { comments: e.comments } : {}),
            };
          }),
        );
      })
      .catch((err) => {
        console.error("[PinboardContext] Failed to load pins", err);
        setIsLoading(false);
      });
  }, []);

  // ── addPin - optimistic, persisted to backend ───────────────────────────
  const addPin = useCallback(async (pin: Omit<PinItem, "id" | "createdAt">) => {
    let tempId: string | null = null;
    setPins((prev) => {
      if (prev.some((p) => p.messageId === pin.messageId)) return prev;
      const id = `pin-temp-${Date.now()}`;
      tempId = id;
      return [{ ...pin, id, createdAt: new Date().toISOString() }, ...prev];
    });

    if (!tempId) return;

    try {
      const backendPin = await createPin(pin.messageId);
      setPins((prev) =>
        prev.map((p) =>
          p.id === tempId
            ? {
                ...p,
                id:        backendPin.id,
                tags:      backendPin.tags?.length     ? backendPin.tags     : p.tags,
                comments:  backendPin.comments?.length ? backendPin.comments : p.comments,
                createdAt: backendPin.created_at ?? p.createdAt,
              }
            : p,
        ),
      );
    } catch (err) {
      console.error("[PinboardContext] Failed to save pin", err);
      setPins((prev) => prev.filter((p) => p.id !== tempId));
      toast.error("Failed to save pin");
    }
  }, []);

  // ── clonePin ────────────────────────────────────────────────────────────
  const clonePin = useCallback(async (original: PinItem) => {
    const tempId    = `pin-temp-${Date.now()}`;
    const optimistic: PinItem = { ...original, id: tempId, createdAt: new Date().toISOString() };
    setPins((prev) => [optimistic, ...prev]);

    try {
      const backendPin = await createPin(original.messageId);
      setPins((prev) =>
        prev.map((p) =>
          p.id === tempId
            ? {
                ...original,
                id:        backendPin.id,
                tags:      backendPin.tags?.length ? backendPin.tags : original.tags,
                createdAt: backendPin.created_at ?? optimistic.createdAt,
              }
            : p,
        ),
      );
      toast("Pin duplicated");
    } catch (err) {
      console.error("[PinboardContext] Failed to duplicate pin", err);
      setPins((prev) => prev.filter((p) => p.id !== tempId));
      toast.error("Failed to duplicate pin");
    }
  }, []);

  // ── removePin ───────────────────────────────────────────────────────────
  const removePin = useCallback((id: string) => {
    setPins((prev) => prev.filter((p) => p.id !== id));
    if (!id.startsWith("pin-temp-")) {
      deletePin(id).catch((err) =>
        console.error("[PinboardContext] Failed to delete pin", err),
      );
    }
  }, []);

  // ── removePinByMessage ──────────────────────────────────────────────────
  const removePinByMessage = useCallback((messageId: string) => {
    let targetId: string | undefined;
    setPins((prev) => {
      const pin = prev.find((p) => p.messageId === messageId);
      targetId  = pin?.id;
      return prev.filter((p) => p.messageId !== messageId);
    });
    if (targetId && !targetId.startsWith("pin-temp-")) {
      deletePin(targetId).catch((err) =>
        console.error("[PinboardContext] Failed to delete pin", err),
      );
    }
  }, []);

  const addFolder = useCallback((folder: PinFolderView) => {
    setFolders((prev) => {
      if (prev.some((f) => f.id === folder.id)) return prev;
      return [...prev, folder];
    });
  }, []);

  const removeFolder = useCallback((folderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    // Unassign any pins that lived in this folder so they appear as unorganized
    setPins((prev) =>
      prev.map((p) =>
        p.folderId === folderId
          ? { ...p, folderId: undefined, folderName: undefined }
          : p,
      ),
    );
  }, []);

  const renameFolder = useCallback((folderId: string, name: string) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, label: name } : f)),
    );
    setPins((prev) =>
      prev.map((p) =>
        p.folderId === folderId ? { ...p, folderName: name } : p,
      ),
    );
  }, []);

  const updatePinCategory = useCallback((id: string, category: PinCategory) => {
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, category } : p)));
  }, []);

  const updatePinFolder = useCallback((id: string, folderId: string | null, folderName?: string) => {
    setPins((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, folderId: folderId ?? undefined, folderName: folderName ?? undefined }
          : p,
      ),
    );
  }, []);

  const updatePinTags = useCallback((id: string, tags: string[]) => {
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, tags } : p)));
    if (!id.startsWith("pin-temp-")) {
      updatePinTags_api(id, tags).catch((err) =>
        console.error("[PinboardContext] Failed to update pin tags", err),
      );
    }
  }, []);

  const isPinned = useCallback(
    (messageId: string) => pins.some((p) => p.messageId === messageId),
    [pins],
  );

  return (
    <PinboardContext.Provider
      value={{
        pins, folders, isLoading, isOpen,
        open, close, toggle,
        addPin, clonePin, removePin, removePinByMessage, isPinned,
        updatePinCategory, updatePinFolder, updatePinTags,
        addFolder, removeFolder, renameFolder,
      }}
    >
      {children}
    </PinboardContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePinboard(): PinboardContextValue {
  const ctx = useContext(PinboardContext);
  if (!ctx) throw new Error("usePinboard must be used within PinboardProvider");
  return ctx;
}
