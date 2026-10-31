"use client";

import { apiFetch, apiFetchJson } from "./client";
import { personaVersionListItemSchema, personaVersionSchema, type PersonaDocumentResponse, type PersonaVersionListItem, type PersonaVersionResponse } from "./persona-schemas";
import { diffKnowledgeForInheritance } from "@/lib/persona-version-logic";
import { trackFeature } from "@/lib/analytics/events";
import { PERSONA_VERSIONS_ENDPOINT, PERSONA_VERSION_DETAIL_ENDPOINT, PERSONA_VERSION_DOCUMENT_ENDPOINT, PERSONA_VERSION_DOCUMENT_DELETE_ENDPOINT, PERSONA_VERSION_IMAGE_ENDPOINT, PERSONA_VERSION_KNOWLEDGE_URL_ENDPOINT, PERSONA_VERSION_BLOCKED_CONNECTORS_ENDPOINT, PERSONA_VERSION_BLOCKED_CONNECTOR_ENDPOINT, directUpload } from "@/lib/config";
import type { Persona } from "./persona-model";

// ── Version CRUD ──────────────────────────────────────────────────────────────

export async function listVersions(repoId: string): Promise<PersonaVersionListItem[]> {
  const raw = await apiFetchJson<unknown>(PERSONA_VERSIONS_ENDPOINT(repoId));
  return personaVersionListItemSchema.array().parse(raw);
}

export async function urlToImageFile(url: string): Promise<File | null> {
  try {
    // S3 pre-signed URLs fail browser-side fetch due to CORS. Route them through
    // the Next.js proxy which runs server-side without CORS restrictions.
    const fetchUrl = url.includes('.amazonaws.com')
      ? `/api/download?url=${encodeURIComponent(url)}&filename=avatar.jpg`
      : url
    const res = await fetch(fetchUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
    return new File([blob], `avatar.${ext}`, { type: blob.type || "image/jpeg" });
  } catch {
    return null;
  }
}

export async function createVersion(params: {
  repoId: string;
  name: string;
  modelId: string;
  prompt?: string;
  description?: string | null;
  temperature?: number | null;
  image?: File | null;
  /** Existing image URL to carry forward when no new image file is provided. */
  imageUrl?: string | null;
}): Promise<PersonaVersionResponse> {
  const form = new FormData();
  form.append("name", params.name);
  form.append("model_id", params.modelId);
  if (params.prompt) form.append("prompt", params.prompt);
  if (params.description) form.append("description", params.description);
  if (params.temperature != null) form.append("temperature", String(params.temperature));
  let image: File | null = params.image ?? null;
  if (!image && params.imageUrl) image = await urlToImageFile(params.imageUrl);
  if (image) form.append("image", image);
  // Direct-to-backend: image uploads can exceed the 4.5 MB serverless proxy cap.
  return personaVersionSchema.parse(await apiFetchJson<unknown>(directUpload(PERSONA_VERSIONS_ENDPOINT(params.repoId)), {
    method: "POST",
    body: form,
  }));
}

export async function getVersion(repoId: string, versionId: string): Promise<PersonaVersionResponse> {
  return personaVersionSchema.parse(await apiFetchJson<unknown>(PERSONA_VERSION_DETAIL_ENDPOINT(repoId, versionId)));
}

/** Download a stored knowledge document back into a File so it can be re-attached
 *  to a new version. Returns null when the document has no fetchable URL or the
 *  download fails (e.g. CORS) — inheritKnowledge then skips it gracefully. */
async function documentToFile(doc: PersonaDocumentResponse): Promise<File | null> {
  const url = doc.download_url ?? doc.source_url ?? null;
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], doc.document_filename, {
      type: blob.type || doc.content_type || "application/octet-stream",
    });
  } catch {
    return null;
  }
}

