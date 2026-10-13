// The REST implementation of LibraryApi (contract: docs v2/library/04-backend-requirements.md,
// section 5). Control-plane calls only: the bytes of an upload go straight to presigned storage
// URLs (upload/transport.ts), never through here or through the Next proxy.
//
// Every response is parsed with the zod schemas, so a contract drift fails here, loudly and once,
// as an ApiError("contract_error"), instead of as an undefined inside a component.

import { z } from "zod";
import { ApiError, apiFetchJson, apiFetchVoid } from "@/lib/api/client";
import { listMembers as listOrgMembers } from "@/lib/api/organization";
import { API_BASE_URL } from "@/lib/config";
import type { GrantTarget, LibraryApi } from "./api";
import { captureError } from "./observability";
import type { ListParams } from "./query-params";
import {
  accessListSchema,
  fileDetailSchema,
  fileRowSchema,
  flagsSchema,
  limitsSchema,
  memberSchema,
  orgSettingsSchema,
  pageSchema,
  personSchema,
  prefsSchema,
  previewSchema,
  storageSchema,
  suggestedSchema,
  trashPageSchema,
  uploadInitSchema,
  uploadStatusSchema,
  usageSchema,
  type Person,
} from "./schemas";

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
  query.set("limit", String(PAGE_SIZE));
  if (cursor) query.set("cursor", cursor);
  return query.toString();
}

function grantBody(target: GrantTarget): RequestInit {
  return jsonBody(target.kind === "workspace" ? { who: "workspace" } : { who: target.personId });
}

