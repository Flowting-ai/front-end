// The Library REST API (back-end services/library). Control-plane calls only: the bytes of an upload
// go straight to presigned storage URLs (upload/transport.ts), never through here or the Next proxy.
//
// Every response is parsed with the zod schemas, so a contract drift fails here, loudly and once,
// as an ApiError("contract_error"), instead of as an undefined inside a component.

import { z } from "zod";
import { ApiError, apiFetchJson, apiFetchVoid } from "@/lib/api/client";
import { listMembers as listOrgMembers } from "@/lib/api/organization";
import { API_BASE_URL } from "@/lib/config";
import { captureError } from "./observability";
import { renameSchema } from "./forms";
import type { ListParams } from "./query-params";
import {
  accessListSchema,
  fileDetailSchema,
  fileRowSchema,
  limitsSchema,
  pageSchema,
  personSchema,
  previewSchema,
  storageSchema,
  suggestedSchema,
  trashPageSchema,
  uploadInitSchema,
  uploadStatusSchema,
  usageSchema,
  type Person,
  type PreviewRequest,
  type UploadInitRequest,
  type UploadPartEtag,
} from "./schemas";

export type GrantTarget = { kind: "user"; personId: string } | { kind: "workspace" };

const BASE = `${API_BASE_URL}/library`;
const PAGE_SIZE = 50;

const enc = encodeURIComponent;
const fileUrl = (id: string) => `${BASE}/files/${enc(id)}`;
const trashUrl = (id: string) => `${BASE}/trash/${enc(id)}`;
const uploadUrl = (id: string) => `${BASE}/uploads/${enc(id)}`;

function jsonBody(value: unknown): RequestInit {
  return { body: JSON.stringify(value) };
}

/** Parses a response body; a shape the contract does not allow is reported once and surfaced as a clear error. */
function parse<T extends z.ZodType>(schema: T, raw: unknown, what: string): z.infer<T> {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  captureError(result.error, { boundary: "contract", action: what });
  throw new ApiError(502, "contract_error", "Library returned something unexpected. Please try again.", `${what}: ${result.error.message}`);
}

async function get<T extends z.ZodType>(schema: T, url: string, what: string, signal?: AbortSignal): Promise<z.infer<T>> {
  return parse(schema, await apiFetchJson<unknown>(url, { signal }), what);
}

function listQuery(params: ListParams, cursor: string | null): string {
  const query = new URLSearchParams();
  query.set("tab", params.tab);
  if (params.q) query.set("q", params.q);
  for (const source of params.sources) query.append("source", source);
  for (const type of params.types) query.append("type", type);
  query.set("sort", params.sort);
  query.set("dir", params.dir);
  if (params.unreadFirst) query.set("unreadFirst", "true");
  query.set("limit", String(PAGE_SIZE));
  if (cursor) query.set("cursor", cursor);
  return query.toString();
}

function grantBody(target: GrantTarget): RequestInit {
  return jsonBody(target.kind === "workspace" ? { who: "workspace" } : { who: target.personId });
}

