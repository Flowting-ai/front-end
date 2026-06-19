"use client";

import { createContext, useCallback, use, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createPin,
  deletePin,
  listPins,
  listPinFolders,
  updatePinTags as updatePinTags_api,
  addPinComment,
  editPinComment,
  deletePinComment,
  type PinComment,
} from "@/lib/api/pins";

// ── Stale-while-revalidate cache ──────────────────────────────────────────────
// Module-level so it survives HMR remounts within the same session.
// localStorage gives instant hydration across page refreshes.

interface PinboardSnapshot {
  pins:    PinItem[];
  folders: PinFolderView[];
  savedAt: number;
}

const CACHE_KEY    = "sb_pinboard_v1";
const CACHE_TTL_MS = 60_000; // 60 s — revalidate after this even if cached

// In-memory layer: avoids a JSON.parse on every render in development
let memCache: PinboardSnapshot | null = null;

function readCache(): PinboardSnapshot | null {
  if (memCache) return memCache;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    memCache = JSON.parse(raw) as PinboardSnapshot;
    return memCache;
  } catch {
    return null;
  }
}

function writeCache(pins: PinItem[], folders: PinFolderView[]): void {
  const snap: PinboardSnapshot = { pins, folders, savedAt: Date.now() };
  memCache = snap;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(snap));
  } catch {
    // Storage full / unavailable — in-memory cache still works
  }
}

function isCacheFresh(snap: PinboardSnapshot): boolean {
  return Date.now() - snap.savedAt < CACHE_TTL_MS;
}

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
  pinCount?: number;
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

// â"€â"€ Context â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

interface PinboardContextValue {
  pins: PinItem[];
  folders: PinFolderView[];
  isLoading: boolean;
  /** True when the last load attempt failed. Cleared on next successful load. */
  isError: boolean;
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
  updatePinComment: (id: string, text: string) => void;
  addFolder: (folder: PinFolderView) => void;
  removeFolder: (folderId: string) => void;
  renameFolder: (folderId: string, name: string) => void;
  /** Start fetching pin data early (e.g. on button hover) without opening the panel */
  prefetch: () => void;
}

const PinboardContext = createContext<PinboardContextValue | null>(null);

// ── Stable actions context — holds only useCallback([], []) functions so
// consumers (e.g. ChatMessage) never re-render when pin data changes ──────────

interface PinboardActionsContextValue {
  addPin: (pin: Omit<PinItem, "id" | "createdAt">) => void;
  removePinByMessage: (messageId: string) => void;
  open: () => void;
}

