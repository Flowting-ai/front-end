"use client";

// Every Library write. The rules (docs v2/library/07-build-plan.md section 5.3):
//   optimistic with rollback  rename, trash, restore, revoke
//   never optimistic          share (the server resolves ways in), delete forever, Empty Trash
// Optimistic changes go through patchFileEverywhere (cache.ts); a failed change is rolled back and
// the affected queries are re-read, so the screen always ends on what the server says.

import { mutationOptions, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { libraryApi, type GrantTarget } from "./api";
import { patchFileEverywhere, removeFileFromLists, removeFromPages, type PagedRows } from "./cache";
import { libraryErrorMessage } from "./errors";
import { libraryKeys } from "./keys";
import { FILE_MESSAGES, MESSAGES } from "./messages";
import { addedGrantIds, cachedFileName, countTrashRows } from "./file-toasts";
import { captureError } from "./observability";
import { TRASH_DAYS } from "./constants";
import type { AccessList } from "./schemas";
import type { LibraryFileDetail } from "./file";
import { useLibraryViewer } from "./viewer";

// ── Shared helpers ───────────────────────────────────────────────────────────

function fail(error: unknown, action: string, message: string): void {
  captureError(error, { boundary: "mutation", action });
  toast.error(libraryErrorMessage(error, message));
}

/** Stops in-flight reads of rows we are about to change, so a late response cannot overwrite the optimistic value. Queries with no data yet are left alone. */
async function cancelRowReads(queryClient: QueryClient, org: string): Promise<void> {
  await queryClient.cancelQueries({ queryKey: libraryKeys.all(org), predicate: (query) => query.state.data !== undefined });
}

type Part = "lists" | "suggested" | "trash" | "storage" | "picker";

function keyForPart(org: string, part: Part): readonly unknown[] {
  switch (part) {
    case "lists":
      return libraryKeys.lists(org);
    case "suggested":
      return libraryKeys.suggested(org);
    case "trash":
      return libraryKeys.trash(org);
    case "storage":
      return libraryKeys.storage(org);
    case "picker":
      return [...libraryKeys.all(org), "picker"];
  }
}

function invalidate(queryClient: QueryClient, org: string, parts: Part[]): void {
  for (const part of parts) void queryClient.invalidateQueries({ queryKey: keyForPart(org, part) });
}

// ── Files ────────────────────────────────────────────────────────────────────

export function useRetryProcessing() {
  const queryClient = useQueryClient();
  const { orgKey } = useLibraryViewer();
  return useMutation({
    mutationFn: (id: string) => libraryApi.retryProcessing(id),
    onSuccess: (_, id) => {
      patchFileEverywhere(queryClient, orgKey, id, { processingPhase: "queued", processingFailure: undefined });
      void queryClient.invalidateQueries({ queryKey: libraryKeys.detail(orgKey, id) });
    },
    onError: (error) => fail(error, "retryProcessing", MESSAGES.genericFailure),
  });
}

// Options factories are exported for tests: they drive them with a real QueryClient and a
// MutationObserver, so the optimistic patch and the rollback are checked without rendering.

export function renameFileOptions(queryClient: QueryClient, orgKey: string) {
  return mutationOptions({

    mutationKey: [...libraryKeys.all(orgKey), "rename"],
    mutationFn: async (vars: { id: string; title: string; previousTitle: string; previousAi: boolean }) =>
      libraryApi.renameFile(vars.id, vars.title),
    onMutate: async (vars) => {
      await cancelRowReads(queryClient, orgKey);
      patchFileEverywhere(queryClient, orgKey, vars.id, { title: vars.title.trim(), titleIsAiGenerated: false });
    },
    onError: (error, vars) => {
      patchFileEverywhere(queryClient, orgKey, vars.id, { title: vars.previousTitle, titleIsAiGenerated: vars.previousAi });
      fail(error, "rename", MESSAGES.renameFailed);
    },
    // The server's row is the truth: write it in, and mark lists stale without a refetch flash.
    onSuccess: (row) => {
      patchFileEverywhere(queryClient, orgKey, row.id, row);
      void queryClient.invalidateQueries({ queryKey: libraryKeys.lists(orgKey), refetchType: "none" });
      toast(FILE_MESSAGES.renamed);
    },
  });
}

export function useRenameFile() {
  return useMutation(renameFileOptions(useQueryClient(), useLibraryViewer().orgKey));
}

/** Restore from the API, then re-read what changed. Shared by the Restore button and the Undo on the "Moved to Trash" toast. */
async function restoreFileNow(queryClient: QueryClient, org: string, id: string): Promise<void> {
  await libraryApi.restoreFile(id);
  invalidate(queryClient, org, ["lists", "suggested", "trash", "storage", "picker"]);
  void queryClient.invalidateQueries({ queryKey: libraryKeys.detail(org, id) });
}

/** `title` is the display name the toasts use; without it the name is looked up in the cache. */
type FileVars = { id: string; title?: string };

export function trashFileOptions(queryClient: QueryClient, orgKey: string) {
  return mutationOptions({
    mutationKey: [...libraryKeys.all(orgKey), "trash-file"],
    mutationFn: async (vars: FileVars) => libraryApi.trashFile(vars.id),
    onMutate: async (vars) => {
      // Read the name before the row leaves the lists.
      const name = cachedFileName(queryClient, orgKey, vars.id, vars.title);
      await cancelRowReads(queryClient, orgKey);
      removeFileFromLists(queryClient, orgKey, vars.id);
      queryClient.setQueryData<LibraryFileDetail>(libraryKeys.detail(orgKey, vars.id), (detail) =>
        detail?.with({ life: "trashed", daysLeft: TRASH_DAYS }),
      );
      return { name };
    },
    onError: (error, vars) => {
      // Positions in the lists are not worth reconstructing: read the server's truth again.
      invalidate(queryClient, orgKey, ["lists", "suggested", "picker"]);
      void queryClient.invalidateQueries({ queryKey: libraryKeys.detail(orgKey, vars.id) });
      fail(error, "trash", MESSAGES.deleteFailed);
    },
    onSuccess: (_result, vars, context) => {
      invalidate(queryClient, orgKey, ["trash", "storage"]);
      const name = context?.name ?? cachedFileName(queryClient, orgKey, vars.id, vars.title);
      toast(FILE_MESSAGES.movedToTrash(name), {
        action: {
          label: FILE_MESSAGES.restore,
          onClick: () => {
            restoreFileNow(queryClient, orgKey, vars.id)
              .then(() => toast(FILE_MESSAGES.restored(name)))
              .catch((error: unknown) => fail(error, "undo-trash", MESSAGES.restoreFailed));
          },
        },
      });
    },
  });
}

export function useTrashFile() {
  return useMutation(trashFileOptions(useQueryClient(), useLibraryViewer().orgKey));
}

export function useRestoreFile() {
  const queryClient = useQueryClient();
  const { orgKey } = useLibraryViewer();
  return useMutation({
    mutationKey: [...libraryKeys.all(orgKey), "restore"],
    mutationFn: async (vars: FileVars) => restoreFileNow(queryClient, orgKey, vars.id),
    onMutate: async (vars) => {
      const name = cachedFileName(queryClient, orgKey, vars.id, vars.title);
      await cancelRowReads(queryClient, orgKey);
      queryClient.setQueriesData<PagedRows>({ queryKey: libraryKeys.trash(orgKey) }, (data) => removeFromPages(data, vars.id));
      return { name };
    },
    onError: (error) => {
      invalidate(queryClient, orgKey, ["trash"]);
      fail(error, "restore", MESSAGES.restoreFailed);
    },
    onSuccess: (_result, vars, context) => {
      toast(FILE_MESSAGES.restored(context?.name ?? cachedFileName(queryClient, orgKey, vars.id, vars.title)));
    },
  });
}

export function useDeleteForever() {
  const queryClient = useQueryClient();
  const { orgKey } = useLibraryViewer();
  return useMutation({
    mutationKey: [...libraryKeys.all(orgKey), "delete-forever"],
    mutationFn: async (vars: FileVars) => libraryApi.deleteForever(vars.id),
    // Not optimistic: only the name is read up front, for the toast.
    onMutate: (vars) => ({ name: cachedFileName(queryClient, orgKey, vars.id, vars.title) }),
    onSuccess: (_result, vars, context) => {
      queryClient.setQueriesData<PagedRows>({ queryKey: libraryKeys.trash(orgKey) }, (data) => removeFromPages(data, vars.id));
      queryClient.removeQueries({ queryKey: libraryKeys.detail(orgKey, vars.id) });
      invalidate(queryClient, orgKey, ["trash", "storage"]);
      toast(FILE_MESSAGES.deletedForever(context?.name ?? cachedFileName(queryClient, orgKey, vars.id, vars.title)));
    },
    onError: (error) => fail(error, "delete-forever", MESSAGES.deleteFailed),
  });
}

/** `count` (optional) is how many files the Trash holds, for "N files deleted forever"; otherwise the loaded Trash rows are counted. */
export function useEmptyTrash() {
  const queryClient = useQueryClient();
  const { orgKey } = useLibraryViewer();
  return useMutation({
    mutationKey: [...libraryKeys.all(orgKey), "empty-trash"],
    // `count` is only for the toast; the server empties the whole Trash.
    mutationFn: async (vars?: { count?: number }) => {
      void vars;
      return libraryApi.emptyTrash();
    },
    onMutate: (vars) => ({ count: vars?.count ?? countTrashRows(queryClient, orgKey) }),
    onSuccess: (_result, _vars, context) => {
      invalidate(queryClient, orgKey, ["trash", "storage"]);
      toast(context?.count ? FILE_MESSAGES.filesDeletedForever(context.count) : MESSAGES.trashEmptied);
    },
    onError: (error) => fail(error, "empty-trash", MESSAGES.deleteFailed),
  });
}

/** Clears the unread dot. Fire and forget: a failure is not worth showing. */
export function useMarkOpened() {
  const queryClient = useQueryClient();
  const { orgKey } = useLibraryViewer();
  return useMutation({
    mutationFn: async (vars: { id: string }) => libraryApi.markOpened(vars.id),
    onSuccess: (_result, vars) => {
      patchFileEverywhere(queryClient, orgKey, vars.id, { unread: false });
      void queryClient.invalidateQueries({ queryKey: libraryKeys.suggested(orgKey) });
    },
    onError: (error) => captureError(error, { boundary: "mutation", action: "mark-opened" }),
  });
}

// ── Sharing ──────────────────────────────────────────────────────────────────

function writeAccess(queryClient: QueryClient, org: string, id: string, access: AccessList): void {
  queryClient.setQueryData<AccessList>(libraryKeys.access(org, id), access);
  void queryClient.invalidateQueries({ queryKey: libraryKeys.detail(org, id) });
  invalidate(queryClient, org, ["lists"]);
}

/** Undo on the "Shared with ..." toast: removes exactly the grants that share added. */
function undoShareToast(queryClient: QueryClient, org: string, id: string, grantIds: string[]) {
  if (grantIds.length === 0) return undefined;
  return {
    label: FILE_MESSAGES.undo,
    onClick: () => {
      (async () => {
        const api = libraryApi;
        let access: AccessList | undefined;
        for (const grantId of grantIds) access = await api.revokeGrant(id, grantId);
        if (access) writeAccess(queryClient, org, id, access);
        toast(FILE_MESSAGES.sharingUndone);
      })().catch((error: unknown) => {
        void queryClient.invalidateQueries({ queryKey: libraryKeys.access(org, id) });
        fail(error, "undo-share", MESSAGES.shareFailed);
      });
    },
  };
}

export function useAddGrant() {
  const queryClient = useQueryClient();
  const { orgKey } = useLibraryViewer();
  return useMutation({
    mutationKey: [...libraryKeys.all(orgKey), "add-grant"],
    mutationFn: async (vars: { id: string; target: GrantTarget; label: string }) => libraryApi.addGrant(vars.id, vars.target),
    onMutate: (vars) => ({ before: queryClient.getQueryData<AccessList>(libraryKeys.access(orgKey, vars.id)) }),
    onSuccess: (access, vars, context) => {
      writeAccess(queryClient, orgKey, vars.id, access);
      toast(FILE_MESSAGES.sharedWith([vars.label]), { action: undoShareToast(queryClient, orgKey, vars.id, addedGrantIds(context?.before, access)) });
    },
    onError: (error) => fail(error, "share", MESSAGES.shareFailed),
  });
}

/**
 * Shares one file with everyone staged in the Share dialog, one grant at a time (the server resolves
 * each), then one "Shared with Maya, Sam" toast whose Undo removes them all. Not optimistic. If a grant
 * fails part way, what was added stays and the error is shown.
 */
export function shareFileOptions(queryClient: QueryClient, orgKey: string) {
  return mutationOptions({
    mutationKey: [...libraryKeys.all(orgKey), "share-file"],
    mutationFn: async (vars: { id: string; targets: { target: GrantTarget; label: string }[] }) => {
      const api = libraryApi;
      let access: AccessList | undefined;
      for (const { target } of vars.targets) access = await api.addGrant(vars.id, target);
      return access;
    },
    onMutate: (vars) => ({ before: queryClient.getQueryData<AccessList>(libraryKeys.access(orgKey, vars.id)) }),
    onSuccess: (access, vars, context) => {
      if (!access) return;
      writeAccess(queryClient, orgKey, vars.id, access);
      toast(FILE_MESSAGES.sharedWith(vars.targets.map((item) => item.label)), {
        action: undoShareToast(queryClient, orgKey, vars.id, addedGrantIds(context?.before, access)),
      });
    },
    onError: (error, vars) => {
      void queryClient.invalidateQueries({ queryKey: libraryKeys.access(orgKey, vars.id) });
      fail(error, "share", MESSAGES.shareFailed);
    },
  });
}

export function useShareFile() {
  return useMutation(shareFileOptions(useQueryClient(), useLibraryViewer().orgKey));
}

export function revokeGrantOptions(queryClient: QueryClient, orgKey: string) {
  return mutationOptions({
    mutationKey: [...libraryKeys.all(orgKey), "revoke-grant"],
    /** `label` names who lost access in the toast: "Maya removed", "Workspace removed". */
    mutationFn: async (vars: { id: string; grantId: string; label?: string }) => libraryApi.revokeGrant(vars.id, vars.grantId),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: libraryKeys.access(orgKey, vars.id) });
      const previous = queryClient.getQueryData<AccessList>(libraryKeys.access(orgKey, vars.id));
      if (previous) {
        queryClient.setQueryData<AccessList>(libraryKeys.access(orgKey, vars.id), {
          ...previous,
          entries: previous.entries.filter((entry) => entry.grantId !== vars.grantId),
        });
      }
      return { previous };
    },
    onError: (error, vars, context) => {
      if (context?.previous) queryClient.setQueryData(libraryKeys.access(orgKey, vars.id), context.previous);
      fail(error, "revoke", MESSAGES.shareFailed);
    },
    onSuccess: (access, vars) => {
      writeAccess(queryClient, orgKey, vars.id, access);
      toast(vars.label ? FILE_MESSAGES.removed(vars.label) : MESSAGES.accessRemoved);
    },
  });
}

export function useRevokeGrant() {
  return useMutation(revokeGrantOptions(useQueryClient(), useLibraryViewer().orgKey));
}

// ── Download ─────────────────────────────────────────────────────────────────

/** Asks for a short-lived URL at click time (never cached) and lets the browser download it. */
export async function downloadFile(id: string): Promise<void> {
  const url = await libraryApi.getDownloadUrl(id);
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener noreferrer";
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