export function createRealLibraryApi(): LibraryApi {
  return {
    listFiles: (params, cursor, signal) =>
      get(pageSchema(fileRowSchema), `${BASE}/files?${listQuery(params, cursor)}`, "listFiles", signal),
    getSuggested: (signal) => get(suggestedSchema, `${BASE}/files/suggested`, "getSuggested", signal),
    listTrash: (cursor, signal) =>
      get(trashPageSchema, `${BASE}/trash${cursor ? `?cursor=${enc(cursor)}` : ""}`, "listTrash", signal),

    getFile: (id, signal) => get(fileDetailSchema, fileUrl(id), "getFile", signal),
    getPreview: (id, request, signal) => {
      const query = new URLSearchParams();
      if (request.sheet) query.set("sheet", request.sheet);
      if (request.rowStart !== undefined) query.set("rowStart", String(request.rowStart));
      if (request.rowCount !== undefined) query.set("rowCount", String(request.rowCount));
      const queryString = query.toString();
      const suffix = queryString ? `?${queryString}` : "";
      return get(previewSchema, `${fileUrl(id)}/preview${suffix}`, "getPreview", signal);
    },
    getUsage: (id, signal) => get(usageSchema, `${fileUrl(id)}/usage`, "getUsage", signal),
    getAccess: (id, signal) => get(accessListSchema, `${fileUrl(id)}/access`, "getAccess", signal),
    getDownloadUrl: async (id) => {
      const body = await get(z.object({ url: z.string() }), `${fileUrl(id)}/download`, "getDownloadUrl");
      return body.url;
    },
    markOpened: (id) => apiFetchVoid(`${fileUrl(id)}/opened`, { method: "POST" }),

    renameFile: async (id, title) =>
      parse(fileRowSchema, await apiFetchJson<unknown>(fileUrl(id), { method: "PATCH", ...jsonBody({ title }) }), "renameFile"),
    trashFile: async (id) =>
      parse(z.object({ daysLeft: z.number().int().nonnegative() }), await apiFetchJson<unknown>(fileUrl(id), { method: "DELETE" }), "trashFile"),
    restoreFile: (id) => apiFetchVoid(`${trashUrl(id)}/restore`, { method: "POST" }),
    deleteForever: (id) => apiFetchVoid(trashUrl(id), { method: "DELETE" }),
    emptyTrash: () => apiFetchVoid(`${BASE}/trash`, { method: "DELETE" }),
    addGrant: async (id, target) =>
      parse(accessListSchema, await apiFetchJson<unknown>(`${fileUrl(id)}/grants`, { method: "POST", ...grantBody(target) }), "addGrant"),
    revokeGrant: async (id, grantId) =>
      parse(accessListSchema, await apiFetchJson<unknown>(`${fileUrl(id)}/grants/${enc(grantId)}`, { method: "DELETE" }), "revokeGrant"),
    requestAccess: (id) => apiFetchVoid(`${fileUrl(id)}/access-requests`, { method: "POST" }),

    // People come from the existing workspace members endpoint; ids are the same user ids the grants endpoint takes.
    listPeople: async (orgId, query) => {
      const needle = query.trim().toLowerCase();
      const members = await listOrgMembers(orgId);
      const people: Person[] = members
        .filter((member) => member.inviteStatus === "signed_up")
        .filter((member) => !needle || member.name.toLowerCase().includes(needle) || member.email.toLowerCase().includes(needle))
        .map((member) => personSchema.parse({ id: member.id, name: member.name || member.email, avatarUrl: member.avatarUrl }));
      return people.slice(0, 20);
    },

    getStorage: (signal) => get(storageSchema, `${BASE}/storage`, "getStorage", signal),
    getLimits: (signal) => get(limitsSchema, `${BASE}/limits`, "getLimits", signal),
    getFlags: (signal) => get(flagsSchema, `${BASE}/flags`, "getFlags", signal),

    getPrefs: (signal) => get(prefsSchema, `${BASE}/prefs`, "getPrefs", signal),
    updatePrefs: async (patch) =>
      parse(prefsSchema, await apiFetchJson<unknown>(`${BASE}/prefs`, { method: "PATCH", ...jsonBody(patch) }), "updatePrefs"),
    getOrgSettings: (signal) => get(orgSettingsSchema, `${BASE}/org-settings`, "getOrgSettings", signal),
    updateOrgSettings: async (patch, version) =>
      parse(
        orgSettingsSchema,
        await apiFetchJson<unknown>(`${BASE}/org-settings`, {
          method: "PATCH",
          headers: { "If-Match": String(version) },
          ...jsonBody(patch),
        }),
        "updateOrgSettings",
      ),
    listMembers: (signal) => get(z.array(memberSchema), `${BASE}/members`, "listMembers", signal),
    getMyRemoval: (signal) =>
      get(
        z.object({ pending: z.boolean(), requestedBy: personSchema.optional() }),
        `${BASE}/members/me/removal`,
        "getMyRemoval",
        signal,
      ),
    answerMyRemoval: (transfer) => apiFetchVoid(`${BASE}/members/me/removal/answer`, { method: "POST", ...jsonBody({ transfer }) }),
    // The roster comes from the existing workspace members endpoint (the one the Share dialog uses); pending
    // removals and file counts come from GET /library/members when the backend has it (04 doc, section 5).
    listWorkspaceMembers: async (orgId, signal) => {
      const [roster, library] = await Promise.all([
        listOrgMembers(orgId),
        get(z.array(memberSchema), `${BASE}/members`, "listMembers", signal).catch(() => [] as z.infer<typeof memberSchema>[]),
      ]);
      const byId = new Map(library.map((member) => [member.id, member]));
      return roster
        .filter((member) => member.inviteStatus === "signed_up" && member.orgRole !== "service")
        .map((member) =>
          memberSchema.parse({
            id: member.id,
            name: member.name || member.email,
            email: member.email,
            avatarUrl: member.avatarUrl,
            role: member.orgRole === "admin" || member.orgRole === "owner" ? "admin" : "member",
            fileCount: byId.get(member.id)?.fileCount ?? 0,
            removal: byId.get(member.id)?.removal,
          }),
        );
    },
    // 04 doc 6.7: removal creates LibraryRemoval(status=awaiting_answer). The doc routes it through the org
    // service; this is the Library-side call for it, pending a backend endpoint.
    startMemberRemoval: (personId) => apiFetchVoid(`${BASE}/members/${enc(personId)}/removal`, { method: "POST" }),
    // 04 doc 6.7: "Self-leave uses the same path" (the answer endpoint, with no pending removal); `only_admin` for the only Admin.
    leaveWorkspace: (transfer) => apiFetchVoid(`${BASE}/members/me/removal/answer`, { method: "POST", ...jsonBody({ transfer }) }),

    createUpload: async (request) =>
      parse(uploadInitSchema, await apiFetchJson<unknown>(`${BASE}/uploads`, { method: "POST", ...jsonBody(request) }), "createUpload"),
    completeUpload: (id, parts) => apiFetchVoid(`${uploadUrl(id)}/complete`, { method: "POST", ...jsonBody({ parts }) }),
    presignUploadParts: async (id, partNumbers) => {
      const body = parse(
        z.object({ parts: uploadInitSchema.shape.parts }),
        await apiFetchJson<unknown>(`${uploadUrl(id)}/parts`, { method: "POST", ...jsonBody({ partNumbers }) }),
        "presignUploadParts",
      );
      return body.parts;
    },
    cancelUpload: (id) => apiFetchVoid(uploadUrl(id), { method: "DELETE" }),
    getUploadStatuses: (ids, signal) =>
      get(z.array(uploadStatusSchema), `${BASE}/uploads?ids=${ids.map(enc).join(",")}`, "getUploadStatuses", signal),
  };
}
