"use client";

/**
 * useFolderTree — manages all folder-tree state, derived pin-groupings, and
 * CRUD operations for the OrganizePinsDialog.
 *
 * Responsibilities:
 *   - `folders` list and its synchronisation with the backend-provided
 *     `foldersProp` (normalises away duplicate "Unorganized" bucket entries).
 *   - Inline folder-create form state (`isCreatingFolder`, `newFolderName`,
 *     `createInputRef`).
 *   - Inline folder-rename form state (`isEditingFolder`, `editingFolderId`,
 *     `editFolderName`, `editInputRef`).
 *   - Active folder selection (`selectedFolderIds`) — which folder panels are
 *     currently expanded / visible.
 *   - Search query for filtering the folder sidebar (`searchFolderQuery`).
 *   - Three pure memos:
 *       · `pinsByFolder`           — all pins grouped by their folderId.
 *       · `selectedFolderPins`     — flat list of pins across all selected folders.
 *       · `filteredMoveableFolders`— folder list filtered by the move-mode
 *         search input (passed in externally since move-mode state is owned by
 *         the dialog, not the folder tree).
 *   - `handleCreateFolder` / `handleConfirmCreateFolder`
 *   - `handleRenameFolder` / `handleConfirmRenameFolder`
 *   - `handleDeleteFolder`
 *   - Reset of all folder-form state when the dialog closes (`isOpen`).
 *
 * NOT in scope (stays in OrganizePinsDialog or future hooks):
 *   - Pin selection state (`selectedPinIds`).
 *   - Move-mode state (`isMoveMode`, `selectedMoveFolder`, `moveFolderSearch`).
 *   - Delete-confirm dialog state (`showDeleteConfirm`).
 *   - Pin search query (`searchQuery`).
 *   - Scrollbar tracking.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { PinType } from "@/components/layout/right-sidebar";
import { sanitizeFolderName } from "@/lib/security";

// ─── Shared types (also consumed by OrganizePinsDialog) ──────────────────────

/** A lightweight folder descriptor: just an id and display name. */
export interface FolderType {
  id: string;
  name: string;
}

/**
 * The canonical "Unorganized Pins" bucket — always the first entry in the
 * folder list and never exposed to backend CRUD operations.
 */
export const UNORGANIZED_FOLDER: FolderType = {
  id: "unorganized",
  name: "Unorganized Pins",
};

// ─── Hook params ─────────────────────────────────────────────────────────────

export interface UseFolderTreeParams {
  /**
   * Backend-provided folder list. When this prop changes the local `folders`
   * state is resynchronised: any backend "Unorganized" entry is filtered out
   * (it is represented locally by `UNORGANIZED_FOLDER`) and the result is
   * prepended with that constant bucket.
   */
  foldersProp?: FolderType[];

  /**
   * Persist a new folder to the backend. If the call succeeds the returned
   * `FolderType` is used (preserving the backend-assigned id). On failure or
   * when not provided, a client-side UUID is used instead so the UI remains
   * functional offline.
   */
  onCreateFolder?: (name: string) => Promise<FolderType> | FolderType;

  /**
   * Persist a folder rename to the backend. If the call succeeds the
   * backend-returned name is applied; on failure the previous name is kept.
   */
  onRenameFolder?: (
    folderId: string,
    name: string,
  ) => Promise<FolderType> | FolderType;

  /**
   * Persist folder deletion to the backend. On failure the folder is kept
   * in local state (the backend is the source of truth for hard deletes).
   */
  onDeleteFolder?: (folderId: string) => Promise<void> | void;

  /**
   * Full pin list — read-only inside the hook. Used exclusively to derive
   * `pinsByFolder` and `selectedFolderPins`.
   */
  pins: PinType[];

  /**
   * Whether the parent dialog is open. When it transitions to `false` all
   * folder-form transient state is reset (create/rename in-progress forms).
   * The `folders` list itself is NOT reset on close — it persists across
   * open/close cycles so the user sees their changes immediately on next open.
   */
  isOpen: boolean;

  /**
   * Search query for the move-target folder picker (controlled by the dialog's
   * move-mode state). Passed in here so the hook can derive
   * `filteredMoveableFolders` without the dialog having to duplicate that memo.
   */
  moveFolderSearch?: string;

  /**
   * Called with the newly created folder's id when `handleConfirmCreateFolder`
   * is invoked while move-mode is active. Allows the dialog to auto-select the
   * new folder as the move target without the hook knowing about move-mode UI.
   */
  onFolderCreatedInMoveMode?: (folderId: string) => void;

