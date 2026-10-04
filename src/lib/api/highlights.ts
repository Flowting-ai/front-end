"use client";

import { apiFetch, apiFetchJson, ApiError } from "./client";
import { HIGHLIGHTS_ENDPOINT, HIGHLIGHT_DETAIL_ENDPOINT } from "@/lib/config";
import { HIGHLIGHTS_ENABLED, FeatureDisabledError } from "@/lib/feature-flags";

/** Backstop: highlights are hidden, so no call may reach the backend. */
function assertHighlightsEnabled(): void {
  if (!HIGHLIGHTS_ENABLED) throw new FeatureDisabledError("Highlights");
}

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
  chat_id:       string;
  message_id:    string;
  selected_text: string;
  start_offset:  number;
  end_offset:    number;
  color_index:   number;
  created_at:    string;
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Fetch all highlights for a specific chat (GET /highlights?chat_id=...).
 * The backend requires chat_id as a query parameter.
 */
export async function getHighlights(chatId: string): Promise<HighlightResponse[]> {
  assertHighlightsEnabled();
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
  assertHighlightsEnabled();
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
  assertHighlightsEnabled();
  const res = await apiFetch(HIGHLIGHT_DETAIL_ENDPOINT(highlightId), {
    method: "PATCH",
  });
  if (!res.ok && res.status !== 204) {
    throw new ApiError(res.status, "api_error", "Failed to delete highlight");
  }
}
