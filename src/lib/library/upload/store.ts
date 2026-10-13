"use client";

// The upload queue, shared by the chat composer, Library and any progress surface. It is an external
// store (useSyncExternalStore) and not React state or context on purpose: progress ticks many times
// a second and must re-render only the attachment card it belongs to, and the queue has to outlive
// any one route so navigating never cancels an upload. It holds the attachments' state only (never
// the File bytes, never server entities); a finished upload hands its staged file id to the chat send.

import { useSyncExternalStore } from "react";
import { reduceUpload, type UploadEvent, type UploadItem } from "./machine";

type Listener = () => void;

export type UploadStore = {
  add(item: UploadItem): void;
  dispatch(id: string, event: UploadEvent): UploadItem | undefined;
  remove(id: string): void;
  removeDraft(draftKey: string): void;
  clear(): void;
  get(id: string): UploadItem | undefined;
  /** Items of one draft in the order they were added. The array is stable until something in that draft changes. */
  forDraft(draftKey: string): readonly UploadItem[];
  all(): readonly UploadItem[];
  subscribe(listener: Listener): () => void;
};

const EMPTY: readonly UploadItem[] = Object.freeze([]);

export function createUploadStore(): UploadStore {
  const items = new Map<string, UploadItem>();
  const listeners = new Set<Listener>();
  // Cached per-draft arrays so selectors return the same reference until that draft changes.
  const draftCache = new Map<string, readonly UploadItem[]>();
  let allCache: readonly UploadItem[] = EMPTY;

  function emit(draftKey: string): void {
    draftCache.delete(draftKey);
    allCache = EMPTY;
    for (const listener of [...listeners]) listener();
  }

  return {
    add(item) {
      items.set(item.id, item);
      emit(item.draftKey);
    },
    dispatch(id, event) {
      const current = items.get(id);
      if (!current) return undefined;
      const next = reduceUpload(current, event);
      if (next === current) return current;
      items.set(id, next);
      emit(next.draftKey);
      return next;
    },
    remove(id) {
      const current = items.get(id);
      if (!current) return;
      items.delete(id);
      emit(current.draftKey);
    },
    removeDraft(draftKey) {
      let changed = false;
      for (const [id, item] of items) {
        if (item.draftKey === draftKey) {
          items.delete(id);
          changed = true;
        }
      }
      if (changed) emit(draftKey);
    },
    clear() {
      if (items.size === 0) return;
      items.clear();
      draftCache.clear();
      allCache = EMPTY;
      for (const listener of [...listeners]) listener();
    },
    get: (id) => items.get(id),
    forDraft(draftKey) {
      const cached = draftCache.get(draftKey);
      if (cached) return cached;
      const list = [...items.values()].filter((item) => item.draftKey === draftKey);
      const result = list.length === 0 ? EMPTY : Object.freeze(list);
      draftCache.set(draftKey, result);
      return result;
    },
    all() {
      if (allCache !== EMPTY) return allCache;
      allCache = items.size === 0 ? EMPTY : Object.freeze([...items.values()]);
      return allCache;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The app-wide queue. */
export const uploadStore: UploadStore = createUploadStore();

// ── React bindings ───────────────────────────────────────────────────────────

/** One attachment. Re-renders only when this item changes. */
export function useUploadItem(id: string, store: UploadStore = uploadStore): UploadItem | undefined {
  return useSyncExternalStore(
    store.subscribe,
    () => store.get(id),
    () => undefined,
  );
}

/** The attachments of one draft. Re-renders when one of them is added, removed or changes status or progress. */
export function useDraftUploads(draftKey: string, store: UploadStore = uploadStore): readonly UploadItem[] {
  return useSyncExternalStore(
    store.subscribe,
    () => store.forDraft(draftKey),
    () => EMPTY,
  );
}
