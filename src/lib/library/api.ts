// The data-function boundary for Library. Hooks call `getLibraryApi()` and never see a URL.
// Two implementations satisfy `LibraryApi`:
//   api.real.ts   the REST contract in docs v2/library/04-backend-requirements.md
//   mock/api.mock.ts   in-memory sample data, loaded only when NEXT_PUBLIC_LIBRARY_MOCK=true
//                      (NEXT_PUBLIC_LIBRARY_MOCK_ROWS=5000 adds that many generated rows for performance checks)
// The mock is a lazy chunk (dynamic import), so a build without the flag never downloads it.

import { LIBRARY_MOCK } from "@/lib/feature-flags";
import type { ListParams } from "./query-params";
import type {
  AccessList,
  Flags,
  Limits,
  LibraryFileDetail,
  LibraryFileRow,
  Member,
  OrgSettings,
  OrgSettingsPatch,
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
} from "./schemas";

export type GrantTarget = { kind: "user"; personId: string } | { kind: "workspace" };

export interface LibraryApi {
  // Lists
  listFiles(params: ListParams, cursor: string | null, signal?: AbortSignal): Promise<Page<LibraryFileRow>>;
  getSuggested(signal?: AbortSignal): Promise<Suggested>;
  listTrash(cursor: string | null, signal?: AbortSignal): Promise<TrashPage>;

  // One file
  getFile(id: string, signal?: AbortSignal): Promise<LibraryFileDetail>;
  getPreview(id: string, request: PreviewRequest, signal?: AbortSignal): Promise<Preview>;
  getUsage(id: string, signal?: AbortSignal): Promise<Usage>;
  getAccess(id: string, signal?: AbortSignal): Promise<AccessList>;
  getDownloadUrl(id: string): Promise<string>;
  markOpened(id: string): Promise<void>;

  // Changes
  renameFile(id: string, title: string): Promise<LibraryFileRow>;
  trashFile(id: string): Promise<{ daysLeft: number }>;
  restoreFile(id: string): Promise<void>;
  deleteForever(id: string): Promise<void>;
  emptyTrash(): Promise<void>;
  addGrant(id: string, target: GrantTarget): Promise<AccessList>;
  revokeGrant(id: string, grantId: string): Promise<AccessList>;
  requestAccess(id: string): Promise<void>;
  listPeople(orgId: string, query: string, signal?: AbortSignal): Promise<Person[]>;

  // Summaries
  getStorage(signal?: AbortSignal): Promise<Storage>;
  getLimits(signal?: AbortSignal): Promise<Limits>;
  getFlags(signal?: AbortSignal): Promise<Flags>;

  // Settings
  getPrefs(signal?: AbortSignal): Promise<Prefs>;
  updatePrefs(patch: PrefsPatch): Promise<Prefs>;
  getOrgSettings(signal?: AbortSignal): Promise<OrgSettings>;
  /** `version` is the version the caller last saw (If-Match). The later write wins; the response says who changed it last. */
  updateOrgSettings(patch: OrgSettingsPatch, version: number): Promise<OrgSettings>;
  listMembers(signal?: AbortSignal): Promise<Member[]>;
  /** The signed-in person has a pending removal (started in the workspace Members page) waiting for their answer. */
  getMyRemoval(signal?: AbortSignal): Promise<{ pending: boolean; requestedBy?: Person }>;
  answerMyRemoval(transfer: boolean): Promise<void>;
  /** Admin: everyone in the workspace (the org members list), with any pending Library removal. */
  listWorkspaceMembers(orgId: string, signal?: AbortSignal): Promise<Member[]>;
  /** Admin: start removing a member. The removal finishes when they answer the transfer question. */
  startMemberRemoval(personId: string): Promise<void>;
  /** The signed-in person leaves the workspace, answering the same transfer question. `only_admin` for the only Admin. */
  leaveWorkspace(transfer: boolean): Promise<void>;

  // Uploads (the composer owns the UI; Library has no upload button)
  createUpload(request: UploadInitRequest): Promise<UploadInit>;
  completeUpload(id: string, parts: UploadPartEtag[]): Promise<void>;
  /** Fresh presigned URLs for parts whose URL expired (the storage origin answered 403). */
  presignUploadParts(id: string, partNumbers: number[]): Promise<UploadInit["parts"]>;
  cancelUpload(id: string): Promise<void>;
  getUploadStatuses(ids: string[], signal?: AbortSignal): Promise<UploadStatus[]>;
}

let apiPromise: Promise<LibraryApi> | undefined;

/** The active implementation. Resolved once; the same promise is shared by every caller. */
export function getLibraryApi(): Promise<LibraryApi> {
  apiPromise ??= LIBRARY_MOCK
    ? import("./mock/api.mock").then((module) => module.createMockLibraryApi({ syntheticRows: Number(process.env.NEXT_PUBLIC_LIBRARY_MOCK_ROWS) || 0 }))
    : import("./api.real").then((module) => module.createRealLibraryApi());
  return apiPromise;
}

/** Tests only: drop the memoised implementation. */
export function resetLibraryApiForTests(): void {
  apiPromise = undefined;
}
