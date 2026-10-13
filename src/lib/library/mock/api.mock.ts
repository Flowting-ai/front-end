// In-memory implementation of LibraryApi for development, tests and demos (NEXT_PUBLIC_LIBRARY_MOCK).
// It enforces the same rules the real server must: private by default, Viewer-only grants, the
// owner or an Admin-over-a-workspace-share may change a file, a locked file leaks nothing, Trash
// keeps shares for 30 days, uploads are rejected or processed by simple name rules. It is not a
// substitute for the backend's own permission tests; it only lets the screens be built and checked.

import { ApiError } from "@/lib/api/client";
import type { GrantTarget, LibraryApi } from "../api";
import { formatGroupOf } from "../format";
import type { ListParams } from "../query-params";
import type {
  AccessList,
  Flags,
  LibraryFileDetail,
  LibraryFileRow,
  Limits,
  Member,
  OrgSettings,
  Page,
  Person,
  Prefs,
  PrefsPatch,
  Preview,
  PreviewRequest,
  Storage,
  Suggested,
  TrashPage,
  UploadInit,
  UploadInitRequest,
  UploadPartEtag,
  UploadStatus,
  Usage,
} from "../schemas";
import { FORMATS } from "../schemas";
import { mergeChanges, settingsChangeLines, type SettingsChange } from "../settings-notice";
import { MOCK_PEOPLE, MOCK_VIEWER_ID, buildFixtures, buildSyntheticFiles, type MockFile, type MockPerson } from "./fixtures";
import { SAMPLE_PDF_DATA_URL, SAMPLE_PDF_PAGE_COUNT, createSampleAudioUrl, sampleImageDataUrl } from "./media";

const PAGE_SIZE = 50;
const DAY = 24 * 60 * 60 * 1000;
const TRASH_DAYS = 30;
const MAX_FILE_BYTES = 30 * 1000 * 1000;
const PART_BYTES = 8 * 1000 * 1000;

export type MockOptions = {
  /** Artificial latency per call. 0 in tests. */
  delayMs?: number;
  /** Extra generated rows for performance checks. */
  syntheticRows?: number;
  viewerId?: string;
  clock?: () => number;
};

export type MockControl = {
  /** Make the next call to `method` fail once with `error`. */
  failNext(method: keyof LibraryApi, error: ApiError): void;
  setMyRemoval(pending: boolean): void;
  /** Show a member as awaiting their answer to the transfer question (the Members table). */
  markRemoval(personId: string): void;
  /** Answer a pending removal as that member (the mock cannot sign in as them). Finishes the removal. */
  answerRemovalFor(personId: string, transfer: boolean): void;
  setFlags(flags: Partial<Flags>): void;
  /** Development: hide every sample file (an empty Library) or bring them back. Changes made since are kept. */
  setSampleData(on: boolean): void;
  readonly sampleDataOn: boolean;
  /** Direct access for tests. */
  readonly files: MockFile[];
};

export type MockLibraryApi = LibraryApi & { control: MockControl };

function fail(status: number, code: string, message: string): never {
  throw new ApiError(status, code, message, message);
}

function toPerson(person: MockPerson): Person {
  return { id: person.id, name: person.name };
}