const PinboardActionsContext = createContext<PinboardActionsContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function PinboardProvider({ children }: { children: React.ReactNode }) {
  // Always start with server-safe defaults so SSR and client initial render
  // produce identical HTML (no hydration mismatch). Cache is applied client-
  // side in the mount useEffect below, before the first browser paint.
  const [pins,       setPins]       = useState<PinItem[]>([]);
  const [folders,    setFolders]    = useState<PinFolderView[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [isError,    setIsError]    = useState(false);
  const [isOpen,     setIsOpen]     = useState(false);
  const [chatFilter, setChatFilter] = useState<string | null>(null);

  const fetchingRef   = useRef(false);
  const cacheWriteRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open            = useCallback(() => { setChatFilter(null); setIsOpen(true) }, []);
  const close           = useCallback(() => { setChatFilter(null); setIsOpen(false) }, []);
  const toggle          = useCallback(() => setIsOpen((v) => !v), []);
  const openForChat     = useCallback((chatId: string) => { setChatFilter(chatId); setIsOpen(true) }, []);
  const clearChatFilter = useCallback(() => setChatFilter(null), []);

  // ── Core load: fetch pins + folders, update state + cache ─────────────────
  // Shared by the mount effect and prefetch(). fetchingRef prevents duplicate
  // in-flight requests; skipIfFresh avoids redundant network calls when data
  // was loaded recently.
  const load = useCallback((skipIfFresh = true) => {
    if (fetchingRef.current) return;
    if (skipIfFresh) {
      const snap = readCache();
      if (snap && isCacheFresh(snap)) return;
    }
    fetchingRef.current = true;
    Promise.all([listPins(), listPinFolders()])
      .then(([apiPins, apiFolders]) => {
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
        const folderItems = apiFolders.map((f) => ({ id: f.id, label: f.name, pinCount: f.pin_count }));
        setPins(items);
        setFolders(folderItems);
        setIsLoading(false);
        setIsError(false);
        writeCache(items, folderItems);
      })
      .catch((err) => {
        console.error("[PinboardContext] Failed to load pins", err);
        setIsLoading(false);
        setIsError(true);
        // Do NOT call writeCache here — that would overwrite good cached data
        // with empty arrays and cause pins to stay missing for up to 60 seconds.
        toast.error("Couldn't load your pins. Tap to retry.", {
          action: { label: "Retry", onClick: () => load(false) },
        });
      })
      .finally(() => {
        fetchingRef.current = false;
      });
  }, []);

  // On mount (client only — never runs on server):
  //  1. If fresh cache exists, apply it immediately (React 18 batches the three
  //     setStates into one re-render — no visible flash).
  //  2. If cache is stale or missing, fetch from network.
  // This keeps SSR/client initial HTML identical (both start with isLoading:true)
  // while still giving instant data on return visits.
  useEffect(() => {
    const snap = readCache();
    if (snap) {
      setPins(snap.pins);
      setFolders(snap.folders);
      setIsLoading(false);
      if (!isCacheFresh(snap)) load(false); // stale — revalidate in background
    } else {
      load(false); // no cache — fetch fresh
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- load is stable; intentional mount-only
  }, []);

  // Debounced cache write for mutations (add/remove/rename/tag updates).
  // 500 ms debounce batches rapid optimistic updates into a single write.
  // Skip when in error state — don't overwrite good cached data with empty pins.
  useEffect(() => {
    if (isLoading || isError) return;
    if (cacheWriteRef.current) clearTimeout(cacheWriteRef.current);
    cacheWriteRef.current = setTimeout(() => writeCache(pins, folders), 500);
    return () => {
      if (cacheWriteRef.current) clearTimeout(cacheWriteRef.current);
    };
  }, [pins, folders, isLoading, isError]);

  // Prefetch: start loading before the user clicks (e.g. on button hover).
  // No-op if data is fresh or a fetch is already in-flight.
  const prefetch = useCallback(() => load(), [load]);

  // â"€â"€ addPin - optimistic, persisted to backend â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

  // â"€â"€ clonePin â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

  // â"€â"€ removePin â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const removePin = useCallback((id: string) => {
    setPins((prev) => prev.filter((p) => p.id !== id));
    if (!id.startsWith("pin-temp-")) {
      deletePin(id).catch((err) =>
        console.error("[PinboardContext] Failed to delete pin", err),
      );
    }
  }, []);

  // â"€â"€ removePinByMessage â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

  const updatePinComment = useCallback((id: string, text: string) => {
    if (id.startsWith("pin-temp-")) return;
    setPins((prev) => {
      const pin = prev.find((p) => p.id === id);
      if (!pin) return prev;
      const existingComment = pin.comments?.[0];

      if (!text.trim()) {
        if (!existingComment) return prev;
        deletePinComment(id, existingComment.id).catch((err) =>
          console.error("[PinboardContext] Failed to delete comment", err),
        );
        return prev.map((p) => p.id === id ? { ...p, comments: [] } : p);
      }

      if (existingComment) {
        editPinComment(id, existingComment.id, text)
          .then((updated) =>
            setPins((s) => s.map((p) => p.id === id ? { ...p, comments: [updated] } : p)),
          )
          .catch((err) =>
            console.error("[PinboardContext] Failed to edit comment", err),
          );
        return prev.map((p) =>
          p.id === id ? { ...p, comments: [{ ...existingComment, content: text }] } : p,
        );
      }

      addPinComment(id, text)
        .then((created) =>
          setPins((s) => s.map((p) => p.id === id ? { ...p, comments: [created] } : p)),
        )
        .catch((err) =>
          console.error("[PinboardContext] Failed to add comment", err),
        );
      return prev.map((p) =>
        p.id === id
          ? { ...p, comments: [{ id: "", content: text, created_at: new Date().toISOString() }] }
          : p,
      );
    });
  }, []);

  const pinnedMessageIds = useMemo(
    () => new Set(pins.flatMap((p) => (p.messageId ? [p.messageId] : []))),
    [pins],
  );

  const isPinned = useCallback(
    (messageId: string) => pinnedMessageIds.has(messageId),
    [pinnedMessageIds],
  );

  const contextValue = useMemo(
    () => ({
      pins, folders, isLoading, isError, isOpen, chatFilter,
      open, close, toggle, openForChat, clearChatFilter,
      addPin, clonePin, removePin, removePinByMessage, isPinned,
      updatePinCategory, updatePinFolder, updatePinTags, updatePinComment,
      addFolder, removeFolder, renameFolder,
      prefetch,
    }),
    // primitives + stable callbacks — new object only when something actually changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pins, folders, isLoading, isError, isOpen, chatFilter, isPinned],
  );

  // All three are useCallback([], []) — reference never changes, so this value
  // is created once and the context never triggers re-renders on its consumers.
  const actionsValue = useMemo(
    () => ({ addPin, removePinByMessage, open }),
    [addPin, removePinByMessage, open],
  );

  return (
    <PinboardActionsContext.Provider value={actionsValue}>
      <PinboardContext.Provider value={contextValue}>
        {children}
      </PinboardContext.Provider>
    </PinboardActionsContext.Provider>
  );
}

// â"€â"€ Hook â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export function usePinboard(): PinboardContextValue {
  const ctx = use(PinboardContext);
  if (!ctx) throw new Error("usePinboard must be used within PinboardProvider");
  return ctx;
}

export function usePinboardActions(): PinboardActionsContextValue {
  const ctx = use(PinboardActionsContext);
  if (!ctx) throw new Error("usePinboardActions must be used within PinboardProvider");
  return ctx;
}