function previewQuery(request: PreviewRequest): string {
  const query = new URLSearchParams();
  if (request.sheet) query.set("sheet", request.sheet);
  if (request.rowStart !== undefined) query.set("rowStart", String(request.rowStart));
  if (request.rowCount !== undefined) query.set("rowCount", String(request.rowCount));
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export const libraryApi = {
  // Lists
  listFiles: (params: ListParams, cursor: string | null, signal?: AbortSignal) =>
    get(pageSchema(fileRowSchema), `${BASE}/files?${listQuery(params, cursor)}`, "listFiles", signal),
  getSuggested: (signal?: AbortSignal) => get(suggestedSchema, `${BASE}/files/suggested`, "getSuggested", signal),
  listTrash: (cursor: string | null, signal?: AbortSignal) =>
    get(trashPageSchema, `${BASE}/trash${cursor ? `?cursor=${enc(cursor)}` : ""}`, "listTrash", signal),

  // One file
  getFile: (id: string, signal?: AbortSignal) => get(fileDetailSchema, fileUrl(id), "getFile", signal),
  getPreview: (id: string, request: PreviewRequest, signal?: AbortSignal) =>
    get(previewSchema, `${fileUrl(id)}/preview${previewQuery(request)}`, "getPreview", signal),
  getUsage: (id: string, signal?: AbortSignal) => get(usageSchema, `${fileUrl(id)}/usage`, "getUsage", signal),
  getAccess: (id: string, signal?: AbortSignal) => get(accessListSchema, `${fileUrl(id)}/access`, "getAccess", signal),
  getDownloadUrl: async (id: string) => (await get(z.object({ url: z.string() }), `${fileUrl(id)}/download`, "getDownloadUrl")).url,
  markOpened: (id: string) => apiFetchVoid(`${fileUrl(id)}/opened`, { method: "POST" }),

  // Changes
  // The body goes through the rename form's schema, so the form and the request share one contract.
  renameFile: async (id: string, title: string) =>
    parse(fileRowSchema, await apiFetchJson<unknown>(fileUrl(id), { method: "PATCH", ...jsonBody(renameSchema.parse({ title })) }), "renameFile"),
  trashFile: async (id: string) =>
    parse(z.object({ daysLeft: z.number().int().nonnegative() }), await apiFetchJson<unknown>(fileUrl(id), { method: "DELETE" }), "trashFile"),
  restoreFile: (id: string) => apiFetchVoid(`${trashUrl(id)}/restore`, { method: "POST" }),
  deleteForever: (id: string) => apiFetchVoid(trashUrl(id), { method: "DELETE" }),
  emptyTrash: () => apiFetchVoid(`${BASE}/trash`, { method: "DELETE" }),
  addGrant: async (id: string, target: GrantTarget) =>
    parse(accessListSchema, await apiFetchJson<unknown>(`${fileUrl(id)}/grants`, { method: "POST", ...grantBody(target) }), "addGrant"),
  revokeGrant: async (id: string, grantId: string) =>
    parse(accessListSchema, await apiFetchJson<unknown>(`${fileUrl(id)}/grants/${enc(grantId)}`, { method: "DELETE" }), "revokeGrant"),

  // People come from the workspace members endpoint; ids are the same user ids the grants endpoint takes.
  listPeople: async (orgId: string, query: string): Promise<Person[]> => {
    const needle = query.trim().toLowerCase();
    const members = await listOrgMembers(orgId);
    return members
      .filter((member) => member.inviteStatus === "signed_up")
      .filter((member) => !needle || member.name.toLowerCase().includes(needle) || member.email.toLowerCase().includes(needle))
      .map((member) => personSchema.parse({ id: member.id, name: member.name || member.email }))
      .slice(0, 20);
  },

  // Summaries
  getStorage: (signal?: AbortSignal) => get(storageSchema, `${BASE}/storage`, "getStorage", signal),
  getLimits: (signal?: AbortSignal) => get(limitsSchema, `${BASE}/limits`, "getLimits", signal),

  // Uploads (the composer owns the UI; Library has no upload button)
  createUpload: async (request: UploadInitRequest) =>
    parse(uploadInitSchema, await apiFetchJson<unknown>(`${BASE}/uploads`, { method: "POST", ...jsonBody(request) }), "createUpload"),
  completeUpload: (id: string, parts: UploadPartEtag[]) => apiFetchVoid(`${uploadUrl(id)}/complete`, { method: "POST", ...jsonBody({ parts }) }),
  /** Fresh presigned URLs for parts whose URL expired (the storage origin answered 403). */
  presignUploadParts: async (id: string, partNumbers: number[]) =>
    parse(
      z.object({ parts: uploadInitSchema.shape.parts }),
      await apiFetchJson<unknown>(`${uploadUrl(id)}/parts`, { method: "POST", ...jsonBody({ partNumbers }) }),
      "presignUploadParts",
    ).parts,
  cancelUpload: (id: string) => apiFetchVoid(uploadUrl(id), { method: "DELETE" }),
  getUploadStatuses: (ids: string[], signal?: AbortSignal) =>
    get(z.array(uploadStatusSchema), `${BASE}/uploads?ids=${ids.map(enc).join(",")}`, "getUploadStatuses", signal),
};
export type LibraryApi = typeof libraryApi;