/**
 * Carry a source version's knowledge (documents + links) onto a target version.
 *
 * Used when an explicit "Save version" forks a new version: new versions must
 * inherit the prior version's files so nothing silently disappears across
 * versions or after republishing. De-duplicates against whatever the target
 * already has, so it is a safe no-op if the backend already cloned files when
 * the new version was created.
 *
 * Best-effort: individual files that can't be re-downloaded are skipped rather
 * than failing the whole save. Returns the count actually carried so callers can
 * surface a warning if some files couldn't be inherited.
 */
export async function inheritKnowledge(
  repoId: string,
  sourceVersionId: string,
  targetVersionId: string,
): Promise<{ documentsCarried: number; linksCarried: number; documentsFailed: number }> {
  const result = { documentsCarried: 0, linksCarried: 0, documentsFailed: 0 };
  if (!sourceVersionId || !targetVersionId || sourceVersionId === targetVersionId) {
    return result;
  }

  let source: PersonaVersionResponse;
  let target: PersonaVersionResponse;
  try {
    [source, target] = await Promise.all([
      getVersion(repoId, sourceVersionId),
      getVersion(repoId, targetVersionId),
    ]);
  } catch {
    // Can't read either version — nothing safe to do.
    return result;
  }

  const { documentsToCarry, linksToCarry } = diffKnowledgeForInheritance({
    sourceDocuments: source.documents ?? [],
    sourceLinks: source.links ?? [],
    targetDocuments: target.documents ?? [],
    targetLinks: target.links ?? [],
  });

  // Sequential on purpose — re-uploading carried files one at a time avoids
  // overwhelming the upload endpoint when a version has many documents.
  for (const doc of documentsToCarry) {
    // eslint-disable-next-line no-await-in-loop -- intentional sequential upload
    const file = await documentToFile(doc as PersonaDocumentResponse);
    if (!file) { result.documentsFailed += 1; continue; }
    try {
      // eslint-disable-next-line no-await-in-loop -- intentional sequential upload
      await uploadDocument(repoId, targetVersionId, file);
      result.documentsCarried += 1;
    } catch {
      result.documentsFailed += 1;
    }
  }

  for (const link of linksToCarry) {
    const url = link.source_url ?? link.document_filename;
    if (!url) continue;
    try {
      // eslint-disable-next-line no-await-in-loop -- intentional sequential add
      await addKnowledgeUrl(repoId, targetVersionId, url);
      result.linksCarried += 1;
    } catch {
      /* skip unreachable link */
    }
  }

  return result;
}

export async function updateVersion(params: {
  repoId: string;
  versionId: string;
  name?: string;
  prompt?: string;
  description?: string | null;
  modelId?: string;
  temperature?: number | null;
  persona_tags?: string[];
  image?: File | null;
  /** Existing image URL to carry forward when no new image file is provided. */
  imageUrl?: string | null;
}): Promise<PersonaVersionResponse> {
  // PATCH accepts JSON-only metadata (UpdatePersona schema).
  const patchBody: Record<string, unknown> = {};
  if (params.name != null)         patchBody.name         = params.name;
  if (params.prompt != null)       patchBody.prompt       = params.prompt;
  if (params.description != null)  patchBody.description  = params.description;
  if (params.modelId != null)      patchBody.model_id     = params.modelId;
  if (params.temperature != null)  patchBody.temperature  = params.temperature;
  if (params.persona_tags != null) patchBody.persona_tags = params.persona_tags;

  let result = personaVersionSchema.parse(await apiFetchJson<unknown>(
    PERSONA_VERSION_DETAIL_ENDPOINT(params.repoId, params.versionId),
    { method: "PATCH", body: JSON.stringify(patchBody) },
  ));

  // The picture goes through PUT /image; back-end 9079f6e3 removed PUT /files, which also took knowledge files.
  let image: File | null = params.image ?? null;
  if (!image && params.imageUrl) image = await urlToImageFile(params.imageUrl);
  if (image) {
    const form = new FormData();
    form.append("image", image);
    // Direct-to-backend: file uploads can exceed the 4.5 MB serverless proxy cap.
    result = personaVersionSchema.parse(await apiFetchJson<unknown>(
      directUpload(PERSONA_VERSION_IMAGE_ENDPOINT(params.repoId, params.versionId)),
      { method: "PUT", body: form },
    ));
  }

  // Analytics: agent config edited (choke point for all configure-tab saves).
  trackFeature("agent_edited");
  return result;
}

