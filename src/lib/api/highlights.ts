"use client";

import { apiFetch, apiFetchJson, ApiError } from "./client";
import { HIGHLIGHTS_ENDPOINT, HIGHLIGHT_DETAIL_ENDPOINT } from "@/lib/config";

// ── Request / Response shapes - match backend schema exactly ──────────────────

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
 * Fetch all highlights for a specific chat (GET /highlights?chat_id=...).
 * The backend requires chat_id as a query parameter.
 */
export async function getHighlights(chatId: string): Promise<HighlightResponse[]> {
  const url = `${HIGHLIGHTS_ENDPOINT}?chat_id=${encodeURIComponent(chatId)}`;
  return apiFetchJson<HighlightResponse[]>(url, {
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