export function createMockLibraryApi(options: MockOptions = {}): MockLibraryApi {
  const delayMs = options.delayMs ?? 180;
  const viewerId = options.viewerId ?? MOCK_VIEWER_ID;
  const clock = options.clock ?? (() => Date.now());
  const startedAt = clock();

  const fixtures = buildFixtures(startedAt);
  const synthetic = options.syntheticRows ? buildSyntheticFiles(startedAt, options.syntheticRows) : [];
  const files: MockFile[] = [...fixtures, ...synthetic];
  // Files hidden by the development "Sample data" switch.
  const stashed: MockFile[] = [];
  let sampleDataOn = true;

  let ownPrefs: PrefsPatch = { autoSave: null, aiReferenceEnabled: true };
  let settingsChangedAt: string | undefined;
  let settingsChanges: SettingsChange[] = [];
  let orgSettings: OrgSettings = {
    defaultAutoSave: "always",
    forceAutoSaveOff: false,
    aiReferenceEnabled: true,
    maxFileBytes: MAX_FILE_BYTES,
    allowedFormats: [...FORMATS],
    version: 1,
  };
  let flags: Flags = { library: true, autoSave: true, aiUse: true, sharing: true };
  let myRemoval = false;
  const removals = new Set<string>();
  /** People whose removal finished (or who left): gone from the members list. */
  const removed = new Set<string>();
  const accessRequests = new Set<string>();
  const pendingFailures = new Map<string, ApiError>();

  type UploadRecord = { id: string; name: string; sizeBytes: number; mimeType: string; completedAt?: number; parts: number };
  const uploads = new Map<string, UploadRecord>();
  let uploadSeq = 1;

  const people = MOCK_PEOPLE;
  const personById = (id: string): MockPerson | undefined => people.find((person) => person.id === id);
  const viewer = personById(viewerId) ?? people[0];

  async function tick(method: keyof LibraryApi, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const queued = pendingFailures.get(method);
    if (queued) {
      pendingFailures.delete(method);
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      throw queued;
    }
    if (delayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs);
        signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      });
    }
  }

  // ── Access ────────────────────────────────────────────────────────────────

  function accessOf(file: MockFile): "owner" | "viewer" | null {
    if (file.ownerId === viewerId) return "owner";
    if (file.life !== "active") return null;
    return file.grants.some((grant) => grant.who === viewerId || grant.who === "workspace") ? "viewer" : null;
  }

  function hasWorkspaceGrant(file: MockFile): boolean {
    return file.grants.some((grant) => grant.who === "workspace");
  }

  function adminCanManage(file: MockFile): boolean {
    return viewer.role === "admin" && accessOf(file) === "viewer" && hasWorkspaceGrant(file);
  }

  function manages(file: MockFile): boolean {
    return accessOf(file) === "owner" || adminCanManage(file);
  }

  function findOrFail(id: string): MockFile {
    const file = files.find((candidate) => candidate.id === id);
    if (!file) fail(404, "file_gone", "No longer available");
    return file;
  }

  /** A file that exists but is not the viewer's: locked leaks nothing; someone else's trashed file looks gone. */
  function openable(id: string): MockFile {
    const file = findOrFail(id);
    if (file.life === "trashed" && file.ownerId !== viewerId) fail(404, "file_gone", "No longer available");
    if (accessOf(file) === null) fail(403, "file_locked", "You don't have access to this file");
    return file;
  }

  function mustManage(file: MockFile): void {
    if (!manages(file)) fail(403, "only_owner", "Only the owner can change this");
  }

  function waysFor(file: MockFile) {
    return file.grants.filter((grant) => grant.who === viewerId || grant.who === "workspace");
  }

  function isShared(file: MockFile): boolean {
    if (file.life !== "active") return false;
    return file.ownerId === viewerId ? file.grants.length > 0 : waysFor(file).length > 0;
  }

  function sharedAtOf(file: MockFile): number {
    const relevant = file.ownerId === viewerId ? file.grants : waysFor(file);
    return relevant.reduce((latest, grant) => Math.max(latest, grant.at), 0);
  }

  // ── Projections ───────────────────────────────────────────────────────────

  function accessSummary(file: MockFile) {
    const owner = personById(file.ownerId) ?? viewer;
    const everyone = hasWorkspaceGrant(file);
    const others = people.filter((person) => person.id !== file.ownerId && file.grants.some((grant) => grant.who === person.id));
    return { everyone, people: [toPerson(owner), ...others.map(toPerson)] };
  }

  /** Only when someone other than the owner moved it to Trash. */
  function trashedByOf(file: MockFile): Person | undefined {
    if (file.life !== "trashed" || !file.trashedBy || file.trashedBy === file.ownerId) return undefined;
    const person = personById(file.trashedBy);
    return person ? toPerson(person) : undefined;
  }

  /** Where a generated file was made. Another person's chat title is never shown. */
  function generatedFromOf(file: MockFile): LibraryFileRow["generatedFrom"] {
    if (file.source !== "generated") return undefined;
    if (file.provenance.kind === "routine") return { kind: "routine", label: file.provenance.label };
    if (file.provenance.kind === "chat") return { kind: "chat", label: file.ownerId === viewerId ? file.provenance.label : undefined };
    return undefined;
  }

  function toRow(file: MockFile): LibraryFileRow {
    const access = accessOf(file) ?? "viewer";
    const unread = file.unreadFor.includes(viewerId);
    const ways = file.ownerId === viewerId ? [] : waysFor(file);
    const sharedAt = sharedAtOf(file);
    const firstWay = ways[0];
    const sharedBy = firstWay ? personById(firstWay.by) : undefined;
    const trashedDays = file.trashedAt !== undefined ? Math.max(0, TRASH_DAYS - Math.floor((clock() - file.trashedAt) / DAY)) : undefined;
    const owner = personById(file.ownerId) ?? viewer;
    return {
      id: file.id,
      title: file.title,
      extension: file.extension,
      format: file.format,
      source: file.source,
      owner: toPerson(owner),
      access,
      adminCanManage: adminCanManage(file),
      accessSummary: accessSummary(file),
      sizeBytes: file.sizeBytes,
      createdAt: new Date(file.createdAt).toISOString(),
      lastActivityAt: new Date(unread ? Math.max(file.lastActivityAt, sharedAt) : file.lastActivityAt).toISOString(),
      lastActivityKind: unread && ways.length > 0 ? "shared" : file.lastActivityKind,
      unread,
      life: file.life,
      trashedAt: file.trashedAt !== undefined ? new Date(file.trashedAt).toISOString() : undefined,
      daysLeft: file.life === "trashed" ? trashedDays : undefined,
      sharedAt: sharedAt > 0 ? new Date(sharedAt).toISOString() : undefined,
      sharedBy: sharedBy ? toPerson(sharedBy) : undefined,
      trashedBy: trashedByOf(file),
      generatedFrom: generatedFromOf(file),
      thumbnailUrl: file.format === "image" && file.body.kind === "image" ? sampleImageDataUrl(file.body.caption) : undefined,
      titleIsAiGenerated: file.titleIsAiGenerated,
    };
  }

  function searchText(file: MockFile): string {
    const body = file.body;
    const parts: string[] = [file.title];
    if (body.kind === "text") parts.push(...body.pages.map((page) => page.text));
    if (body.kind === "audio") parts.push(...body.lines.map((line) => line.text));
    if (body.kind === "sheet") parts.push(...body.sheets.flatMap((sheet) => sheet.columns));
    return parts.join("\n");
  }

  function snippetFor(file: MockFile, query: string): string | undefined {
    const text = searchText(file);
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index < 0) return undefined;
    const start = Math.max(0, index - 30);
    return `${start > 0 ? "…" : ""}${text.slice(start, index + query.length + 60).replace(/\s+/g, " ")}`;
  }

  // ── Lists ─────────────────────────────────────────────────────────────────

  function paramsKey(params: ListParams): string {
    return JSON.stringify([params.tab, params.q, params.sources, params.types, params.sort, params.dir, params.unreadFirst ?? false]);
  }

  // A cursor is only valid for the filters and sort it was issued for (the real server rejects reuse with a 400).
  function keyHash(params: ListParams): string {
    let hash = 5381;
    for (const char of paramsKey(params)) hash = ((hash * 33) ^ char.codePointAt(0)!) >>> 0;
    return hash.toString(36);
  }

  function encodeCursor(params: ListParams, offset: number): string {
    return `${keyHash(params)}.${offset}`;
  }

  function decodeCursor(params: ListParams, cursor: string | null): number {
    if (!cursor) return 0;
    const [key, offset] = cursor.split(".");
    if (key !== keyHash(params) || !/^\d+$/.test(offset ?? "")) fail(400, "invalid_cursor", "Invalid cursor");
    return Number(offset);
  }

  function matches(file: MockFile, params: ListParams): boolean {
    if (file.life !== "active" || accessOf(file) === null) return false;
    if (params.tab === "shared" && !isShared(file)) return false;
    if (params.sources.length > 0) {
      const hit = params.sources.some((source) => (source === "shared" ? isShared(file) : file.source === source));
      if (!hit) return false;
    }
    if (params.types.length > 0 && !params.types.includes(formatGroupOf(file.format))) return false;
    if (params.q && !searchText(file).toLowerCase().includes(params.q.toLowerCase())) return false;
    return true;
  }

  function compare(params: ListParams): (a: MockFile, b: MockFile) => number {
    const direction = params.dir === "asc" ? 1 : -1;
    const unread = (file: MockFile) => Number(file.unreadFor.includes(viewerId));
    return (a, b) => {
      // Shared's untouched order: unread first, then newest shared.
      if (params.unreadFirst && unread(a) !== unread(b)) return unread(b) - unread(a);
      let result: number;
      if (params.sort === "name") result = a.title.toLowerCase().localeCompare(b.title.toLowerCase());
      else if (params.sort === "shared") result = sharedAtOf(a) - sharedAtOf(b);
      else result = a.createdAt - b.createdAt;
      return result !== 0 ? result * direction : a.id.localeCompare(b.id);
    };
  }

  // ── Uploads ───────────────────────────────────────────────────────────────

  function statusOf(record: UploadRecord): UploadStatus {
    if (record.completedAt === undefined) return { id: record.id, phase: "uploading", slow: false };
    const elapsed = clock() - record.completedAt;
    const name = record.name.toLowerCase();
    if (name.includes("slow")) return { id: record.id, phase: "processing", slow: elapsed > 3000 };
    if (elapsed < 1500) return { id: record.id, phase: "processing", slow: false };
    if (name.includes("password")) return { id: record.id, phase: "failed", slow: false, failureReason: "password_protected" };
    if (name.includes("virus") || name.includes("unsafe")) return { id: record.id, phase: "failed", slow: false, failureReason: "unsafe" };
    if (name.includes("corrupt")) return { id: record.id, phase: "failed", slow: false, failureReason: "unreadable" };
    return { id: record.id, phase: "ready", slow: false, fileId: `staged_${record.id}` };
  }

  function extensionOf(name: string): string {
    const dot = name.lastIndexOf(".");
    return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
  }

  const SUPPORTED_EXTENSIONS = new Set([
    "pdf", "docx", "doc", "rtf", "epub", "pptx", "ppt", "xlsx", "xls", "csv", "txt", "md", "json", "xml",
    "html", "eml", "msg", "png", "jpg", "jpeg", "webp", "svg", "tiff", "avif", "mp3", "m4a", "wav",
  ]);

  // ── API ───────────────────────────────────────────────────────────────────

  const api: LibraryApi = {
    async listFiles(params, cursor, signal): Promise<Page<LibraryFileRow>> {
      await tick("listFiles", signal);
      const offset = decodeCursor(params, cursor);
      const matching = files.filter((file) => matches(file, params)).sort(compare(params));
      const slice = matching.slice(offset, offset + PAGE_SIZE);
      const items = slice.map((file) => {
        const row = toRow(file);
        return params.q ? { ...row, snippet: snippetFor(file, params.q) } : row;
      });
      const next = offset + PAGE_SIZE;
      return { items, nextCursor: next < matching.length ? encodeCursor(params, next) : null };
    },

    async getSuggested(signal): Promise<Suggested> {
      await tick("getSuggested", signal);
      const visible = files.filter((file) => file.life === "active" && accessOf(file) !== null);
      const activityAt = (file: MockFile) => (file.unreadFor.includes(viewerId) ? Math.max(file.lastActivityAt, sharedAtOf(file)) : file.lastActivityAt);
      const recent = [...visible].sort((a, b) => activityAt(b) - activityAt(a)).slice(0, 8);
      const uses = (file: MockFile) => file.usedInChats.length + file.usedInRoutines.length;
      const frequent = visible.filter((file) => uses(file) > 0).sort((a, b) => uses(b) - uses(a));
      const generated = visible.filter((file) => file.source === "generated").sort((a, b) => b.createdAt - a.createdAt);
      return { recent: recent.map(toRow), frequent: frequent.map((file) => ({ ...toRow(file), openCount: uses(file) })), generated: generated.map(toRow) };
    },

    async listTrash(cursor, signal): Promise<TrashPage> {
      await tick("listTrash", signal);
      const trashed = files
        .filter((file) => file.life === "trashed" && file.ownerId === viewerId)
        // Newest deleted first.
        .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));
      const offset = cursor && /^\d+$/.test(cursor) ? Number(cursor) : 0;
      const slice = trashed.slice(offset, offset + PAGE_SIZE);
      const next = offset + PAGE_SIZE;
      return {
        items: slice.map(toRow),
        nextCursor: next < trashed.length ? String(next) : null,
        freesBytes: trashed.reduce((sum, file) => sum + file.sizeBytes, 0),
      };
    },

    async getFile(id, signal): Promise<LibraryFileDetail> {
      await tick("getFile", signal);
      const file = openable(id);
      const ways = file.ownerId === viewerId ? [] : waysFor(file).map((grant) => (grant.who === "workspace" ? ("workspace" as const) : ("direct" as const)));
      const previewKind = file.body.kind;
      return {
        ...toRow(file),
        phase: "ready",
        scope: hasWorkspaceGrant(file) ? "workspace" : file.grants.length > 0 ? "shared" : "private",
        provenance: {
          kind: file.provenance.kind,
          label: file.provenance.label,
          via: file.provenance.via,
          chatId: file.provenance.chatId,
          routineId: file.provenance.routineId,
          isTestRun: file.provenance.isTestRun ?? false,
          by: (() => {
            const by = personById(file.provenance.byId ?? file.ownerId);
            return by ? toPerson(by) : undefined;
          })(),
          canOpenChat: file.provenance.chatId ? (file.provenance.chatOwnerId ?? file.ownerId) === viewerId : undefined,
          runLabel: file.provenance.runLabel,
        },
        runInputs: file.runInputs?.map((inputId) => {
          const input = files.find((candidate) => candidate.id === inputId);
          if (!input || input.life !== "active") return { id: inputId, state: "deleted" as const };
          if (accessOf(input) === null) return { id: inputId, state: "locked" as const };
          return { id: inputId, state: "open" as const, title: input.title, format: input.format };
        }),
        mimeType: file.mimeType,
        updatedAt: new Date(file.lastActivityAt).toISOString(),
        ways,
        previewKind,
      };
    },

    async getPreview(id, request: PreviewRequest, signal): Promise<Preview> {
      await tick("getPreview", signal);
      const file = openable(id);
      const body = file.body;
      switch (body.kind) {
        case "pdf":
          return { kind: "pdf", url: SAMPLE_PDF_DATA_URL, pageCount: SAMPLE_PDF_PAGE_COUNT };
        case "text":
          return { kind: "text", pages: body.pages };
        case "image":
          return { kind: "image", url: sampleImageDataUrl(body.caption), caption: body.caption };
        case "audio":
          return { kind: "audio", url: typeof window === "undefined" ? "" : createSampleAudioUrl(Math.ceil(body.durationMs / 1000)), durationMs: body.durationMs, lines: body.lines };
        case "sheet": {
          const sheet = body.sheets.find((candidate) => candidate.name === request.sheet) ?? body.sheets[0];
          const rowStart = Math.min(Math.max(0, request.rowStart ?? 0), sheet.rowTotal);
          const rowCount = Math.min(Math.max(1, request.rowCount ?? 100), 200);
          const rows: string[][] = [];
          for (let row = rowStart; row < Math.min(sheet.rowTotal, rowStart + rowCount); row += 1) rows.push(sheet.rowAt(row));
          return { kind: "sheet", sheets: body.sheets.map((candidate) => candidate.name), sheet: sheet.name, columns: sheet.columns, rows, rowStart, rowTotal: sheet.rowTotal };
        }
        default:
          return fail(404, "no_preview", "This file has no preview");
      }
    },

    async getUsage(id, signal): Promise<Usage> {
      await tick("getUsage", signal);
      const file = openable(id);
      const mine = <T extends { ownerId: string }>(list: T[]) => list.filter((entry) => entry.ownerId === viewerId);
      return {
        chats: mine(file.usedInChats).map((chat) => ({ id: chat.id, title: chat.title })),
        routines: mine(file.usedInRoutines).map((routine) => ({ id: routine.id, title: routine.title })),
        hiddenChats: file.usedInChats.length - mine(file.usedInChats).length,
        hiddenRoutines: file.usedInRoutines.length - mine(file.usedInRoutines).length,
      };
    },

    async getAccess(id, signal): Promise<AccessList> {
      await tick("getAccess", signal);
      return accessListOf(openable(id));
    },

    async getDownloadUrl(id): Promise<string> {
      await tick("getDownloadUrl");
      const file = openable(id);
      return URL.createObjectURL(new Blob([`Sample content of ${file.title}`], { type: "text/plain" }));
    },

    async markOpened(id): Promise<void> {
      await tick("markOpened");
      const file = openable(id);
      file.unreadFor = file.unreadFor.filter((who) => who !== viewerId);
      if (file.ownerId === viewerId) {
        file.lastActivityAt = clock();
        file.lastActivityKind = "opened";
      }
    },

    async renameFile(id, title): Promise<LibraryFileRow> {
      await tick("renameFile");
      const file = openable(id);
      mustManage(file);
      const clean = title.trim();
      if (!clean || clean.length > 255) fail(422, "invalid_title", "Enter a name up to 255 characters");
      file.title = clean;
      file.titleIsAiGenerated = false;
      file.lastActivityAt = clock();
      file.lastActivityKind = "modified";
      return toRow(file);
    },

    async trashFile(id): Promise<{ daysLeft: number }> {
      await tick("trashFile");
      const file = openable(id);
      mustManage(file);
      if (file.life === "trashed") return { daysLeft: TRASH_DAYS };
      file.life = "trashed";
      file.trashedAt = clock();
      file.trashedBy = viewerId;
      return { daysLeft: TRASH_DAYS };
    },

    async restoreFile(id): Promise<void> {
      await tick("restoreFile");
      const file = findOrFail(id);
      if (file.ownerId !== viewerId) fail(404, "file_gone", "No longer available");
      if (file.life !== "trashed") return;
      file.life = "active";
      file.trashedAt = undefined;
      file.trashedBy = undefined;
    },

    async deleteForever(id): Promise<void> {
      await tick("deleteForever");
      const file = findOrFail(id);
      if (file.ownerId !== viewerId || file.life !== "trashed") fail(404, "file_gone", "No longer available");
      files.splice(files.indexOf(file), 1);
    },

    async emptyTrash(): Promise<void> {
      await tick("emptyTrash");
      for (let index = files.length - 1; index >= 0; index -= 1) {
        const file = files[index];
        if (file.life === "trashed" && file.ownerId === viewerId) files.splice(index, 1);
      }
    },

    async addGrant(id, target: GrantTarget): Promise<AccessList> {
      await tick("addGrant");
      if (!flags.sharing) fail(403, "sharing_off", "Sharing is turned off for this workspace.");
      const file = openable(id);
      mustManage(file);
      if (target.kind === "workspace") {
        if (hasWorkspaceGrant(file)) fail(409, "already_has_access", "The whole workspace can already open this file.");
        file.grants.push({ id: `g_${clock()}_${file.grants.length}`, who: "workspace", by: viewerId, at: clock() });
        file.unreadFor = people.filter((person) => person.id !== file.ownerId).map((person) => person.id);
      } else {
        const person = personById(target.personId);
        if (!person) fail(422, "not_a_member", "Only workspace members can be added.");
        if (person.id === file.ownerId || file.grants.some((grant) => grant.who === person.id)) {
          fail(409, "already_has_access", `${person.name} can already open this file.`);
        }
        file.grants.push({ id: `g_${clock()}_${file.grants.length}`, who: person.id, by: viewerId, at: clock() });
        if (!file.unreadFor.includes(person.id)) file.unreadFor.push(person.id);
      }
      file.lastActivityAt = clock();
      file.lastActivityKind = "shared";
      return accessListOf(file);
    },

    async revokeGrant(id, grantId): Promise<AccessList> {
      await tick("revokeGrant");
      const file = openable(id);
      mustManage(file);
      const index = file.grants.findIndex((grant) => grant.id === grantId);
      if (index < 0) fail(404, "grant_not_found", "That access was already removed.");
      file.grants.splice(index, 1);
      return accessListOf(file);
    },

    async requestAccess(id): Promise<void> {
      await tick("requestAccess");
      const file = findOrFail(id);
      if (accessOf(file) !== null) fail(409, "already_has_access", "You can already open this file.");
      accessRequests.add(`${id}:${viewerId}`);
    },

    async listPeople(_orgId, query, signal): Promise<Person[]> {
      await tick("listPeople", signal);
      const needle = query.trim().toLowerCase();
      return people.filter((person) => !needle || person.name.toLowerCase().includes(needle) || person.email.toLowerCase().includes(needle)).map(toPerson);
    },

    async getStorage(signal): Promise<Storage> {
      await tick("getStorage", signal);
      const owned = files.filter((file) => file.ownerId === viewerId);
      const sum = (predicate: (file: MockFile) => boolean) => owned.filter(predicate).reduce((total, file) => total + file.sizeBytes, 0);
      const count = (predicate: (file: MockFile) => boolean) => owned.filter(predicate).length;
      return {
        usedBytes: sum(() => true),
        // Sample cap so the screens read "X of 20 GB used" like the prototype (the real Phase 1 server sends null).
        limitBytes: 20 * 1000 * 1000 * 1000,
        counts: {
          images: count((file) => file.format === "image"),
          audio: count((file) => file.format === "audio"),
          files: count((file) => file.format !== "image" && file.format !== "audio"),
        },
        breakdown: {
          imagesBytes: sum((file) => file.format === "image"),
          audioBytes: sum((file) => file.format === "audio"),
          filesBytes: sum((file) => file.format !== "image" && file.format !== "audio"),
        },
      };
    },

    async getLimits(signal): Promise<Limits> {
      await tick("getLimits", signal);
      return { maxFileBytes: orgSettings.maxFileBytes, allowedFormats: orgSettings.allowedFormats, maxFilesPerMessage: 10 };
    },

    async getFlags(signal): Promise<Flags> {
      await tick("getFlags", signal);
      return { ...flags };
    },

    async getPrefs(signal): Promise<Prefs> {
      await tick("getPrefs", signal);
      return prefsView();
    },

    async updatePrefs(patch): Promise<Prefs> {
      await tick("updatePrefs");
      ownPrefs = { ...ownPrefs, ...patch };
      return prefsView();
    },

    async getOrgSettings(signal): Promise<OrgSettings> {
      await tick("getOrgSettings", signal);
      return { ...orgSettings };
    },

    async updateOrgSettings(patch): Promise<OrgSettings> {
      await tick("updateOrgSettings");
      if (viewer.role !== "admin") fail(403, "admin_only", "Only an Admin can change this.");
      // The later write wins (PRD). The response carries who wrote last so a stale editor can say "Changed by ...".
      const changedAt = new Date(clock()).toISOString();
      settingsChanges = mergeChanges(settingsChanges, settingsChangeLines(orgSettings, patch, changedAt));
      orgSettings = { ...orgSettings, ...patch, version: orgSettings.version + 1, updatedBy: toPerson(viewer), updatedAt: changedAt };
      settingsChangedAt = orgSettings.updatedAt;
      return { ...orgSettings };
    },

    async listMembers(signal): Promise<Member[]> {
      await tick("listMembers", signal);
      return people.map((person) => ({
        id: person.id,
        name: person.name,
        email: person.email,
        role: person.role,
        fileCount: files.filter((file) => file.ownerId === person.id && file.life === "active").length,
        removal: removals.has(person.id) ? ("awaiting_answer" as const) : undefined,
      }));
    },

    async getMyRemoval(signal): Promise<{ pending: boolean; requestedBy?: Person }> {
      await tick("getMyRemoval", signal);
      return myRemoval ? { pending: true, requestedBy: toPerson(people[0]) } : { pending: false };
    },

    async answerMyRemoval(): Promise<void> {
      await tick("answerMyRemoval");
      myRemoval = false;
    },

    async listWorkspaceMembers(_orgId, signal): Promise<Member[]> {
      await tick("listWorkspaceMembers", signal);
      return people
        .filter((person) => !removed.has(person.id))
        .map((person) => ({
          id: person.id,
          name: person.name,
          email: person.email,
          role: person.role,
          fileCount: files.filter((file) => file.ownerId === person.id && file.life === "active").length,
          removal: removals.has(person.id) ? ("awaiting_answer" as const) : undefined,
        }));
    },

    async startMemberRemoval(personId): Promise<void> {
      await tick("startMemberRemoval");
      if (viewer.role !== "admin") fail(403, "admin_only", "Only an Admin can remove members.");
      const person = personById(personId);
      if (!person || removed.has(personId) || personId === viewerId) fail(422, "not_a_member", "Only workspace members can be removed.");
      if (person.role === "admin" && activeAdmins().length === 1) fail(409, "only_admin", "Name another Admin first");
      removals.add(personId);
    },

    async leaveWorkspace(transfer): Promise<void> {
      await tick("leaveWorkspace");
      if (viewer.role === "admin" && activeAdmins().length === 1) fail(409, "only_admin", "Name another Admin first");
      const admin = activeAdmins().find((person) => person.id !== viewerId);
      finishRemoval(viewerId, admin?.id ?? viewerId, transfer);
    },

    async createUpload(request: UploadInitRequest): Promise<UploadInit> {
      await tick("createUpload");
      if (request.sizeBytes > orgSettings.maxFileBytes) fail(413, "too_large", "This file is over the size limit.");
      if (!SUPPORTED_EXTENSIONS.has(extensionOf(request.name))) fail(415, "unsupported", "This file type isn't supported.");
      const id = `up_${uploadSeq++}`;
      const parts = Math.max(1, Math.ceil(request.sizeBytes / PART_BYTES));
      uploads.set(id, { id, name: request.name, sizeBytes: request.sizeBytes, mimeType: request.mimeType, parts });
      return {
        id,
        partSize: PART_BYTES,
        parts: Array.from({ length: parts }, (_, index) => ({ partNumber: index + 1, url: `mock://upload/${id}/${index + 1}` })),
      };
    },

    async completeUpload(id, parts: UploadPartEtag[]): Promise<void> {
      await tick("completeUpload");
      const record = uploads.get(id);
      if (!record) fail(404, "upload_not_found", "This upload is no longer available.");
      if (parts.length !== record.parts) fail(400, "incomplete_upload", "Some parts are missing.");
      record.completedAt = clock();
    },

    async presignUploadParts(id, partNumbers): Promise<UploadInit["parts"]> {
      await tick("presignUploadParts");
      if (!uploads.has(id)) fail(404, "upload_not_found", "This upload is no longer available.");
      return partNumbers.map((partNumber) => ({ partNumber, url: `mock://upload/${id}/${partNumber}` }));
    },

    async cancelUpload(id): Promise<void> {
      await tick("cancelUpload");
      uploads.delete(id);
    },

    async getUploadStatuses(ids, signal): Promise<UploadStatus[]> {
      await tick("getUploadStatuses", signal);
      return ids.flatMap((id) => {
        const record = uploads.get(id);
        return record ? [statusOf(record)] : [];
      });
    },
  };

  /** The person's own choices plus what actually applies to them (Admin force-off, then their choice, then the workspace default). */
  function prefsView(): Prefs {
    const forcedOff = orgSettings.forceAutoSaveOff;
    return {
      autoSave: ownPrefs.autoSave ?? null,
      aiReferenceEnabled: ownPrefs.aiReferenceEnabled ?? true,
      effectiveAutoSave: forcedOff ? "never" : (ownPrefs.autoSave ?? orgSettings.defaultAutoSave),
      forcedOff,
      aiReferenceAllowed: orgSettings.aiReferenceEnabled,
      settingsChangedAt,
      settingsChanges: settingsChanges.length ? [...settingsChanges] : undefined,
    };
  }

  function accessListOf(file: MockFile): AccessList {
    const owner = personById(file.ownerId) ?? viewer;
    const entries: AccessList["entries"] = [{ grantId: "owner", kind: "owner", person: toPerson(owner), via: "owner" }];
    for (const grant of file.grants) {
      if (grant.who === "workspace") entries.push({ grantId: grant.id, kind: "workspace", via: "workspace" });
      else {
        const person = personById(grant.who);
        if (person) entries.push({ grantId: grant.id, kind: "user", person: toPerson(person), via: "direct" });
      }
    }
    return { entries, canManage: manages(file) };
  }

  function activeAdmins(): MockPerson[] {
    return people.filter((person) => person.role === "admin" && !removed.has(person.id) && !removals.has(person.id));
  }

  /**
   * The leaver's answer (01-product-rules section 9). Yes: a file shared with the workspace or with the Admin
   * goes to the Admin, any other shared file to the first person it was shared with, and the shares stay.
   * No: shared files are deleted. Never-shared files are deleted either way. Their shares on others' files are cleared.
   */
  function finishRemoval(who: string, adminId: string, transfer: boolean): void {
    for (const file of [...files]) {
      if (file.ownerId !== who) continue;
      const grants = file.grants.filter((grant) => grant.who !== who);
      if (grants.length === 0 || !transfer) {
        files.splice(files.indexOf(file), 1);
        continue;
      }
      const toAdmin = grants.some((grant) => grant.who === "workspace" || grant.who === adminId);
      const first = [...grants].sort((a, b) => a.at - b.at).find((grant) => grant.who !== "workspace");
      file.ownerId = toAdmin ? adminId : (first?.who ?? adminId);
      file.grants = grants.filter((grant) => grant.who !== file.ownerId);
    }
    for (const file of files) {
      file.grants = file.grants.filter((grant) => grant.who !== who).map((grant) => (grant.by === who ? { ...grant, by: file.ownerId } : grant));
      file.unreadFor = file.unreadFor.filter((reader) => reader !== who);
    }
    removals.delete(who);
    removed.add(who);
  }

  const control: MockControl = {
    answerRemovalFor(personId, transfer) {
      if (!removals.has(personId)) return;
      finishRemoval(personId, viewerId, transfer);
    },
    failNext(method, error) {
      pendingFailures.set(method, error);
    },
    setMyRemoval(pending) {
      myRemoval = pending;
    },
    markRemoval(personId) {
      removals.add(personId);
    },
    setFlags(next) {
      flags = { ...flags, ...next };
    },
    setSampleData(on) {
      if (on === sampleDataOn) return;
      sampleDataOn = on;
      // Everything the API returns is read from `files`, so moving them aside empties every screen.
      if (on) files.push(...stashed.splice(0));
      else stashed.push(...files.splice(0));
    },
    get sampleDataOn() {
      return sampleDataOn;
    },
    files,
  };

  return { ...api, control };
}