/** DELETE /persona/{repo_id}/versions/{persona_id} */
export async function deleteVersion(repoId: string, versionId: string): Promise<void> {
  const res = await apiFetch(PERSONA_VERSION_DETAIL_ENDPOINT(repoId, versionId), { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete version (status ${res.status})`);
}

// ── Document management ───────────────────────────────────────────────────────

export async function uploadDocument(repoId: string, versionId: string, file: File): Promise<PersonaVersionResponse> {
  const form = new FormData();
  form.append("file", file);
  // Direct-to-backend: file uploads can exceed the 4.5 MB serverless proxy cap.
  return personaVersionSchema.parse(await apiFetchJson<unknown>(
    directUpload(PERSONA_VERSION_DOCUMENT_ENDPOINT(repoId, versionId)),
    { method: "POST", body: form },
  ));
}

/**
 * POST /persona/{repo_id}/versions/{version_id}/knowledge-url
 * Registers a URL as a knowledge source for this version.
 * The endpoint expects application/x-www-form-urlencoded (not JSON).
 */
export async function addKnowledgeUrl(
  repoId: string,
  versionId: string,
  url: string,
): Promise<PersonaVersionResponse> {
  const params = new URLSearchParams()
  params.append('url', url)
  return personaVersionSchema.parse(await apiFetchJson<unknown>(
    PERSONA_VERSION_KNOWLEDGE_URL_ENDPOINT(repoId, versionId),
    {
      method:  'POST',
      body:    params.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
  ))
}

export async function deleteDocument(
  repoId: string,
  versionId: string,
  documentId: string,
): Promise<PersonaVersionResponse> {
  // DELETE returns the updated PersonaVersionResponse (200) — callers can use
  // this directly to refresh the document list without a second getVersion call.
  return personaVersionSchema.parse(await apiFetchJson<unknown>(
    PERSONA_VERSION_DOCUMENT_DELETE_ENDPOINT(repoId, versionId, documentId),
    { method: "DELETE" },
  ));
}

// ── Version connectors ────────────────────────────────────────────────────────

/**
 * PATCH /persona/{repo_id}/versions/{persona_id}/blocked-connectors
 * Replace the set of connector slugs that are blocked (disabled) for this
 * persona version. The backend stores the block-list independently of the
 * enabled connectors set — pass an empty array to unblock everything.
 */
export async function setVersionBlockedConnectors(
  repoId: string,
  versionId: string,
  blockedSlugs: string[],
): Promise<PersonaVersionResponse> {
  return personaVersionSchema.parse(await apiFetchJson<unknown>(
    PERSONA_VERSION_BLOCKED_CONNECTORS_ENDPOINT(repoId, versionId),
    {
      method: 'PATCH',
      body: JSON.stringify({ slugs: blockedSlugs }),
    },
  ));
}

/**
 * DELETE /persona/{repo_id}/versions/{persona_id}/blocked-connectors/{slug}
 * Unblock a single connector slug, re-enabling it for this persona version.
 */
export async function unblockVersionConnector(
  repoId: string,
  versionId: string,
  slug: string,
): Promise<void> {
  const res = await apiFetch(
    PERSONA_VERSION_BLOCKED_CONNECTOR_ENDPOINT(repoId, versionId, slug),
    { method: 'DELETE' },
  );
  if (!res.ok) throw new Error(`Failed to unblock connector (status ${res.status})`);
}

// ── Persona starter ────────────────────────────────────────────────────────────

