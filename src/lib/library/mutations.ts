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
import { cachedFileName, countTrashRows, findRowIn, grantFor, targetKey } from "./file-toasts";
import { captureError } from "./observability";
import { TRASH_DAYS } from "./constants";
import type { AccessList, OrgSettings, OrgSettingsPatch, Prefs, PrefsPatch } from "./schemas";
import { orgSettingsSavedMessage, prefsSavedMessage } from "./settings-saved";
import type { LibraryFileDetail } from "./file";
import { useLibraryViewer } from "./viewer";
import { forgetWarmFile } from "./warm";

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
      forgetWarmFile(id);
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
    mutationFn: async (vars: { id: string; title: string; previousTitle: string; previousAi: boolean; extension?: string | null }) =>
      libraryApi.renameFile(vars.id, vars.title, vars.extension),
    onMutate: async (vars) => {
      forgetWarmFile(vars.id);
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
  forgetWarmFile(id);
  invalidate(queryClient, org, ["lists", "suggested", "trash", "storage", "picker"]);
  void queryClient.invalidateQueries({ queryKey: libraryKeys.detail(org, id) });
}

/** Whether the cached row or detail says the viewer owns the file. */
function cachedIsOwner(queryClient: QueryClient, org: string, id: string): boolean {
  for (const [, data] of queryClient.getQueriesData({ queryKey: libraryKeys.all(org) })) {
    const row = findRowIn(data, id);
    if (row) return row.access === "owner";
  }
  return false;
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
      // Restore is the owner's alone, so the toast offers Undo only to the owner (read before the row leaves).
      const owned = cachedIsOwner(queryClient, orgKey, vars.id);
      forgetWarmFile(vars.id);
      await cancelRowReads(queryClient, orgKey);
      removeFileFromLists(queryClient, orgKey, vars.id);
      queryClient.setQueryData<LibraryFileDetail>(libraryKeys.detail(orgKey, vars.id), (detail) =>
        detail?.with({ life: "trashed", daysLeft: TRASH_DAYS }),
      );
      return { name, owned };
    },
    onError: (error, vars) => {
      // Positions in the lists are not worth reconstructing: read the server's truth again.
      invalidate(queryClient, orgKey, ["lists", "suggested", "picker"]);
      void queryClient.invalidateQueries({ queryKey: libraryKeys.detail(orgKey, vars.id) });
      fail(error, "trash", MESSAGES.deleteFailed);
    },
    onSuccess: (_result, vars, context) => {
      // List cursors are offsets: with the row removed locally, the next page would skip a file. Re-read from the start.
      invalidate(queryClient, orgKey, ["lists", "suggested", "picker", "trash", "storage"]);
      const name = context?.name ?? cachedFileName(queryClient, orgKey, vars.id, vars.title);
      if (!context?.owned) {
        toast(FILE_MESSAGES.movedToTrashOwnerRestores(name));
        return;
      }
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

export function useRequestAccess() {
  const { orgKey } = useLibraryViewer();
  return useMutation({
    mutationKey: [...libraryKeys.all(orgKey), "request-access"],
    mutationFn: async (vars: { id: string }) => libraryApi.requestAccess(vars.id),
    onSuccess: () => {
      toast(FILE_MESSAGES.requestSent);
    },
    onError: (error) => fail(error, "request-access", MESSAGES.genericFailure),
  });
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
      forgetWarmFile(vars.id);
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
  forgetWarmFile(id);
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
    onSuccess: (access, vars) => {
      writeAccess(queryClient, orgKey, vars.id, access);
      // The grant succeeded, so the target's entry in the response is the one this share added.
      const grantId = grantFor(access, vars.target)?.grantId;
      toast(FILE_MESSAGES.sharedWith([vars.label]), { action: undoShareToast(queryClient, orgKey, vars.id, grantId ? [grantId] : []) });
    },
    onError: (error) => fail(error, "share", MESSAGES.shareFailed),
  });
}

type ShareTarget = { target: GrantTarget; label: string };
/** What a share got done: the latest access list, who was added (with the grant each added), who already had access. */
export type ShareOutcome = { access: AccessList | undefined; added: (ShareTarget & { grantId?: string })[]; skipped: ShareTarget[] };

/** A share that stopped part way: carries what was done before the failing grant, so it can be shown and undone. */
export class PartialShareError extends Error {
  constructor(readonly failure: unknown, readonly outcome: ShareOutcome) {
    super(failure instanceof Error ? failure.message : "Share failed");
    this.name = "PartialShareError";
  }
}

/** Targets a share no longer needs to send (added, or already had access), as staged keys. */
export function settledShareKeys(outcome: ShareOutcome): string[] {
  return [...outcome.added, ...outcome.skipped].map((item) => targetKey(item.target));
}

