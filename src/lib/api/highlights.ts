"use client";

import { apiFetch, apiFetchJson, ApiError } from "./client";
import { HIGHLIGHTS_ENDPOINT, HIGHLIGHT_DETAIL_ENDPOINT } from "@/lib/config";

// ── Request / Response shapes — match backend schema exactly ──────────────────

export interface HighlightCreate {
  message_id:    string;
  selected_text: string;
  start_offset:  number;
  end_offset:    number;
  color_index:   number;
}

export interface HighlightResponse {
  id:            string;
  message_id:    string;
  selected_text: string;
  start_offset:  number;
  end_offset:    number;
  color_index:   number;
  chat_id?:      string;
  created_at:    string;
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Fetch all highlights for the current user (GET /highlights).
 * Returns them in the order the backend provides (newest first).
 */
export async function getHighlights(): Promise<HighlightResponse[]> {
  return apiFetchJson<HighlightResponse[]>(HIGHLIGHTS_ENDPOINT, {
    method: "GET",
  });
}

/**
 * Persist a new highlight to the backend (PATCH /highlights).
 * Returns the server-assigned HighlightResponse on success.
 */
export async function createHighlight(body: HighlightCreate): Promise<HighlightResponse> {
  return apiFetchJson<HighlightResponse>(HIGHLIGHTS_ENDPOINT, {
    method: "PATCH",
    body:   JSON.stringify(body),
  });
}

/**
 * Soft-delete a highlight on the backend (PATCH /highlights/{id}).
 * Resolves on 204; throws ApiError on any other non-2xx status.
 */
export async function removeHighlight(highlightId: string): Promise<void> {
  const res = await apiFetch(HIGHLIGHT_DETAIL_ENDPOINT(highlightId), {
    method: "PATCH",
  });
  if (!res.ok && res.status !== 204) {
    throw new ApiError(res.status, "api_error", "Failed to delete highlight");
  }
}
