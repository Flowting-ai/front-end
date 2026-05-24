"use client";

import { createContext, useCallback, use, useEffect, useRef, useState } from "react";
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

// â”€â”€ Pin Data Shape â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface PinboardContextValue {
  pins: PinItem[];
  folders: PinFolderView[];
  isLoading: boolean;
  isOpen: boolean;
  /** chatId currently being displayed (set by openForChat, cleared on open/close) */
  chatFilter: string | null;
  open: () => void;
  close: () => void;
  toggle: () => void;
  /** Open pinboard and pre-filter to show only pins from the given chat */
  openForChat: (chatId: string) => void;
  clearChatFilter: () => void;
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

// â”€â”€ Provider â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
export function PinboardProvider({ children }: { children: React.ReactNode }) {
  const [pins,       setPins]       = useState<PinItem[]>([]);
  const [folders,    setFolders]    = useState<PinFolderView[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [isOpen,     setIsOpen]     = useState(false);
  const [chatFilter, setChatFilter] = useState<string | null>(null);
  const enrichedRef           = useRef(false);
  const pendingEnrichmentRef  = useRef<PinItem[]>([]);

  const open            = useCallback(() => { setChatFilter(null); setIsOpen(true) }, []);
  const close           = useCallback(() => { setChatFilter(null); setIsOpen(false) }, []);
  const toggle          = useCallback(() => setIsOpen((v) => !v), []);
  const openForChat     = useCallback((chatId: string) => { setChatFilter(chatId); setIsOpen(true) }, []);
  const clearChatFilter = useCallback(() => setChatFilter(null), []);

  // â”€â”€ Load pins + folders in parallel on mount â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18+ batches these; useReducer refactor tracked separately
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
        setIsLoading(false); // unblock FCP â€” pins render immediately with whatever the list returned

        // Store pins needing tag/comment enrichment; defer the N+1 getPin calls
        // until the pinboard actually opens so they don't fire on every page load.
        const pinsWithoutTags = items.filter((p) => !p.tags || p.tags.length === 0);
        pendingEnrichmentRef.current = pinsWithoutTags;
      })
      .catch((err) => {
        console.error("[PinboardContext] Failed to load pins", err);
        setIsLoading(false);
      });
  }, []);

  // â”€â”€ Deferred tag/comment enrichment â€” fires once when pinboard first opens â”€â”€
  useEffect(() => {
    if (!isOpen || enrichedRef.current) return;
    const pinsWithoutTags = pendingEnrichmentRef.current;
    enrichedRef.current = true;
    if (!pinsWithoutTags.length) return;

    const BATCH = 3;
    (async () => {
      const allResults: Array<{
        id: string;
        tags?: string[];
        comments?: PinComment[];
      } | null> = [];

      for (let i = 0; i < pinsWithoutTags.length; i += BATCH) {
        const batch = pinsWithoutTags.slice(i, i + BATCH);
        const batchResults = await Promise.all(
          batch.map(async (pin) => {
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
        allResults.push(...batchResults);
      }

      const valid = allResults.filter(Boolean) as Array<{
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
    })();
  }, [isOpen]);

  // â”€â”€ addPin - optimistic, persisted to backend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ clonePin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ removePin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const removePin = useCallback((id: string) => {
    setPins((prev) => prev.filter((p) => p.id !== id));
    if (!id.startsWith("pin-temp-")) {
      deletePin(id).catch((err) =>
        console.error("[PinboardContext] Failed to delete pin", err),
      );
    }
  }, []);

  // â”€â”€ removePinByMessage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        pins, folders, isLoading, isOpen, chatFilter,
        open, close, toggle, openForChat, clearChatFilter,
        addPin, clonePin, removePin, removePinByMessage, isPinned,
        updatePinCategory, updatePinFolder, updatePinTags,
        addFolder, removeFolder, renameFolder,
      }}
    >
      {children}
    </PinboardContext.Provider>
  );
}

// â”€â”€ Hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function usePinboard(): PinboardContextValue {
  const ctx = use(PinboardContext);
  if (!ctx) throw new Error("usePinboard must be used within PinboardProvider");
  return ctx;
}