function toastShared(queryClient: QueryClient, orgKey: string, id: string, outcome: ShareOutcome): void {
  if (outcome.access) writeAccess(queryClient, orgKey, id, outcome.access);
  if (outcome.added.length === 0) return;
  const grantIds = outcome.added.map((item) => item.grantId).filter((grantId): grantId is string => Boolean(grantId));
  toast(FILE_MESSAGES.sharedWith(outcome.added.map((item) => item.label)), { action: undoShareToast(queryClient, orgKey, id, grantIds) });
}

/**
 * Shares one file with everyone staged in the Share dialog, one grant at a time (the server resolves
 * each), then one "Shared with Maya, Sam" toast whose Undo removes them all. Not optimistic. Each added
 * grant is read from that grant's own response (never diffed against an access list that may not be
 * loaded), and targets that already have access are skipped. If a grant fails part way, the ones added
 * get their toast and Undo, and the error is shown for the rest (PartialShareError says which).
 */
export function shareFileOptions(queryClient: QueryClient, orgKey: string) {
  return mutationOptions({
    mutationKey: [...libraryKeys.all(orgKey), "share-file"],
    mutationFn: async (vars: { id: string; targets: ShareTarget[] }): Promise<ShareOutcome> => {
      const api = libraryApi;
      const outcome: ShareOutcome = { access: queryClient.getQueryData<AccessList>(libraryKeys.access(orgKey, vars.id)), added: [], skipped: [] };
      try {
        outcome.access ??= await api.getAccess(vars.id);
        for (const item of vars.targets) {
          if (grantFor(outcome.access, item.target)) { outcome.skipped.push(item); continue; }
          outcome.access = await api.addGrant(vars.id, item.target);
          outcome.added.push({ ...item, grantId: grantFor(outcome.access, item.target)?.grantId });
        }
      } catch (error) {
        throw new PartialShareError(error, outcome);
      }
      return outcome;
    },
    onSuccess: (outcome, vars) => toastShared(queryClient, orgKey, vars.id, outcome),
    onError: (error, vars) => {
      const outcome = error instanceof PartialShareError ? error.outcome : undefined;
      if (outcome) toastShared(queryClient, orgKey, vars.id, outcome);
      void queryClient.invalidateQueries({ queryKey: libraryKeys.access(orgKey, vars.id) });
      fail(error instanceof PartialShareError ? error.failure : error, "share", MESSAGES.shareFailed);
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

// ── Settings ──────────────────────────────────────────────────────────────────

export function useUpdatePrefs() {
  const queryClient = useQueryClient();
  const { orgKey } = useLibraryViewer();
  return useMutation({
    mutationKey: [...libraryKeys.all(orgKey), "update-prefs"],
    mutationFn: (patch: PrefsPatch) => libraryApi.updatePrefs(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: libraryKeys.prefs(orgKey) });
      const previous = queryClient.getQueryData<Prefs>(libraryKeys.prefs(orgKey));
      if (previous) queryClient.setQueryData<Prefs>(libraryKeys.prefs(orgKey), { ...previous, ...patch });
      return { previous };
    },
    onError: (error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(libraryKeys.prefs(orgKey), context.previous);
      fail(error, "update-prefs", MESSAGES.settingNotSaved);
    },
    onSuccess: (prefs, patch) => {
      queryClient.setQueryData(libraryKeys.prefs(orgKey), prefs);
      toast(prefsSavedMessage(patch));
    },
  });
}

export function useUpdateOrgSettings() {
  const queryClient = useQueryClient();
  const { orgKey } = useLibraryViewer();
  return useMutation({
    mutationKey: [...libraryKeys.all(orgKey), "update-org-settings"],
    mutationFn: (vars: { patch: OrgSettingsPatch; version: number }) => libraryApi.updateOrgSettings(vars.patch, vars.version),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: libraryKeys.orgSettings(orgKey) });
      const previous = queryClient.getQueryData<OrgSettings>(libraryKeys.orgSettings(orgKey));
      if (previous) queryClient.setQueryData<OrgSettings>(libraryKeys.orgSettings(orgKey), { ...previous, ...vars.patch });
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(libraryKeys.orgSettings(orgKey), context.previous);
      fail(error, "update-org-settings", MESSAGES.settingNotSaved);
    },
    onSuccess: (settings, vars) => {
      queryClient.setQueryData(libraryKeys.orgSettings(orgKey), settings);
      toast(orgSettingsSavedMessage(vars.patch));
      // Defaults change what saving does for everyone: read the effective prefs again.
      void queryClient.invalidateQueries({ queryKey: libraryKeys.prefs(orgKey) });
    },
  });
}
