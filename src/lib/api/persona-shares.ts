"use client";

import { apiFetch, apiFetchJson, ApiError, friendlyApiError } from "./client";
import {
  PERSONA_SHARES_ENDPOINT,
  PERSONA_SHARE_DETAIL_ENDPOINT,
  PERSONA_SHARE_ACCEPT_ENDPOINT,
} from "@/lib/config";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ShareType = "link" | "email";

/** Row returned by POST /persona-shares and GET /persona-shares */
export interface PersonaShare {
  id: string;
  /** The persona VERSION id that was frozen at share creation time. */
  persona_id: string;
  shared_by_user_id: string;
  share_type: ShareType;
  recipient_emails: string[] | null;
  credit_limit: number | null;
  credit_used: number;
  expires_at: string | null;
  is_active: boolean;
  share_url: string;
  created_at: string;
  updated_at: string;
}

/** Returned by GET /persona-shares/{id} — shown to the person accepting the share. */
export interface PersonaSharePreview {
  share_id: string;
  persona_name: string;
  description: string | null;
  prompt: string;
  model_id: string | null;
  temperature: number | null;
  image_url: string | null;
  shared_by_name: string;
  shared_by_email: string;
  expires_at: string | null;
  credit_limit: number | null;
  credit_remaining: number | null;
}

/** Returned by POST /persona-shares/{id}/accept — a PersonaVersionResponse shape. */
export interface AcceptShareResponse {
  /** The newly created persona version id. */
  id: string;
  persona_repo_id: string;
  name: string;
  handler: string;
  source_share_id: string;
}

export interface CreateShareParams {
  /** The persona REPO id — backend freezes the active version at share time. */
  persona_repo_id: string;
  share_type: ShareType;
  recipient_emails?: string[];
  /** null = unlimited */
  credit_limit?: number | null;
  /** ISO-8601 or null */
  expires_at?: string | null;
}

// ── API functions ──────────────────────────────────────────────────────────────

export async function createShare(params: CreateShareParams): Promise<PersonaShare> {
  return apiFetchJson<PersonaShare>(PERSONA_SHARES_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function listShares(): Promise<PersonaShare[]> {
  return apiFetchJson<PersonaShare[]>(PERSONA_SHARES_ENDPOINT);
}

export async function getSharePreview(id: string): Promise<PersonaSharePreview> {
  return apiFetchJson<PersonaSharePreview>(PERSONA_SHARE_DETAIL_ENDPOINT(id));
}

export async function acceptShare(id: string): Promise<AcceptShareResponse> {
  return apiFetchJson<AcceptShareResponse>(PERSONA_SHARE_ACCEPT_ENDPOINT(id), {
    method: "POST",
  });
}

export async function revokeShare(id: string): Promise<void> {
  const res = await apiFetch(PERSONA_SHARE_DETAIL_ENDPOINT(id), { method: "DELETE" });
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    let code = "api_error";
    try {
      const body = (await res.json()) as { message?: string; error?: string; code?: string };
      message = body.message ?? body.error ?? message;
      code = body.code ?? code;
    } catch {
      // empty body (204 No Content path)
    }
    throw new ApiError(res.status, code, friendlyApiError(message, res.status), message);
  }
}