  /**
   * Whether move-mode is currently active (read-only). Used only to decide
   * whether to call `onFolderCreatedInMoveMode` after folder creation.
   */
  isMoveMode?: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useFolderTree({
  foldersProp,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  pins,
  isOpen,
  moveFolderSearch = "",
  onFolderCreatedInMoveMode,
  isMoveMode = false,
}: UseFolderTreeParams) {
  // ── Folder list ─────────────────────────────────────────────────────────────

  const [folders, setFolders] = useState<FolderType[]>(() => {
    if (foldersProp?.length) {
      const cleaned = foldersProp.filter((f) => {
        const lower = f.name?.trim().toLowerCase();
        return lower !== "unorganized" && lower !== "unorganized pins";
      });
      return [UNORGANIZED_FOLDER, ...cleaned];
    }
    return [UNORGANIZED_FOLDER];
  });

  // ── Folder selection ────────────────────────────────────────────────────────

  /** IDs of the folders whose pins are currently shown in the right panel. */
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([
    UNORGANIZED_FOLDER.id,
  ]);

  // ── Folder sidebar search ───────────────────────────────────────────────────

  const [searchFolderQuery, setSearchFolderQuery] = useState("");

  // ── Create-folder form state ────────────────────────────────────────────────

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const createInputRef = useRef<HTMLInputElement | null>(null);

  // ── Rename-folder form state ────────────────────────────────────────────────

  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const editInputRef = useRef<HTMLInputElement | null>(null);

  // ── Effects ──────────────────────────────────────────────────────────────────

  /**
   * Synchronise the backend-provided folder list into local state.
   * Filters out any backend "Unorganized" / "Unorganized Pins" entry so it
   * doesn't appear as a duplicate row alongside our constant bucket.
   */
  useEffect(() => {
    if (foldersProp && foldersProp.length > 0) {
      const cleanedRemote = foldersProp.filter((f) => {
        const lower = f.name?.trim().toLowerCase();
        return lower !== "unorganized" && lower !== "unorganized pins";
      });
      setFolders([UNORGANIZED_FOLDER, ...cleanedRemote]);
    } else {
      setFolders([UNORGANIZED_FOLDER]);
    }
  }, [foldersProp]);

  /** Reset create/rename form state when the dialog closes. */
  useEffect(() => {
    if (!isOpen) {
      setIsCreatingFolder(false);
      setNewFolderName("");
      setIsEditingFolder(false);
      setEditingFolderId(null);
      setEditFolderName("");
      setSearchFolderQuery("");
    }
  }, [isOpen]);

  /** Auto-focus the create-folder input when the form is shown. */
  useEffect(() => {
    if (isCreatingFolder) {
      setTimeout(() => createInputRef.current?.focus(), 0);
    }
  }, [isCreatingFolder]);

  /** Auto-focus the rename input when the form is shown. */
  useEffect(() => {
    if (isEditingFolder) {
      setTimeout(() => editInputRef.current?.focus(), 0);
    }
  }, [isEditingFolder]);

  // ── Derived memos ────────────────────────────────────────────────────────────

  /** All pins grouped by their `folderId` (or `"unorganized"` when absent). */
  const pinsByFolder = useMemo(() => {
    const grouped: Record<string, PinType[]> = {};
    // Initialise a bucket for every known folder (including Unorganized).
    folders.forEach((f) => {
      grouped[f.id] = [];
    });
    // Safety net: always ensure the unorganized bucket exists even if
    // `folders` was not yet normalised (e.g. on the very first render).
    if (!grouped[UNORGANIZED_FOLDER.id]) {
      grouped[UNORGANIZED_FOLDER.id] = [];
    }
    pins.forEach((pin) => {
      const fid = pin.folderId || UNORGANIZED_FOLDER.id;
      if (grouped[fid]) {
        grouped[fid].push(pin);
      } else {
        // Orphan pin whose folder was deleted — fall back to Unorganized.
        grouped[UNORGANIZED_FOLDER.id].push(pin);
      }
    });
    return grouped;
  }, [pins, folders]);

  /** Flat list of pins belonging to all currently selected folders. */
  const selectedFolderPins = useMemo(() => {
    const result: PinType[] = [];
    selectedFolderIds.forEach((id) => {
      (pinsByFolder[id] ?? []).forEach((p) => result.push(p));
    });
    return result;
  }, [pinsByFolder, selectedFolderIds]);

  /**
   * Folder list filtered by `moveFolderSearch` — used in the move-target
   * picker inside move-mode. An empty search returns the full list.
   */
  const filteredMoveableFolders = useMemo(() => {
    const q = moveFolderSearch.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, moveFolderSearch]);

  // ── Folder handlers ──────────────────────────────────────────────────────────

  /** Open the inline create-folder form. */
  const handleCreateFolder = useCallback(() => {
    setIsCreatingFolder(true);
    setNewFolderName("");
  }, []);

  /**
   * Finalize folder creation: sanitize the name, resolve duplicates with an
   * auto-incremented suffix, call the backend (if provided), and insert the
   * new folder immediately after the Unorganized bucket.
   */
  const handleConfirmCreateFolder = useCallback(async () => {
    const baseName = sanitizeFolderName(newFolderName) || "New Folder";

    // Auto-increment suffix to avoid duplicate names (case-insensitive).
    let finalName = baseName;
    let counter = 1;
    while (
      folders.some((f) => f.name.toLowerCase() === finalName.toLowerCase())
    ) {
      finalName = `${baseName} (${counter++})`;
    }

    let created: FolderType | undefined;

    if (onCreateFolder) {
      try {
        const result = await onCreateFolder(finalName);
        if (result?.id) created = result;
      } catch (err) {
        console.error("[useFolderTree/handleConfirmCreateFolder] Backend error:", err);
        // Fall through to client-side fallback below.
      }
    }

    // Client-side fallback when no callback or backend error.
    if (!created) {
      created = { id: crypto.randomUUID(), name: finalName };
    }

    // Insert right after the Unorganized bucket (index 0).
    setFolders((prev) => {
      const base = prev.length ? prev : [UNORGANIZED_FOLDER];
      return [base[0], created!, ...base.slice(1)];
    });

    // If move-mode is active, auto-select the new folder as the target.
    if (isMoveMode && created) {
      onFolderCreatedInMoveMode?.(created.id);
    }

    setIsCreatingFolder(false);
    setNewFolderName("");
  }, [folders, isMoveMode, newFolderName, onCreateFolder, onFolderCreatedInMoveMode]);

  /** Open the inline rename form for `folderId`. */
  const handleRenameFolder = useCallback(
    (folderId: string) => {
      const folder = folders.find((f) => f.id === folderId);
      if (!folder) return;
      setEditingFolderId(folderId);
      setEditFolderName(folder.name);
      setIsEditingFolder(true);
    },
    [folders],
  );

  /**
   * Finalize the folder rename: sanitize, call the backend (if provided),
   * apply the name (prefer backend-returned name), and close the form.
   * On backend error the previous name is kept.
   */
  const handleConfirmRenameFolder = useCallback(async () => {
    if (!editingFolderId) return;

    const nextName = sanitizeFolderName(editFolderName);
    if (!nextName) {
      // Empty name — just cancel.
      setIsEditingFolder(false);
      setEditingFolderId(null);
      setEditFolderName("");
      return;
    }

    try {
      let appliedName = nextName;

      if (onRenameFolder) {
        const result = await onRenameFolder(editingFolderId, nextName);
        if (result?.name) appliedName = result.name;
      }

      setFolders((prev) =>
        prev.map((f) =>
          f.id === editingFolderId ? { ...f, name: appliedName } : f,
        ),
      );
    } catch (err) {
      // Backend rejected the rename (e.g. duplicate name or protected folder).
      // Keep the previous name; the UI reverts automatically.
      console.error("[useFolderTree/handleConfirmRenameFolder] Backend error:", err);
    }

    setIsEditingFolder(false);
    setEditingFolderId(null);
    setEditFolderName("");
  }, [editFolderName, editingFolderId, onRenameFolder]);

  /**
   * Delete a folder from the backend (if callback provided) and remove it
   * from local state. On backend failure the folder is kept to avoid
   * silent data loss.
   *
   * NOTE: the caller is responsible for moving orphaned pins back to
   * Unorganized (via `onDeleteFolder`'s side-effect or an explicit
   * `onPinsUpdate` call in the dialog). This keeps the hook free of pin
   * mutation side-effects.
   */
  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
      try {
        await onDeleteFolder?.(folderId);
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        // Deselect the deleted folder if it was selected.
        setSelectedFolderIds((prev) =>
          prev.filter((id) => id !== folderId).length > 0
            ? prev.filter((id) => id !== folderId)
            : [UNORGANIZED_FOLDER.id],
        );
      } catch (err) {
        console.error("[useFolderTree/handleDeleteFolder] Backend error:", err);
        // Keep UI unchanged on failure.
      }
    },
    [onDeleteFolder],
  );

  // ── Return value ─────────────────────────────────────────────────────────────

  return {
    // Folder list
    folders,
    setFolders,
    // Folder selection
    selectedFolderIds,
    setSelectedFolderIds,
    // Sidebar search
    searchFolderQuery,
    setSearchFolderQuery,
    // Create form
    isCreatingFolder,
    setIsCreatingFolder,
    newFolderName,
    setNewFolderName,
    createInputRef,
    // Rename form
    isEditingFolder,
    setIsEditingFolder,
    editingFolderId,
    editFolderName,
    setEditFolderName,
    editInputRef,
    // Derived
    pinsByFolder,
    selectedFolderPins,
    filteredMoveableFolders,
    // Handlers
    handleCreateFolder,
    handleConfirmCreateFolder,
    handleRenameFolder,
    handleConfirmRenameFolder,
    handleDeleteFolder,
  };
}

/** Convenience type alias. */
export type FolderTreeReturn = ReturnType<typeof useFolderTree>;
